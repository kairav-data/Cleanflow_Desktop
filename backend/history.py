from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime
from typing import List
import uuid
from pathlib import Path
import re
from urllib.parse import quote_plus

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

@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str, current_user: UserInDB = Depends(get_current_user)) -> dict:
    """Delete a specific history job for the current user"""
    try:
        deleted = await db.delete_job(current_user.email, job_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Job not found")
        return {"status": "deleted", "count": deleted}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/jobs")
async def clear_jobs(
    module: str = Query(default=None),
    current_user: UserInDB = Depends(get_current_user)
) -> dict:
    """Clear all history jobs for the user, optionally filtered by module"""
    try:
        deleted = await db.clear_user_jobs(current_user.email, module)
        return {"status": "cleared", "count": deleted, "module": module}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Database Connections ---

connections_router = APIRouter(prefix="/connections", tags=["connections"])

@connections_router.get("")
async def get_connections(current_user: UserInDB = Depends(get_current_user)) -> List[dict]:
    """Get all saved database connections for the user"""
    try:
        connections = await db.get_user_connections(current_user.email)
        
        # Convert SQLAlchemy objects to dicts and remove sensitive info
        result = []
        for conn_obj in connections:
            conn = {
                "id": conn_obj.id,
                "name": conn_obj.name,
                "db_type": conn_obj.db_type,
                "host": conn_obj.host,
                "port": conn_obj.port,
                "database": conn_obj.database,
                "username": conn_obj.username,
                "driver_mode": conn_obj.driver_mode or "native",
                "odbc_driver": conn_obj.odbc_driver or "",
                "dsn": conn_obj.dsn or "",
                "created_at": conn_obj.created_at.isoformat() if conn_obj.created_at else None
            }
            result.append(conn)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@connections_router.post("")
async def save_connection(conn: DatabaseConnectionCreate, current_user: UserInDB = Depends(get_current_user)) -> dict:
    """Save a new database connection"""
    try:
        conn_data = conn.model_dump()
        conn_data["db_type"] = conn.db_type.value
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

@connections_router.get("/{conn_id}/tables")
async def get_tables(conn_id: str, current_user: UserInDB = Depends(get_current_user)) -> dict:
    """Get list of tables from a saved connection"""
    try:
        conn = await db.get_connection(conn_id, current_user.email)
        if not conn:
            raise HTTPException(status_code=404, detail="Connection not found")
        
        tables = await _get_tables(conn)
        return {"status": "success", "tables": tables}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Helper Functions ---
async def _get_tables(conn: dict) -> List[str]:
    db_type = conn.get("db_type", "")
    query = ""
    if db_type == "mssql":
        query = "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'"
    elif db_type == "mysql":
        query = "SHOW TABLES"
    elif db_type == "postgresql":
        query = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
    elif db_type == "sqlite":
        query = "SELECT name FROM sqlite_master WHERE type='table'"
    elif db_type == "oracle":
        query = "SELECT object_name FROM all_objects WHERE object_type = 'TABLE'"
    else:
        raise ValueError(f"Retrieving tables not supported for DB type: {db_type}")

    rows = await _execute_query(conn, query)
    
    tables = []
    for row in rows:
        # The column name depends on the DB type, so we just take the first value
        values = list(row.values())
        if values:
            tables.append(str(values[0]))
    
    return tables

async def _test_db_connection(conn: DatabaseConnectionCreate) -> bool:
    try:
        payload = conn.model_dump()
        if _is_odbc_connection(payload):
            connection = _open_odbc_connection(payload, timeout=10)
            connection.close()
            return True

        db_type = conn.db_type.value
        if db_type == "mssql":
            import pymssql
            connection = pymssql.connect(
                server=payload.get("host") or "localhost",
                port=str(payload.get("port") or 1433),
                user=payload.get("username") or "",
                password=payload.get("password") or "",
                database=payload.get("database") or None,
                timeout=10
            )
            connection.close()
            return True

        import sqlalchemy
        engine_kwargs = {}
        if db_type not in {"sqlite", "oracle"}:
            engine_kwargs["connect_args"] = {"connect_timeout": 10}
        engine = sqlalchemy.create_engine(_build_connection_string(conn), **engine_kwargs)
        with engine.connect() as connection:
            connection.execute(sqlalchemy.text("SELECT 1"))
        return True
    except Exception as e:
        raise Exception(f"Connection failed: {str(e)}")

async def _execute_query(conn: dict, query: str) -> List[dict]:
    db_type = conn.get("db_type", "")
    try:
        if _is_odbc_connection(conn):
            connection = _open_odbc_connection(conn, timeout=30)
            try:
                cursor = connection.cursor()
                cursor.execute(query)
                columns = [column[0] for column in (cursor.description or [])]
                rows = cursor.fetchall()
                return [dict(zip(columns, row)) for row in rows]
            finally:
                connection.close()

        if db_type == "mssql":
            import pymssql
            connection = pymssql.connect(
                server=conn.get('host') or 'localhost', port=str(conn.get('port') or 1433),
                user=conn.get('username') or '', password=conn.get('password') or '',
                database=conn.get('database') or None, timeout=30
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

def _normalize_sqlite_path(raw_path: str) -> str:
    cleaned = str(raw_path or "").strip().strip('"').strip("'")
    if not cleaned:
        raise ValueError("SQLite database path is required")

    resolved = Path(cleaned).expanduser()
    try:
        resolved = resolved.resolve(strict=False)
    except Exception:
        pass

    normalized = resolved.as_posix()
    if re.match(r"^[A-Za-z]:/", normalized):
        return f"sqlite:///{normalized}"
    if normalized.startswith("/"):
        return f"sqlite:////{normalized.lstrip('/')}"
    return f"sqlite:///{normalized}"

def _build_connection_string_from_dict(conn: dict) -> str:
    db_type = conn.get("db_type", "")
    u = quote_plus(str(conn.get('username') or ''))
    p = quote_plus(str(conn.get('password') or ''))
    h = str(conn.get('host') or 'localhost').strip()
    port = conn.get('port')
    d = str(conn.get('database') or '').strip()
    
    if db_type == "mssql":
        base = f"mssql+pymssql://{u}:{p}@{h}"
        if port:
            base += f":{port}"
        if d:
            base += f"/{quote_plus(d)}"
        return base
    elif db_type == "mysql":
        base = f"mysql+pymysql://{u}:{p}@{h}"
        if port:
            base += f":{port}"
        if d:
            base += f"/{quote_plus(d)}"
        return base
    elif db_type == "postgresql":
        base = f"postgresql://{u}:{p}@{h}"
        if port:
            base += f":{port}"
        if d:
            base += f"/{quote_plus(d)}"
        return base
    elif db_type == "oracle":
        base = f"oracle+oracledb://{u}:{p}@{h}"
        if port:
            base += f":{port}"
        if d:
            base += f"/?service_name={quote_plus(d)}"
        return base
    elif db_type == "sqlite":
        return _normalize_sqlite_path(d)
    raise ValueError(f"Unsupported database type: {db_type}")

def _is_odbc_connection(conn: dict) -> bool:
    return str(conn.get("driver_mode") or "native").lower() == "odbc"

def _pick_odbc_driver(db_type: str) -> str:
    import pyodbc

    drivers = pyodbc.drivers()
    candidate_map = {
        "mssql": [
            "ODBC Driver 18 for SQL Server",
            "ODBC Driver 17 for SQL Server",
            "SQL Server Native Client 11.0",
            "SQL Server",
        ],
        "mysql": [
            "MySQL ODBC 8.0 Unicode Driver",
            "MySQL ODBC 8.0 ANSI Driver",
            "MySQL ODBC 5.3 Unicode Driver",
        ],
        "postgresql": [
            "PostgreSQL Unicode(x64)",
            "PostgreSQL Unicode",
            "PostgreSQL ANSI(x64)",
            "PostgreSQL ANSI",
        ],
        "oracle": [
            "Oracle in OraClient21Home1",
            "Oracle in OraClient19Home1",
            "Oracle ODBC Driver",
        ],
    }

    for candidate in candidate_map.get(db_type, []):
        if candidate in drivers:
            return candidate
    if drivers:
        return drivers[-1]
    raise ValueError("No ODBC driver was found on this machine.")

def _build_odbc_connection_string(conn: dict) -> str:
    db_type = str(conn.get("db_type") or "").lower()
    dsn = str(conn.get("dsn") or "").strip()
    database = str(conn.get("database") or "").strip()
    username = str(conn.get("username") or "").strip()
    password = str(conn.get("password") or "")

    parts = []
    if dsn:
        parts.append(f"DSN={dsn}")
    else:
        driver = str(conn.get("odbc_driver") or "").strip() or _pick_odbc_driver(db_type)
        host = str(conn.get("host") or "localhost").strip()
        port = conn.get("port")
        server_value = host
        if port:
            if db_type == "mssql":
                server_value = f"{host},{port}"
            else:
                server_value = f"{host}:{port}"
        parts.append(f"DRIVER={{{driver}}}")
        if db_type == "mssql":
            parts.append(f"SERVER={server_value}")
            if database:
                parts.append(f"DATABASE={database}")
        elif db_type in {"postgresql", "mysql"}:
            parts.append(f"SERVER={host}")
            if port:
                parts.append(f"PORT={port}")
            if database:
                parts.append(f"DATABASE={database}")
        elif db_type == "oracle":
            parts.append(f"DBQ={database or server_value}")

    if username:
        parts.append(f"UID={username}")
    parts.append(f"PWD={password}")
    return ";".join(parts)

def _open_odbc_connection(conn: dict, timeout: int = 10):
    import pyodbc

    return pyodbc.connect(_build_odbc_connection_string(conn), timeout=timeout)
