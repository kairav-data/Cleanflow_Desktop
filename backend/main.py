from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
import os
import shutil
import pandas as pd
from sqlalchemy import create_engine
from typing import List

# Internal imports
from models import ValidationConfig, UserInDB
from engine import ValidationEngine, UPLOAD_DIR, RESULTS_DIR
from database import db
from auth import router as auth_router, get_current_user
from history import (
    router as history_router, 
    connections_router, 
    _build_connection_string_from_dict
)
from payment import router as payment_router
# --- Startup/Shutdown Logic ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # This runs when the backend starts
    print("🚀 Backend starting up...")
    try:
        # This triggers the _init_postgres() method in your database.py
        # which creates the tables if they don't exist.
        db._init_postgres() 
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
    yield
    # This runs when the backend shuts down
    print("👋 Backend shutting down...")

# Initialize FastAPI with the lifespan handler
app = FastAPI(
    title="Data Cleaning API", 
    description="API for cleaning and validating data",
    lifespan=lifespan
)

# --- CORS setup ---
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",   # Added Vite default just in case
    "http://127.0.0.1:5173"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth_router)
app.include_router(payment_router)
app.include_router(history_router)
app.include_router(connections_router)

# Store active sessions in memory
sessions = {}

@app.get("/")
def read_root():
    return {"message": "Data Cleaning API is running"}

# --- File Upload Endpoints ---

@app.post("/upload")
async def upload_file(file: UploadFile = File(...), delimiter: str = ","):
    try:
        # Ensure upload directory exists
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        engine = ValidationEngine()
        columns = engine.load_data(file_path=file_path) 
        
        sessions[engine.session_id] = engine
        
        return {
            "session_id": engine.session_id,
            "filename": file.filename,
            "columns": columns
        }
    except Exception as e:
        print(f"Upload Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    

@app.post("/upload-data")
async def upload_data_from_query(payload: dict):
    """Accept data from a database query and create a validation session"""
    try:
        data = payload.get("data", [])
        source = payload.get("source", "Database Query")
        
        if not data:
            raise HTTPException(status_code=400, detail="No data provided")
        
        # Convert to DataFrame
        df = pd.DataFrame(data)
        
        # Initialize engine with DataFrame
        engine = ValidationEngine()
        columns = engine.load_data(dataframe=df)
        
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
        engine_db = create_engine(conn_str)
        df = pd.read_sql(query, engine_db)
        
        # 4. Initialize the ValidationEngine with the resulting dataframe
        engine = ValidationEngine()
        columns = engine.load_data(dataframe=df)
        
        # 5. Store session
        sessions[engine.session_id] = engine
        
        return {
            "session_id": engine.session_id,
            "filename": f"DB: {conn_data.get('name', 'Remote DB')}",
            "columns": columns
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
        engine.df = pd.DataFrame(result.data)
    
    return result.dict()

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
        df = pd.DataFrame(result.data)
        engine.load_data(dataframe=df)
        sessions[engine.session_id] = engine
        
        return {
            **result.dict(),
            "session_id": engine.session_id,
            "columns": list(df.columns)
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
        engine.df = pd.DataFrame(result.data)
    
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
    df = pd.DataFrame(data)
    matcher.load_dataset(dataset_id, df)
    
    return {
        "session_id": session_id,
        "dataset_id": dataset_id,
        "columns": list(df.columns),
        "rows": len(df)
    }

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

@app.post("/features/matching/execute/{session_id}")
async def execute_matching(session_id: str, config: dict):
    """Execute matching on full datasets"""
    from features.matching import DataMatcher
    
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    matcher = sessions[session_id]
    result = await matcher.execute(config)
    
    if not result.success:
        raise HTTPException(status_code=400, detail=result.error)
    
    return result.dict()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)