from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from typing import List
import uuid

from models import (
    ValidationJobCreate, ValidationJob,
    DatabaseConnectionCreate, DatabaseConnection, DatabaseQueryRequest, DatabaseType
)
from auth import get_current_user
from models import UserInDB
from database import db

router = APIRouter(prefix="/history", tags=["history"])

# --- Validation Job History ---

@router.get("/jobs")
async def get_user_jobs(current_user: UserInDB = Depends(get_current_user)) -> List[dict]:
    """Get all validation jobs for the current user"""
    try:
        jobs = await db.get_user_jobs(current_user.email)
        return jobs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/jobs")
async def save_job(job: ValidationJobCreate, current_user: UserInDB = Depends(get_current_user)) -> dict:
    """Save a validation job to history"""
    try:
        job_data = job.model_dump() # Pydantic v2 use model_dump
        job_data["user_email"] = current_user.email
        job_data["created_at"] = datetime.utcnow().isoformat()
        job_data["id"] = str(uuid.uuid4())
        
        await db.save_job(job_data)
        return {"status": "saved", "job_id": job_data["id"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/jobs/{job_id}")
async def get_job(job_id: str, current_user: UserInDB = Depends(get_current_user)) -> dict:
    """Get a specific job by ID"""
    try:
        job = await db.get_job(job_id, current_user.email)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        return job
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Database Connections ---

connections_router = APIRouter(prefix="/connections", tags=["connections"])

@connections_router.get("")
async def get_connections(current_user: UserInDB = Depends(get_current_user)) -> List[dict]:
    """Get all saved database connections for the user"""
    try:
        connections = await db.get_user_connections(current_user.email)
        # Remove sensitive info before returning to frontend
        for conn in connections:
            conn.pop("password", None)
            conn.pop("_id", None)
        return connections
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@connections_router.post("")
async def save_connection(conn: DatabaseConnectionCreate, current_user: UserInDB = Depends(get_current_user)) -> dict:
    """Save a new database connection"""
    try:
        conn_data = conn.model_dump()
        conn_data["user_email"] = current_user.email
        conn_data["created_at"] = datetime.utcnow().isoformat()
        conn_data["id"] = str(uuid.uuid4())
        
        await db.save_connection(conn_data)
        return {"status": "saved", "connection_id": conn_data["id"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@connections_router.delete("/{conn_id}")
async def delete_connection(conn_id: str, current_user: UserInDB = Depends(get_current_user)) -> dict:
    """Delete a saved connection"""
    try:
        await db.delete_connection(conn_id, current_user.email)
        return {"status": "deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@connections_router.post("/test")
async def test_connection(conn: DatabaseConnectionCreate) -> dict:
    """Test a database connection without saving"""
    try:
        success = await _test_db_connection(conn)
        return {"status": "success" if success else "failed"}
    except Exception as e:
        return {"status": "failed", "error": str(e)}

@connections_router.post("/query")
async def run_query(request: DatabaseQueryRequest, current_user: UserInDB = Depends(get_current_user)) -> dict:
    """Run a query on a saved connection and get data for validation"""
    try:
        conn = await db.get_connection(request.connection_id, current_user.email)
        if not conn:
            raise HTTPException(status_code=404, detail="Connection not found")
        
        data = await _execute_query(conn, request.query)
        return {"status": "success", "data": data, "columns": list(data[0].keys()) if data else []}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Helper Functions ---

async def _test_db_connection(conn: DatabaseConnectionCreate) -> bool:
    db_type = conn.db_type.value
    try:
        if db_type == "mssql":
            import pymssql
            connection = pymssql.connect(
                server=conn.host, port=str(conn.port),
                user=conn.username, password=conn.password,
                database=conn.database, timeout=10
            )
            connection.close()
            return True
        else:
            import sqlalchemy
            engine = sqlalchemy.create_engine(_build_connection_string(conn), connect_args={"connect_timeout": 10})
            with engine.connect() as connection:
                connection.execute(sqlalchemy.text("SELECT 1"))
            return True
    except Exception as e:
        raise Exception(f"Connection failed: {str(e)}")

async def _execute_query(conn: dict, query: str) -> List[dict]:
    db_type = conn.get("db_type", "")
    try:
        if db_type == "mssql":
            import pymssql
            connection = pymssql.connect(
                server=conn['host'], port=str(conn['port']),
                user=conn['username'], password=conn['password'],
                database=conn['database'], timeout=30
            )
            cursor = connection.cursor(as_dict=True)
            cursor.execute(query)
            rows = cursor.fetchall()
            connection.close()
            return rows
        else:
            import sqlalchemy
            engine = sqlalchemy.create_engine(_build_connection_string_from_dict(conn))
            with engine.connect() as connection:
                result = connection.execute(sqlalchemy.text(query))
                return [dict(row._mapping) for row in result.fetchall()]
    except Exception as e:
        raise Exception(f"Query failed: {str(e)}")

def _build_connection_string(conn: DatabaseConnectionCreate) -> str:
    # Logic for various DB types...
    return _build_connection_string_from_dict(conn.model_dump())

def _build_connection_string_from_dict(conn: dict) -> str:
    db_type = conn.get("db_type", "")
    u, p, h, port, d = conn.get('username'), conn.get('password'), conn.get('host'), conn.get('port'), conn.get('database')
    
    if db_type == "mssql":
        return f"mssql+pymssql://{u}:{p}@{h}:{port}/{d}"
    elif db_type == "mysql":
        return f"mysql+pymysql://{u}:{p}@{h}:{port}/{d}"
    elif db_type == "postgresql":
        return f"postgresql://{u}:{p}@{h}:{port}/{d}"
    elif db_type == "sqlite":
        return f"sqlite:///{d}"
    raise ValueError(f"Unsupported database type: {db_type}")