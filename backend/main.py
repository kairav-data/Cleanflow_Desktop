from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Form, BackgroundTasks, Body
import fastapi
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from contextlib import asynccontextmanager
import asyncio
import os
import re
import sys
import uuid
# Adding current directory to Python path for modules like models.py
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
except ImportError:
    pass

import shutil
import polars as pl
import pandas as pd # Keep for legacy database reading if needed, or migration
from sqlalchemy import create_engine, text
from typing import List

from logger import setup_logger
logger = setup_logger(__name__)

# Internal imports
from models import ValidationConfig, UserInDB
from features.validation import PolarsValidationEngine as ValidationEngine, UPLOAD_DIR, RESULTS_DIR
from database import db
from auth import router as auth_router, get_current_user
from history import (
    router as history_router, 
    connections_router, 
    _build_connection_string_from_dict
)
from payment import router as payment_router
from chatbot import chat_router
from repo_router import router as repo_router
from pipeline_router import router as pipeline_router
from pipeline_execution import attach_output_session, create_dataframe_session, execute_pipeline_runtime
from pipeline_scheduler import PipelineSchedulerService
from features.pipeline_runner import PipelineOrchestrator
# --- Startup/Shutdown Logic ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # This runs when the backend starts
    logger.info("🚀 Backend starting up...")
    try:
        # This triggers the _init_postgres() method in your database.py
        # which creates the tables if they don't exist.
        db._init_postgres() 
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")
    scheduler = PipelineSchedulerService(session_store=sessions)
    app.state.pipeline_scheduler = scheduler
    try:
        await scheduler.start()
    except Exception as exc:
        logger.error("❌ Pipeline scheduler failed to start: %s", exc)

    try:
        yield
    finally:
        try:
            await scheduler.stop()
        except Exception as exc:
            logger.error("❌ Pipeline scheduler failed to stop cleanly: %s", exc)
        # This runs when the backend shuts down
        logger.info("👋 Backend shutting down...")

# Initialize FastAPI with the lifespan handler
app = FastAPI(
    title="Data Cleaning API", 
    description="API for cleaning and validating data",
    lifespan=lifespan
)

# --- CORS setup ---
# FRONTEND_URL must be set as an env var on Render to match your Vercel production domain.
# e.g.  FRONTEND_URL=https://cleanflow-one.vercel.app
frontend_url = os.environ.get("FRONTEND_URL", "https://cleanflow.vercel.app")

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://cleanflow-one.vercel.app",
    "https://www.cleanflow.one",
    "https://cleanflow.one",
    frontend_url,
]

# Also allow ALL Vercel preview deployment URLs (e.g. cleanflow-abc123-kairav.vercel.app)
# so that PR previews and staging deploys work without updating the list each time.
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth_router)
app.include_router(payment_router)
app.include_router(history_router)
app.include_router(connections_router)
app.include_router(chat_router)
app.include_router(repo_router)
app.include_router(pipeline_router)

# Store active sessions in memory
sessions = {}

@app.get("/")
def read_root():
    return {"message": "Data Cleaning API is running"}


@app.head("/")
def read_root_head():
    return Response(status_code=200)


def _get_database_health() -> dict:
    try:
        with db.pg_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok", "db": "connected"}
    except Exception as exc:
        logger.warning("Health check database ping failed: %s", exc)
        return {"status": "degraded", "db": "disconnected"}


@app.get("/health")
def health_check():
    return _get_database_health()


@app.head("/health")
def health_check_head():
    return Response(status_code=200)


def _sanitize_upload_filename(filename: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", os.path.basename(filename or "dataset"))
    cleaned = cleaned.strip("._")
    return cleaned or "dataset"


def _build_file_source_config(original_filename: str, stored_file_name: str, delimiter: str) -> dict:
    return {
        "type": "file",
        "original_filename": original_filename,
        "stored_file_name": stored_file_name,
        "delimiter": delimiter or ",",
    }


def _build_database_source_config(connection_id: str, connection_name: str, query: str) -> dict:
    return {
        "type": "database",
        "connection_id": connection_id,
        "connection_name": connection_name,
        "query": query,
    }

# --- File Upload Endpoints ---

@app.post("/upload")
async def upload_file(file: UploadFile = File(...), delimiter: str = Form(",")):
    try:
        logger.debug(f"Upload received. Filename: {file.filename}, Delimiter: '{delimiter}'")
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        
        stored_file_name = f"{uuid.uuid4().hex}_{_sanitize_upload_filename(file.filename)}"
        file_path = os.path.join(UPLOAD_DIR, stored_file_name)
        
        # Use async read to avoid blocking the event loop during I/O
        contents = await file.read()
        with open(file_path, "wb") as buffer:
            buffer.write(contents)
        
        # Run blocking Polars CSV parsing in a thread pool so the event loop stays free
        loop = asyncio.get_event_loop()
        engine = ValidationEngine()
        columns = await loop.run_in_executor(
            None, lambda: engine.load_data(file_path=file_path, sep=delimiter)
        )
        
        sessions[engine.session_id] = engine
        
        return {
            "session_id": engine.session_id,
            "filename": file.filename,
            "stored_file_name": stored_file_name,
            "columns": columns,
            "source_config": _build_file_source_config(file.filename, stored_file_name, delimiter),
        }
    except Exception as e:
        logger.error(f"Upload Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    

@app.post("/upload-data")
async def upload_data_from_query(payload: dict):
    """Accept data from a database query and create a validation session"""
    try:
        data = payload.get("data", [])
        source = payload.get("source", "Database Query")
        
        if not data:
            raise HTTPException(status_code=400, detail="No data provided")
        
        # Run blocking Polars operation in thread pool
        loop = asyncio.get_event_loop()
        engine = ValidationEngine()
        df = await loop.run_in_executor(None, lambda: pl.from_dicts(data))
        columns = await loop.run_in_executor(None, lambda: engine.load_data(dataframe=df))
        
        # Store engine in session
        sessions[engine.session_id] = engine
        
        return {
            "session_id": engine.session_id,
            "filename": source,
            "columns": columns
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Database Ingestion ---

@app.post("/ingest/database")
async def ingest_database(request: dict, current_user: UserInDB = Depends(get_current_user)):
    connection_id = request.get("connection_id")
    query = request.get("query")
    
    if not connection_id or not query:
        raise HTTPException(status_code=400, detail="Connection ID and Query are required")

    # 1. Fetch the connection details from Mongo via DatabaseManager
    conn_data = await db.get_connection(connection_id, current_user.email)
    if not conn_data:
        raise HTTPException(status_code=404, detail="Connection not found")

    try:
        # 2. Build connection string (imported from history.py)
        conn_str = _build_connection_string_from_dict(conn_data)
        
        # 3. Create engine and execute query using Pandas
        # Polars read_database is better but requires connectorx or adbc
        # Fallback to pandas then polars for compatibility if needed, or try polars read_database
        try:
             df = pl.read_database(query, conn_str)
        except:
             # Fallback to pandas if polars connectors missing
             engine_db = create_engine(conn_str)
             pdf = pd.read_sql(query, engine_db)
             df = pl.from_pandas(pdf)
        
        # 4. Initialize the ValidationEngine with the resulting dataframe
        engine = ValidationEngine()
        columns = engine.load_data(dataframe=df)
        
        # 5. Store session
        sessions[engine.session_id] = engine
        
        return {
            "session_id": engine.session_id,
            "filename": f"DB: {conn_data.get('name', 'Remote DB')}",
            "columns": columns,
            "source_config": _build_database_source_config(
                connection_id,
                conn_data.get('name', 'Remote DB'),
                query,
            ),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")

# --- Validation and Download ---

@app.post("/validate/{session_id}")
async def validate_data(session_id: str, config: ValidationConfig):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    engine = sessions[session_id]
    try:
        result = engine.validate(config.rules)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/download/{filename}")
async def download_result(filename: str):
    file_path = os.path.join(RESULTS_DIR, filename)
    if os.path.exists(file_path):
        return FileResponse(file_path, filename=filename)
    raise HTTPException(status_code=404, detail="File not found")

# --- Feature Endpoints ---

# Enrichment Feature
@app.get("/features/enrichment/providers")
async def get_enrichment_providers():
    """Get available enrichment providers"""
    from features.enrichment import DataEnrichment
    return {"providers": DataEnrichment.get_available_providers()}

@app.post("/features/enrichment/preview/{session_id}")
async def preview_enrichment(session_id: str, config: dict):
    """Preview enrichment on sample data"""
    from features.enrichment import DataEnrichment
    
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    engine = sessions[session_id]
    enrichment = DataEnrichment(session_id)
    enrichment.load_data(engine.df)
    
    result = await enrichment.preview(config, limit=5)
    if not result.success:
        raise HTTPException(status_code=400, detail=result.error)
    
    return result.dict()

@app.post("/features/enrichment/execute/{session_id}")
async def execute_enrichment(session_id: str, config: dict):
    """Execute enrichment on full dataset"""
    from features.enrichment import DataEnrichment
    
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    engine = sessions[session_id]
    enrichment = DataEnrichment(session_id)
    enrichment.load_data(engine.df)
    
    result = await enrichment.execute(config)
    if not result.success:
        raise HTTPException(status_code=400, detail=result.error)
    
    # Update session with enriched data
    if result.data:
        engine.df = pl.DataFrame(result.data) # Result is list of dicts, convert back
    
    return result.dict()

# Data Cleaner Feature
@app.get("/features/cleaner/operations")
async def get_cleaner_operations():
    """Get available cleaner operations"""
    from features.cleaner import DataCleaner
    return {"operations": DataCleaner.get_operations()}

@app.post("/features/cleaner/preview/{session_id}")
async def preview_cleaner(session_id: str, config: dict):
    """Preview cleaning on sample data"""
    from features.cleaner import DataCleaner
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    engine = sessions[session_id]
    cleaner = DataCleaner(session_id)
    cleaner.load_data(engine.df)
    result = await cleaner.preview(config, limit=5)
    if not result.success:
        raise HTTPException(status_code=400, detail=result.error)
    return result.dict()

@app.post("/features/cleaner/execute/{session_id}")
async def execute_cleaner(session_id: str, config: dict):
    """Execute cleaning on full dataset"""
    from features.cleaner import DataCleaner
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    engine = sessions[session_id]
    cleaner = DataCleaner(session_id)
    cleaner.load_data(engine.df)
    result = await cleaner.execute(config)
    if not result.success:
        raise HTTPException(status_code=400, detail=result.error)
    if result.data:
        engine.df = pl.DataFrame(result.data)
    return result.dict()


# ─── Data Transformer Feature ────────────────────────────────────────────────

transformer_sessions: dict = {}


def _get_or_create_transformer(session_id: str):
    from features.transformer import DataTransformer
    if session_id not in transformer_sessions:
        transformer_sessions[session_id] = DataTransformer(session_id)
    return transformer_sessions[session_id]


def _sync_transformer_df(session_id: str) -> bool:
    if session_id not in sessions:
        return False
    eng = sessions[session_id]
    if not hasattr(eng, "df") or eng.df is None:
        return False
    _get_or_create_transformer(session_id).df = eng.df.clone()
    return True


@app.get("/features/transformer/operations")
async def get_transformer_operations():
    from features.transformer import DataTransformer
    return {"operations": DataTransformer.get_operations(), "categories": DataTransformer.get_categories()}


@app.post("/features/transformer/preview/{session_id}")
async def preview_transformer(session_id: str, config: dict):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    if not _sync_transformer_df(session_id):
        raise HTTPException(status_code=400, detail="No data loaded in this session")
    t = _get_or_create_transformer(session_id)
    result = await t.preview(config, limit=config.get("preview_limit", 200))
    if not result.success:
        raise HTTPException(status_code=400, detail=result.error)
    return result.dict()


@app.post("/features/transformer/execute/{session_id}")
async def execute_transformer(session_id: str, config: dict):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    if not _sync_transformer_df(session_id):
        raise HTTPException(status_code=400, detail="No data loaded in this session")
    t = _get_or_create_transformer(session_id)
    result = await t.execute(config)
    if not result.success:
        raise HTTPException(status_code=400, detail=result.error)
    if result.data:
        new_df = pl.from_dicts(result.data)
        sessions[session_id].df = new_df
        t.df = new_df.clone()
    return result.dict()


@app.get("/features/transformer/export/{session_id}")
async def export_transformer_data(session_id: str, format: str = "csv", filename: str = "transformed"):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    eng = sessions[session_id]
    if not hasattr(eng, "df") or eng.df is None:
        raise HTTPException(status_code=400, detail="No data available")
    import re as _re, json as _json
    safe_name = _re.sub(r"[^A-Za-z0-9_-]+", "_", filename.strip()).strip("_") or "transformed"
    os.makedirs(RESULTS_DIR, exist_ok=True)
    file_path = os.path.join(RESULTS_DIR, f"{safe_name}.{format}")
    df = eng.df
    if format == "csv":
        df.write_csv(file_path); media_type = "text/csv"
    elif format == "json":
        with open(file_path, "w", encoding="utf-8") as fh:
            _json.dump(df.to_dicts(), fh, ensure_ascii=False, indent=2)
        media_type = "application/json"
    elif format == "xlsx":
        df.write_excel(file_path)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {format!r}")
    return FileResponse(file_path, media_type=media_type, filename=f"{safe_name}.{format}")


@app.post("/features/transformer/lookup/upload/{session_id}")
async def upload_lookup_dataset(
    session_id: str,
    lookup_name: str = Form(...),
    delimiter: str = Form(","),
    file: UploadFile = File(...),
):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Main dataset session not found")
    try:
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        stored = f"lkp_{session_id[:8]}_{uuid.uuid4().hex[:8]}_{_sanitize_upload_filename(file.filename)}"
        file_path = os.path.join(UPLOAD_DIR, stored)
        contents = await file.read()
        with open(file_path, "wb") as buf:
            buf.write(contents)
        loop = asyncio.get_event_loop()
        lkp_engine = ValidationEngine()
        await loop.run_in_executor(None, lambda: lkp_engine.load_data(file_path=file_path, sep=delimiter))
        if lkp_engine.df is None:
            raise HTTPException(status_code=400, detail="Failed to read lookup file.")
        lookup_id = uuid.uuid4().hex
        _get_or_create_transformer(session_id).register_lookup(lookup_id, lookup_name or file.filename, lkp_engine.df)
        return {"lookup_id": lookup_id, "name": lookup_name or file.filename,
                "columns": lkp_engine.df.columns, "rows": len(lkp_engine.df)}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Lookup upload error")
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/features/transformer/lookup/list/{session_id}")
async def list_lookup_datasets(session_id: str):
    if session_id not in transformer_sessions:
        return {"lookups": []}
    return {"lookups": transformer_sessions[session_id].get_lookup_meta()}


@app.get("/features/transformer/lookup/columns/{session_id}/{lookup_id}")
async def get_lookup_columns_route(session_id: str, lookup_id: str):
    if session_id not in transformer_sessions:
        raise HTTPException(status_code=404, detail="Transformer session not found")
    cols = transformer_sessions[session_id].get_lookup_columns(lookup_id)
    if not cols:
        raise HTTPException(status_code=404, detail="Lookup dataset not found")
    return {"lookup_id": lookup_id, "columns": cols}


@app.delete("/features/transformer/lookup/{session_id}/{lookup_id}")
async def delete_lookup_dataset(session_id: str, lookup_id: str):
    if session_id not in transformer_sessions:
        raise HTTPException(status_code=404, detail="Transformer session not found")
    if not transformer_sessions[session_id].remove_lookup(lookup_id):
        raise HTTPException(status_code=404, detail="Lookup dataset not found")
    return {"removed": lookup_id}


@app.get("/features/export/{session_id}")

async def export_data(session_id: str, format: str = "csv"):
    """Export current session data directly"""
    import os
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    engine = sessions[session_id]
    if engine.df is None:
        raise HTTPException(status_code=400, detail="No data available")
        
    os.makedirs(RESULTS_DIR, exist_ok=True)
    file_path = os.path.join(RESULTS_DIR, f"export_{session_id}.{format}")
    
    if format == "csv":
        engine.df.write_csv(file_path)
    elif format == "json":
        engine.df.write_json(file_path)
    elif format == "xlsx":
        engine.df.write_excel(file_path)
    else:
        raise HTTPException(status_code=400, detail="Format not supported")
        
    return FileResponse(file_path, filename=f"dataset_cleaned.{format}")

# --- Dataset Viewer Endpoints ---
@app.get("/dataset/{session_id}/preview")
async def get_dataset_preview(session_id: str, limit: int = 50, dataset_id: str = None):
    """Preview raw dataset for a given session. Supports multiple datasets if dataset_id is provided."""
    import polars as pl
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
        
    engine = sessions[session_id]
    df = None
    
    # Most pipelines use engine.df
    if hasattr(engine, 'df'):
        df = engine.df
    # Data Matching and Pricing Intelligence use engine.datasets 
    # (or you could pass dataset_id corresponding to primary/secondary)
    elif hasattr(engine, 'datasets'):
        if not engine.datasets:
            return {"data": []}
        if dataset_id and dataset_id in engine.datasets:
            df = engine.datasets[dataset_id]
        else:
            # Fallback to the first dataset if none specified
            df = list(engine.datasets.values())[0]
            
    if df is None or not isinstance(df, pl.DataFrame):
        return {"data": []}
        
    return {"data": df.head(limit).to_dicts()}

# Scraping Feature
@app.get("/features/scraper/templates")
async def get_scraper_templates():
    """Get available scraping templates"""
    from features.scraper import WebScraper
    return {"templates": WebScraper.get_available_templates()}

@app.post("/features/scraper/preview")
async def preview_scraping(config: dict):
    """Preview scraping on a single URL"""
    from features.scraper import WebScraper
    
    scraper = WebScraper("preview")
    result = await scraper.preview(config, limit=1)
    
    if not result.success:
        raise HTTPException(status_code=400, detail=result.error)
    
    return result.dict()

@app.post("/features/scraper/execute")
async def execute_scraping(config: dict):
    """Execute scraping on multiple URLs"""
    from features.scraper import WebScraper
    
    scraper = WebScraper("scraping")
    result = await scraper.execute(config)
    
    if not result.success:
        raise HTTPException(status_code=400, detail=result.error)
    
    # Create a new session with scraped data
    if result.data:
        engine = ValidationEngine()
        df = pl.DataFrame(result.data)
        engine.load_data(dataframe=df)
        sessions[engine.session_id] = engine
        
        return {
            **result.dict(),
            "session_id": engine.session_id,
            "columns": df.columns
        }
    
    return result.dict()

# Mapping Feature
@app.get("/features/mapper/transformations")
async def get_mapper_transformations():
    """Get available transformations"""
    from features.mapper import SchemaMapper
    return {"transformations": SchemaMapper.get_available_transformations()}

@app.get("/features/mapper/aggregations")
async def get_mapper_aggregations():
    """Get available aggregations"""
    from features.mapper import SchemaMapper
    return {"aggregations": SchemaMapper.get_available_aggregations()}

@app.post("/features/mapper/suggest/{session_id}")
async def suggest_mappings(session_id: str, target_schema: dict):
    """Get intelligent mapping suggestions"""
    from features.mapper import SchemaMapper
    
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    engine = sessions[session_id]
    mapper = SchemaMapper(session_id)
    mapper.load_data(engine.df)
    
    suggestions = mapper.suggest_mappings(target_schema)
    return suggestions

@app.post("/features/mapper/preview/{session_id}")
async def preview_mapping(session_id: str, config: dict):
    """Preview schema mapping on sample data"""
    from features.mapper import SchemaMapper
    
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    engine = sessions[session_id]
    mapper = SchemaMapper(session_id)
    mapper.load_data(engine.df)
    
    result = await mapper.preview(config, limit=5)
    if not result.success:
        raise HTTPException(status_code=400, detail=result.error)
    
    return result.dict()

@app.post("/features/mapper/execute/{session_id}")
async def execute_mapping(session_id: str, config: dict):
    """Execute schema mapping on full dataset"""
    from features.mapper import SchemaMapper
    
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    engine = sessions[session_id]
    mapper = SchemaMapper(session_id)
    mapper.load_data(engine.df)
    
    result = await mapper.execute(config)
    if not result.success:
        raise HTTPException(status_code=400, detail=result.error)
    
    # Update session with mapped data
    if result.data:
        engine.df = pl.DataFrame(result.data)
    
    return result.dict()

# Data Matching Feature
@app.get("/features/matching/algorithms")
async def get_matching_algorithms():
    """Get available matching algorithms"""
    from features.matching import DataMatcher
    return {"algorithms": DataMatcher.get_available_algorithms()}

@app.post("/features/matching/load-dataset")
async def load_matching_dataset(payload: dict):
    """Load a dataset for matching"""
    from features.matching import DataMatcher
    
    session_id = payload.get('session_id')
    dataset_id = payload.get('dataset_id')
    data = payload.get('data', [])
    
    if not session_id or not dataset_id or not data:
        raise HTTPException(status_code=400, detail="session_id, dataset_id, and data are required")
    
    # Create or get matcher session
    if session_id not in sessions:
        matcher = DataMatcher(session_id)
        sessions[session_id] = matcher
    else:
        matcher = sessions[session_id]
    
    # Load dataset
    df = pl.from_dicts(data) # Polars
    matcher.load_dataset(dataset_id, df)
    
    return {
        "session_id": session_id,
        "dataset_id": dataset_id,
        "columns": df.columns,
        "rows": len(df)
    }

@app.post("/features/matching/upload-dataset")
async def load_matching_dataset_file(
    session_id: str = Form(...),
    dataset_id: str = Form(...),
    delimiter: str = Form(","),
    file: UploadFile = File(...)
):
    """Load a dataset from file (CSV/Excel)"""
    from features.matching import DataMatcher
    try:
        # Create or get matcher session
        if session_id not in sessions:
            matcher = DataMatcher(session_id)
            sessions[session_id] = matcher
        else:
            matcher = sessions[session_id]
        
        # Save to temp using async read
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        file_path = os.path.join(UPLOAD_DIR, f"{session_id}_{dataset_id}_{file.filename}")
        contents = await file.read()
        with open(file_path, "wb") as buffer:
            buffer.write(contents)
            
        # Run blocking file-load in thread pool
        loop = asyncio.get_event_loop()
        columns, rows = await loop.run_in_executor(
            None, lambda: matcher.load_dataset_from_file(dataset_id, file_path, sep=delimiter)
        )
        
        return {
            "session_id": session_id,
            "dataset_id": dataset_id,
            "columns": columns,
            "rows": rows
        }
    except Exception as e:
        logger.exception(f"Matching upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/features/matching/ingest-database")
async def ingest_database_matching(request: dict, current_user: UserInDB = Depends(get_current_user)):
    """Load a dataset from database query for matching"""
    from features.matching import DataMatcher
    from history import _build_connection_string_from_dict
    
    session_id = request.get('session_id')
    dataset_id = request.get('dataset_id')
    connection_id = request.get('connection_id')
    query = request.get('query')
    
    if not all([session_id, dataset_id, connection_id, query]):
        raise HTTPException(status_code=400, detail="session_id, dataset_id, connection_id, and query are required")
        
    conn_data = await db.get_connection(connection_id, current_user.email)
    if not conn_data:
        raise HTTPException(status_code=404, detail="Connection not found")

    try:
        conn_str = _build_connection_string_from_dict(conn_data)
        
        try:
             df = pl.read_database(query, conn_str)
        except:
             engine_db = create_engine(conn_str)
             pdf = pd.read_sql(query, engine_db)
             df = pl.from_pandas(pdf)
             
        if session_id not in sessions:
            matcher = DataMatcher(session_id)
            sessions[session_id] = matcher
        else:
            matcher = sessions[session_id]
            
        matcher.load_dataset(dataset_id, df)
        
        return {
            "session_id": session_id,
            "dataset_id": dataset_id,
            "columns": df.columns,
            "rows": len(df)
        }
    except Exception as e:
        logger.exception(f"Matching database ingest error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/features/matching/preview/{session_id}")
async def preview_matching(session_id: str, config: dict):
    """Preview matching on sample data"""
    from features.matching import DataMatcher
    
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    matcher = sessions[session_id]
    result = await matcher.preview(config, limit=10)
    
    if not result.success:
        raise HTTPException(status_code=400, detail=result.error)
    
    return result.dict()

@app.post("/features/matching/start/{session_id}")
async def start_matching_execution(session_id: str, config: dict, background_tasks: fastapi.BackgroundTasks):
    """Start matching execution in background"""
    from features.matching import DataMatcher
    
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    matcher = sessions[session_id]
    
    # Define wrapper for async execution
    async def run_in_bg():
        await matcher.execute(config)
        
    background_tasks.add_task(run_in_bg)
    
    return {"status": "started", "session_id": session_id}

@app.get("/features/matching/status/{session_id}")
async def get_matching_status(session_id: str):
    """Get matching progress"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    matcher = sessions[session_id]
    return matcher.get_progress()

@app.get("/features/matching/results/{session_id}")
async def get_matching_results(session_id: str):
    """Get final matching results"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
        
    matcher = sessions[session_id]
    results = matcher.get_results()
    
    if results is None:
        # Check if error
        progress = matcher.get_progress()
        if progress['status'] == 'error':
            raise HTTPException(status_code=500, detail=progress['message'])
        return {"ready": False}
        
    return {"ready": True, "results": results[:100], "total_matches": len(results)}

@app.get("/features/matching/download/{session_id}")
async def download_matching_results(session_id: str, fmt: str = "csv"):
    """Download matching results as CSV or Excel.
    Query param: ?fmt=csv (default) or ?fmt=excel
    """
    try:
        if session_id not in sessions:
            raise HTTPException(status_code=404, detail="Session not found")

        matcher = sessions[session_id]

        if fmt == "excel":
            file_path = matcher.export_to_excel()
            if not file_path or not os.path.exists(file_path):
                raise HTTPException(status_code=404, detail="Excel export failed")
            return FileResponse(
                path=file_path,
                filename=f"matching_results_{session_id}.xlsx",
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        else:
            file_path = matcher.export_to_csv()
            if not file_path or not os.path.exists(file_path):
                raise HTTPException(status_code=404, detail="CSV export failed")
            return FileResponse(
                path=file_path,
                filename=f"matching_results_{session_id}.csv",
                media_type="text/csv",
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error in download_matching_results")
        raise HTTPException(status_code=500, detail=str(e))

# Pricing Intelligence Feature
@app.get("/features/pricing/algorithms")
async def get_pricing_algorithms():
    """Get available product matching algorithms for pricing intelligence."""
    from features.pricing import PricingIntelligence

    return {"algorithms": PricingIntelligence.get_available_algorithms()}


@app.get("/features/pricing/strategies")
async def get_pricing_strategies():
    """Get supported pricing strategies."""
    from features.pricing import PricingIntelligence

    return {"strategies": PricingIntelligence.get_available_strategies()}


@app.post("/features/pricing/load-dataset")
async def load_pricing_dataset(payload: dict):
    """Load pricing dataset from JSON payload."""
    from features.pricing import PricingIntelligence

    session_id = payload.get("session_id")
    dataset_id = payload.get("dataset_id")
    data = payload.get("data", [])

    if not session_id or not dataset_id or not data:
        raise HTTPException(status_code=400, detail="session_id, dataset_id, and data are required")

    if session_id not in sessions:
        pricer = PricingIntelligence(session_id)
        sessions[session_id] = pricer
    else:
        pricer = sessions[session_id]

    df = pl.from_dicts(data)
    pricer.load_dataset(dataset_id, df)

    return {
        "session_id": session_id,
        "dataset_id": dataset_id,
        "columns": df.columns,
        "rows": len(df),
    }


@app.post("/features/pricing/upload-dataset")
async def upload_pricing_dataset(
    session_id: str = Form(...),
    dataset_id: str = Form(...),
    delimiter: str = Form(","),
    file: UploadFile = File(...),
):
    """Load pricing dataset from CSV/Excel file."""
    from features.pricing import PricingIntelligence

    try:
        if session_id not in sessions:
            pricer = PricingIntelligence(session_id)
            sessions[session_id] = pricer
        else:
            pricer = sessions[session_id]

        os.makedirs(UPLOAD_DIR, exist_ok=True)
        file_path = os.path.join(UPLOAD_DIR, f"{session_id}_{dataset_id}_{file.filename}")
        contents = await file.read()
        with open(file_path, "wb") as buffer:
            buffer.write(contents)

        loop = asyncio.get_event_loop()
        columns, rows = await loop.run_in_executor(
            None, lambda: pricer.load_dataset_from_file(dataset_id, file_path, sep=delimiter)
        )

        return {
            "session_id": session_id,
            "dataset_id": dataset_id,
            "columns": columns,
            "rows": rows,
        }
    except Exception as e:
        logger.exception(f"Pricing dataset upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/features/pricing/ingest-database")
async def ingest_database_pricing(request: dict, current_user: UserInDB = Depends(get_current_user)):
    """Load a pricing dataset from a saved database connection."""
    from features.pricing import PricingIntelligence
    from history import _build_connection_string_from_dict

    session_id = request.get("session_id")
    dataset_id = request.get("dataset_id")
    connection_id = request.get("connection_id")
    query = request.get("query")

    if not all([session_id, dataset_id, connection_id, query]):
        raise HTTPException(
            status_code=400,
            detail="session_id, dataset_id, connection_id, and query are required",
        )

    conn_data = await db.get_connection(connection_id, current_user.email)
    if not conn_data:
        raise HTTPException(status_code=404, detail="Connection not found")

    try:
        conn_str = _build_connection_string_from_dict(conn_data)

        try:
            df = pl.read_database(query, conn_str)
        except:
            engine_db = create_engine(conn_str)
            pdf = pd.read_sql(query, engine_db)
            df = pl.from_pandas(pdf)

        if session_id not in sessions:
            pricer = PricingIntelligence(session_id)
            sessions[session_id] = pricer
        else:
            pricer = sessions[session_id]

        pricer.load_dataset(dataset_id, df)

        return {
            "session_id": session_id,
            "dataset_id": dataset_id,
            "columns": df.columns,
            "rows": len(df),
        }
    except Exception as e:
        logger.exception(f"Pricing database ingest error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/features/pricing/preview/{session_id}")
async def preview_pricing(session_id: str, config: dict):
    """Preview pricing recommendations for a sample set."""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    pricer = sessions[session_id]
    result = await pricer.preview(config, limit=10)

    if not result.success:
        raise HTTPException(status_code=400, detail=result.error)

    return result.dict()


@app.post("/features/pricing/review/{session_id}")
async def review_pricing_matches(session_id: str, config: dict):
    """Generate a match review report before running the pricing engine."""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    pricer = sessions[session_id]
    result = await pricer.review_matches(config)

    if not result.success:
        raise HTTPException(status_code=400, detail=result.error)

    data = result.data or {}
    review_rows = data.get("review_rows", [])
    summary = data.get("summary", {})
    return {
        "summary": summary,
        "review_rows": review_rows[:300],
        "total_review_rows": len(review_rows),
    }


@app.post("/features/pricing/start/{session_id}")
async def start_pricing_execution(session_id: str, config: dict, background_tasks: fastapi.BackgroundTasks):
    """Start pricing analysis in the background."""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    pricer = sessions[session_id]

    async def run_in_bg():
        await pricer.execute(config)

    background_tasks.add_task(run_in_bg)

    return {"status": "started", "session_id": session_id}


@app.get("/features/pricing/status/{session_id}")
async def get_pricing_status(session_id: str):
    """Get pricing analysis progress."""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    pricer = sessions[session_id]
    return pricer.get_progress()


@app.get("/features/pricing/results/{session_id}")
async def get_pricing_results(session_id: str):
    """Get final pricing recommendations."""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    pricer = sessions[session_id]
    results = pricer.get_results()

    if results is None:
        progress = pricer.get_progress()
        if progress["status"] == "error":
            raise HTTPException(status_code=500, detail=progress["message"])
        return {"ready": False}

    rows = results.get("rows", [])
    summary = results.get("summary", {})
    review_rows = results.get("review_rows", [])
    return {
        "ready": True,
        "summary": summary,
        "rows": rows[:100],
        "review_rows": review_rows[:200],
        "total_rows": len(rows),
        "total_review_rows": len(review_rows),
    }


@app.get("/features/pricing/download/{session_id}")
async def download_pricing_results(session_id: str, fmt: str = "csv"):
    """Download pricing recommendations as CSV or Excel."""
    try:
        if session_id not in sessions:
            raise HTTPException(status_code=404, detail="Session not found")

        pricer = sessions[session_id]

        if fmt == "excel":
            file_path = pricer.export_to_excel()
            if not file_path or not os.path.exists(file_path):
                raise HTTPException(status_code=404, detail="Excel export failed")
            return FileResponse(
                path=file_path,
                filename=f"pricing_results_{session_id}.xlsx",
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )

        file_path = pricer.export_to_csv()
        if not file_path or not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="CSV export failed")
        return FileResponse(
            path=file_path,
            filename=f"pricing_results_{session_id}.csv",
            media_type="text/csv",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error in download_pricing_results")
        raise HTTPException(status_code=500, detail=str(e))

# --- AI Visualizer Feature ---

@app.post("/features/visualizer/upload")
async def visualizer_upload(file: UploadFile = File(...), delimiter: str = Form(",")):
    """Upload a file and create a session for AI visualization analysis."""
    try:
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        contents = await file.read()
        with open(file_path, "wb") as buf:
            buf.write(contents)

        loop = asyncio.get_event_loop()
        engine = ValidationEngine()
        columns = await loop.run_in_executor(
            None, lambda: engine.load_data(file_path=file_path, sep=delimiter)
        )
        sessions[engine.session_id] = engine

        return {
            "session_id": engine.session_id,
            "filename": file.filename,
            "columns": columns,
            "rows": len(engine.df) if engine.df is not None else 0,
        }
    except Exception as e:
        logger.error(f"Visualizer upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/features/visualizer/analyze/{session_id}")
async def visualizer_analyze(session_id: str):
    """Rule-based analysis — backward compatible, no external API."""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    engine = sessions[session_id]
    if engine.df is None:
        raise HTTPException(status_code=400, detail="No data loaded in session")
    try:
        from features.visualizer import analyze
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, lambda: analyze(engine.df))
        return result
    except Exception as e:
        logger.error(f"Visualizer analyze error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/features/visualizer/analyze-ai/{session_id}")
async def visualizer_analyze_ai(session_id: str, body: dict = Body(default={})):
    """
    AI-powered analysis using Qwen/Qwen2.5-72B-Instruct via HuggingFace.
    Body: { "prompt": str, "hf_api_key": str (optional — falls back to HF_API_KEY env var) }
    Falls back to rule-based analysis if the HF call fails.
    """
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    engine = sessions[session_id]
    if engine.df is None:
        raise HTTPException(status_code=400, detail="No data loaded in session")

    user_prompt = body.get("prompt", "")

    # Resolve HF API key: prefer what the client sends, then env vars (same as chatbot.py)
    hf_api_key = (
        body.get("hf_api_key", "")
        or os.getenv("HF_API_KEY", "")
        or os.getenv("VITE_HF_API_KEY", "")
    )

    try:
        from features.visualizer import analyze_with_ai
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None, lambda: analyze_with_ai(engine.df, user_prompt, hf_api_key)
        )
        return result
    except Exception as e:
        logger.error(f"Visualizer AI analyze error: {e}")
        raise HTTPException(status_code=500, detail=str(e))



# --- Pipeline Feature ---

@app.post("/features/pipeline/execute/{session_id}")
async def execute_pipeline(session_id: str, config: dict, current_user: UserInDB = Depends(get_current_user)):
    engine = sessions.get(session_id)
    initial_df = getattr(engine, "df", None) if engine is not None else None
    result = await execute_pipeline_runtime(
        config,
        user_email=current_user.email,
        session_store=sessions,
        session_id=session_id,
        pipeline_id=config.get("pipelineId") or config.get("pipeline_id"),
        trigger="manual",
        initial_df=initial_df,
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Pipeline execution failed"))

    return attach_output_session(result, sessions)


@app.post("/features/pipeline/script-preview/{session_id}")
async def preview_pipeline_script(session_id: str, config: dict, current_user: UserInDB = Depends(get_current_user)):
    target_node_id = str(config.get("targetNodeId") or "").strip()
    if not target_node_id:
        raise HTTPException(status_code=400, detail="Target node ID is required for script preview.")

    engine = sessions.get(session_id)
    initial_df = getattr(engine, "df", None) if engine is not None else None
    orchestrator = PipelineOrchestrator(
        session_id=session_id,
        initial_df=initial_df,
        session_store=sessions,
        user_email=current_user.email,
    )

    capture_result = await orchestrator.execute_graph(
        {
            "pipelineId": config.get("pipelineId") or config.get("pipeline_id"),
            "pipelineName": config.get("pipelineName") or config.get("pipeline_name") or "Untitled Pipeline",
            "nodes": config.get("nodes") or [],
            "edges": config.get("edges") or [],
        },
        capture_inputs_for_node_id=target_node_id,
    )
    if not capture_result.get("success"):
        raise HTTPException(status_code=400, detail=capture_result.get("error", "Unable to resolve script input."))

    captured_inputs = capture_result.get("captured_inputs") or []
    if not captured_inputs:
        raise HTTPException(
            status_code=400,
            detail="Connect a Data Flow input to this script task before running a preview.",
        )

    input_df = captured_inputs[0]
    preview_result = orchestrator.preview_script(
        input_df,
        node_type="script",
        data=config.get("nodeData") or {},
        validate_only=bool(config.get("validateOnly")),
    )

    input_session = create_dataframe_session(input_df, sessions)
    response = {
        "language": preview_result.get("language"),
        "message": preview_result.get("message"),
        "notes": preview_result.get("notes", []),
        "normalized_script": preview_result.get("normalized_script"),
        "input_session_id": input_session["session_id"],
        "input_columns": input_session["columns"],
        "input_row_count": input_session["row_count"],
    }

    if not bool(config.get("validateOnly")):
        output_session = create_dataframe_session(preview_result["output_df"], sessions)
        response.update({
            "output_session_id": output_session["session_id"],
            "output_columns": output_session["columns"],
            "output_row_count": output_session["row_count"],
        })

    return response


@app.post("/features/pipeline/transformer-workspace/{session_id}")
async def resolve_pipeline_transformer_workspace(session_id: str, config: dict, current_user: UserInDB = Depends(get_current_user)):
    target_node_id = str(config.get("targetNodeId") or "").strip()
    if not target_node_id:
        raise HTTPException(status_code=400, detail="Target node ID is required for the transformer workspace.")

    engine = sessions.get(session_id)
    initial_df = getattr(engine, "df", None) if engine is not None else None
    orchestrator = PipelineOrchestrator(
        session_id=session_id,
        initial_df=initial_df,
        session_store=sessions,
        user_email=current_user.email,
    )

    capture_result = await orchestrator.execute_graph(
        {
            "pipelineId": config.get("pipelineId") or config.get("pipeline_id"),
            "pipelineName": config.get("pipelineName") or config.get("pipeline_name") or "Untitled Pipeline",
            "nodes": config.get("nodes") or [],
            "edges": config.get("edges") or [],
        },
        capture_inputs_for_node_id=target_node_id,
    )
    if not capture_result.get("success"):
        raise HTTPException(status_code=400, detail=capture_result.get("error", "Unable to resolve transformer inputs."))

    captured_inputs = capture_result.get("captured_inputs") or []
    if not captured_inputs:
        raise HTTPException(
            status_code=400,
            detail="Connect a Data Flow input to this transformation task before opening the workspace.",
        )

    input_df = captured_inputs[0]
    workspace_session = create_dataframe_session(input_df, sessions)
    transformer = _get_or_create_transformer(workspace_session["session_id"])
    transformer.df = input_df.clone()
    transformer.lookup_datasets = {}

    captured_input_bindings = capture_result.get("captured_input_bindings") or []
    lookup_datasets = []
    for index, binding in enumerate(captured_input_bindings[1:], start=1):
        lookup_df = binding.get("dataframe")
        if not isinstance(lookup_df, pl.DataFrame):
            continue
        lookup_id = str(binding.get("source_node_id") or f"lookup_{index}")
        lookup_name = str(binding.get("source_label") or f"Lookup Dataset {index}")
        transformer.register_lookup(lookup_id, lookup_name, lookup_df.clone())
        lookup_datasets.append({
            "lookup_id": lookup_id,
            "name": lookup_name,
            "columns": lookup_df.columns,
            "rows": len(lookup_df),
            "locked": True,
            "source": "pipeline",
        })

    primary_binding = captured_input_bindings[0] if captured_input_bindings else None
    primary_label = None
    if isinstance(primary_binding, dict):
        primary_label = primary_binding.get("source_label")

    return {
        "session_id": workspace_session["session_id"],
        "columns": workspace_session["columns"],
        "row_count": workspace_session["row_count"],
        "preview_data": input_df.head(200).to_dicts(),
        "primary_input_label": primary_label or "Pipeline Input",
        "lookup_datasets": lookup_datasets,
    }

if __name__ == "__main__":
    import uvicorn
    # Look for Render's PORT first, then fallback to local BACKEND_PORT
    backend_port = int(os.environ.get("PORT", os.environ.get("BACKEND_PORT", "8000")))
    uvicorn.run("main:app", host="0.0.0.0", port=backend_port)
