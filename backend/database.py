import os
import time
import uuid
import sys
from sqlalchemy import create_engine, Column, Integer, String, Boolean, Text, DateTime, Float, text, ForeignKey
from sqlalchemy.orm import sessionmaker, declarative_base, relationship, joinedload
from datetime import datetime
import json

from pipeline_schedule_utils import (
    compute_next_run_at,
    normalize_day_of_week,
    normalize_frequency,
    normalize_timezone_name,
    parse_run_time,
)

# --- Docker Connection Config ---
PG_URL = os.getenv("DATABASE_URL", "postgresql://user:password@postgres:5432/cleanflow_db")

Base = declarative_base()

# --- PostgreSQL Schema ---

class UserPG(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    full_name = Column(String, nullable=True)
    phone_number = Column(String, nullable=True)
    professional_field = Column(String, nullable=True)
    country = Column(String, nullable=True)
    company_name = Column(String, nullable=True)
    hashed_password = Column(String)
    is_premium = Column(Boolean, default=False)
    is_verified = Column(Boolean, default=False)
    otp = Column(String, nullable=True)
    otp_created_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    # Relationships
    jobs = relationship("ValidationJob", back_populates="owner")
    connections = relationship("DbConnection", back_populates="owner")
    saved_pipelines = relationship("SavedPipeline", back_populates="owner")
    pipeline_schedules = relationship("PipelineSchedule", back_populates="owner")
    pipeline_runs = relationship("PipelineRun", back_populates="owner")

class ValidationJob(Base):
    __tablename__ = "validation_jobs"
    id = Column(String, primary_key=True)  # Using UUID string
    user_email = Column(String, ForeignKey("users.email"))
    filename = Column(String)
    status = Column(String)
    rules = Column(Text, nullable=True)
    module = Column(String, default="validation")
    total_rows = Column(Integer, default=0)
    valid_rows = Column(Integer, default=0)
    invalid_rows = Column(Integer, default=0)
    column_stats = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    # Relationship back to user
    owner = relationship("UserPG", back_populates="jobs")

class DbConnection(Base):
    __tablename__ = "db_connections"
    id = Column(String, primary_key=True)
    user_email = Column(String, ForeignKey("users.email"))
    name = Column(String)
    db_type = Column(String)
    host = Column(String)
    port = Column(Integer)
    database = Column(String)
    username = Column(String)
    password = Column(String) # Encrypt in production
    created_at = Column(DateTime, default=datetime.utcnow)
    # Relationship back to user
    owner = relationship("UserPG", back_populates="connections")


class QualityValidationRuleRepoPG(Base):
    """Global shared validation rule sets — any user can read; authors can delete their own."""
    __tablename__ = "quality_validation_rule_repo"
    id = Column(String, primary_key=True)          # UUID string
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    severity = Column(String, nullable=True)
    space = Column(String, nullable=True)
    category = Column(String, nullable=True)
    logic_type = Column(String, nullable=True)
    use_for_validation = Column(Boolean, default=True)
    definition = Column(Text, nullable=True)
    rules = Column(Text, nullable=False)            # JSON array
    author_email = Column(String, nullable=True)
    author_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)


class CleaningOperationRepoPG(Base):
    """Global shared cleaning operation sets — any user can read; authors can delete their own."""
    __tablename__ = "cleaning_operation_repo"
    id = Column(String, primary_key=True)          # UUID string
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    severity = Column(String, nullable=True)
    space = Column(String, nullable=True)
    category = Column(String, nullable=True)
    operation_kind = Column(String, nullable=True)
    definition = Column(Text, nullable=True)
    operations = Column(Text, nullable=False)       # JSON array
    author_email = Column(String, nullable=True)
    author_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)


# ─── Pipeline Tables ────────────────────────────────────────────────────────

class SavedPipeline(Base):
    """A named, serialised pipeline (nodes + edges) saved by a user."""
    __tablename__ = "saved_pipelines"
    id = Column(String, primary_key=True)          # UUID string
    user_email = Column(String, ForeignKey("users.email"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    nodes = Column(Text, nullable=False)            # JSON array of node objects
    edges = Column(Text, nullable=False)            # JSON array of edge objects
    tags = Column(String, nullable=True)            # comma-separated tags
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    # Relationships
    owner = relationship("UserPG", back_populates="saved_pipelines")
    schedules = relationship("PipelineSchedule", back_populates="pipeline", cascade="all, delete-orphan")
    runs = relationship("PipelineRun", back_populates="pipeline", cascade="all, delete-orphan")


class PipelineSchedule(Base):
    """A recurring schedule attached to a saved pipeline."""
    __tablename__ = "pipeline_schedules"
    id = Column(String, primary_key=True)          # UUID string
    pipeline_id = Column(String, ForeignKey("saved_pipelines.id"), nullable=False)
    user_email = Column(String, ForeignKey("users.email"), nullable=False)
    schedule_name = Column(String, nullable=False)
    frequency = Column(String, nullable=False)      # Hourly | Daily | Weekly | Monthly
    run_time = Column(String, nullable=False)       # HH:MM
    day_of_week = Column(String, nullable=True)     # Mon–Sun (for Weekly)
    day_of_month = Column(Integer, nullable=True)   # 1–31 (for Monthly)
    timezone = Column(String, default="UTC")
    is_active = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)
    last_run_at = Column(DateTime, nullable=True)
    next_run_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    # Relationships
    owner = relationship("UserPG", back_populates="pipeline_schedules")
    pipeline = relationship("SavedPipeline", back_populates="schedules")


class PipelineRun(Base):
    """An execution record for a pipeline run (manual or scheduled)."""
    __tablename__ = "pipeline_runs"
    id = Column(String, primary_key=True)          # UUID string
    pipeline_id = Column(String, ForeignKey("saved_pipelines.id"), nullable=True)
    user_email = Column(String, ForeignKey("users.email"), nullable=False)
    pipeline_name = Column(String, nullable=False)
    trigger = Column(String, default="manual")      # manual | scheduled
    status = Column(String, default="running")      # running | completed | failed
    node_count = Column(Integer, default=0)
    logs = Column(Text, nullable=True)              # JSON array of log objects
    output_file = Column(String, nullable=True)     # download path
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Float, nullable=True)
    # Relationships
    owner = relationship("UserPG", back_populates="pipeline_runs")
    pipeline = relationship("SavedPipeline", back_populates="runs")


class DatabaseManager:
    def __init__(self):
        engine_kwargs = {"pool_pre_ping": True}
        if PG_URL.startswith("postgresql"):
            engine_kwargs["connect_args"] = {
                "connect_timeout": int(os.getenv("DATABASE_CONNECT_TIMEOUT", "5"))
            }
        self.pg_engine = create_engine(PG_URL, **engine_kwargs)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.pg_engine)

    def _init_postgres(self):
        retries = int(os.getenv("DATABASE_INIT_RETRIES", "3" if getattr(sys, "frozen", False) else "10"))
        while retries > 0:
            try:
                with self.pg_engine.connect() as conn:
                    conn.execute(text("SELECT 1"))
                Base.metadata.create_all(bind=self.pg_engine)
                
                # --- Quick migrations for missing columns in dev ---
                migration_queries = [
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();",
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;",
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS otp VARCHAR;",
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_created_at TIMESTAMP;",
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR;",
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS professional_field VARCHAR;",
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR;",
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS company_name VARCHAR;",
                    "ALTER TABLE validation_jobs ADD COLUMN IF NOT EXISTS rules TEXT;",
                    "ALTER TABLE validation_jobs ADD COLUMN IF NOT EXISTS module VARCHAR DEFAULT 'validation';",
                    "ALTER TABLE validation_jobs ADD COLUMN IF NOT EXISTS total_rows INTEGER DEFAULT 0;",
                    "ALTER TABLE validation_jobs ADD COLUMN IF NOT EXISTS valid_rows INTEGER DEFAULT 0;",
                    "ALTER TABLE validation_jobs ADD COLUMN IF NOT EXISTS invalid_rows INTEGER DEFAULT 0;",
                    "ALTER TABLE validation_jobs ADD COLUMN IF NOT EXISTS column_stats TEXT;",
                    "ALTER TABLE quality_validation_rule_repo ADD COLUMN IF NOT EXISTS severity VARCHAR;",
                    "ALTER TABLE quality_validation_rule_repo ADD COLUMN IF NOT EXISTS space VARCHAR;",
                    "ALTER TABLE quality_validation_rule_repo ADD COLUMN IF NOT EXISTS category VARCHAR;",
                    "ALTER TABLE quality_validation_rule_repo ADD COLUMN IF NOT EXISTS logic_type VARCHAR;",
                    "ALTER TABLE quality_validation_rule_repo ADD COLUMN IF NOT EXISTS use_for_validation BOOLEAN DEFAULT TRUE;",
                    "ALTER TABLE quality_validation_rule_repo ADD COLUMN IF NOT EXISTS definition TEXT;",
                    "ALTER TABLE quality_validation_rule_repo ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();",
                    "ALTER TABLE cleaning_operation_repo ADD COLUMN IF NOT EXISTS severity VARCHAR;",
                    "ALTER TABLE cleaning_operation_repo ADD COLUMN IF NOT EXISTS space VARCHAR;",
                    "ALTER TABLE cleaning_operation_repo ADD COLUMN IF NOT EXISTS category VARCHAR;",
                    "ALTER TABLE cleaning_operation_repo ADD COLUMN IF NOT EXISTS operation_kind VARCHAR;",
                    "ALTER TABLE cleaning_operation_repo ADD COLUMN IF NOT EXISTS definition TEXT;",
                    "ALTER TABLE cleaning_operation_repo ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();",
                    """CREATE TABLE IF NOT EXISTS quality_validation_rule_repo (
                        id VARCHAR PRIMARY KEY,
                        name VARCHAR NOT NULL,
                        description TEXT,
                        severity VARCHAR,
                        space VARCHAR,
                        category VARCHAR,
                        logic_type VARCHAR,
                        use_for_validation BOOLEAN DEFAULT TRUE,
                        definition TEXT,
                        rules TEXT NOT NULL,
                        author_email VARCHAR,
                        author_name VARCHAR,
                        created_at TIMESTAMP DEFAULT NOW(),
                        updated_at TIMESTAMP DEFAULT NOW()
                    );""",
                    """CREATE TABLE IF NOT EXISTS cleaning_operation_repo (
                        id VARCHAR PRIMARY KEY,
                        name VARCHAR NOT NULL,
                        description TEXT,
                        severity VARCHAR,
                        space VARCHAR,
                        category VARCHAR,
                        operation_kind VARCHAR,
                        definition TEXT,
                        operations TEXT NOT NULL,
                        author_email VARCHAR,
                        author_name VARCHAR,
                        created_at TIMESTAMP DEFAULT NOW(),
                        updated_at TIMESTAMP DEFAULT NOW()
                    );""",
                    # --- Pipeline tables ---
                    """CREATE TABLE IF NOT EXISTS saved_pipelines (
                        id VARCHAR PRIMARY KEY,
                        user_email VARCHAR NOT NULL REFERENCES users(email) ON DELETE CASCADE,
                        name VARCHAR NOT NULL,
                        description TEXT,
                        nodes TEXT NOT NULL,
                        edges TEXT NOT NULL,
                        tags VARCHAR,
                        is_active BOOLEAN DEFAULT TRUE,
                        created_at TIMESTAMP DEFAULT NOW(),
                        updated_at TIMESTAMP DEFAULT NOW()
                    );""",
                    """CREATE TABLE IF NOT EXISTS pipeline_schedules (
                        id VARCHAR PRIMARY KEY,
                        pipeline_id VARCHAR NOT NULL REFERENCES saved_pipelines(id) ON DELETE CASCADE,
                        user_email VARCHAR NOT NULL REFERENCES users(email) ON DELETE CASCADE,
                        schedule_name VARCHAR NOT NULL,
                        frequency VARCHAR NOT NULL,
                        run_time VARCHAR NOT NULL,
                        day_of_week VARCHAR,
                        day_of_month INTEGER,
                        timezone VARCHAR DEFAULT 'UTC',
                        is_active BOOLEAN DEFAULT TRUE,
                        notes TEXT,
                        last_run_at TIMESTAMP,
                        next_run_at TIMESTAMP,
                        created_at TIMESTAMP DEFAULT NOW()
                    );""",
                    """CREATE TABLE IF NOT EXISTS pipeline_runs (
                        id VARCHAR PRIMARY KEY,
                        pipeline_id VARCHAR REFERENCES saved_pipelines(id) ON DELETE SET NULL,
                        user_email VARCHAR NOT NULL REFERENCES users(email) ON DELETE CASCADE,
                        pipeline_name VARCHAR NOT NULL,
                        trigger VARCHAR DEFAULT 'manual',
                        status VARCHAR DEFAULT 'running',
                        node_count INTEGER DEFAULT 0,
                        logs TEXT,
                        output_file VARCHAR,
                        error_message TEXT,
                        started_at TIMESTAMP DEFAULT NOW(),
                        finished_at TIMESTAMP,
                        duration_seconds FLOAT
                    );""",
                    # Safe column additions for pipeline tables in case they already exist
                    "ALTER TABLE saved_pipelines ADD COLUMN IF NOT EXISTS tags VARCHAR;",
                    "ALTER TABLE saved_pipelines ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;",
                    "ALTER TABLE saved_pipelines ADD COLUMN IF NOT EXISTS description TEXT;",
                    "ALTER TABLE pipeline_runs ADD COLUMN IF NOT EXISTS duration_seconds FLOAT;",
                    "ALTER TABLE pipeline_runs ADD COLUMN IF NOT EXISTS error_message TEXT;",
                    "ALTER TABLE pipeline_schedules ADD COLUMN IF NOT EXISTS timezone VARCHAR DEFAULT 'UTC';",
                    "ALTER TABLE pipeline_schedules ADD COLUMN IF NOT EXISTS notes TEXT;",
                    "ALTER TABLE pipeline_schedules ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMP;",
                    "ALTER TABLE pipeline_schedules ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMP;",
                    "CREATE INDEX IF NOT EXISTS idx_pipeline_schedules_active_next_run ON pipeline_schedules (is_active, next_run_at);",
                ]
                
                for query in migration_queries:
                    try:
                        with self.pg_engine.begin() as conn:
                            conn.execute(text(query))
                    except Exception as e:
                        pass
                
                print("PostgreSQL initialized and tables verified.")
                return
            except Exception as e:
                print(f"Postgres not ready ({retries} retries left): {e}")
                retries -= 1
                time.sleep(5)

    # --- User Management ---
    async def create_user(self, user_data: dict):
        db = self.SessionLocal()
        try:
            db_user = UserPG(
                email=user_data['email'],
                full_name=user_data.get('full_name'),
                phone_number=user_data.get('phone_number'),
                professional_field=user_data.get('professional_field'),
                country=user_data.get('country'),
                company_name=user_data.get('company_name'),
                hashed_password=user_data['hashed_password'],
                is_premium=user_data.get('is_premium', False),
                is_verified=False
            )
            db.add(db_user)
            db.commit()
        finally:
            db.close()

    async def get_user(self, email: str):
        db = self.SessionLocal()
        user = db.query(UserPG).filter(UserPG.email == email).first()
        db.close()
        if user:
            return {
                "email": user.email,
                "full_name": user.full_name,
                "phone_number": user.phone_number,
                "professional_field": user.professional_field,
                "country": user.country,
                "company_name": user.company_name,
                "hashed_password": user.hashed_password,
                "is_premium": user.is_premium,
                "is_verified": user.is_verified,
                "otp": user.otp,
                "otp_created_at": user.otp_created_at,
                "created_at": user.created_at.isoformat() if getattr(user, "created_at", None) else None
            }
        return None

    async def upgrade_user(self, email: str):
        db = self.SessionLocal()
        user = db.query(UserPG).filter(UserPG.email == email).first()
        if user:
            user.is_premium = True
            db.commit()
        db.close()
        
    async def update_user_otp(self, email: str, otp: str, created_at: datetime):
        db = self.SessionLocal()
        user = db.query(UserPG).filter(UserPG.email == email).first()
        if user:
            user.otp = otp
            user.otp_created_at = created_at
            db.commit()
        db.close()
        
    async def verify_user(self, email: str):
        db = self.SessionLocal()
        user = db.query(UserPG).filter(UserPG.email == email).first()
        if user:
            user.is_verified = True
            user.otp = None
            db.commit()
        db.close()

    # --- Job History ---
    async def save_job(self, job_data: dict):
        db = self.SessionLocal()
        try:
            job = ValidationJob(
                id=job_data['id'],
                user_email=job_data['user_email'],
                filename=job_data.get('filename') or job_data.get('file_name', 'unknown'),
                status=job_data.get('status', 'completed'),
                rules=json.dumps(job_data.get('rules')) if job_data.get('rules') else None,
                module=job_data.get('module', 'validation'),
                total_rows=job_data.get('total_rows', 0),
                valid_rows=job_data.get('valid_rows', 0),
                invalid_rows=job_data.get('invalid_rows', 0),
                column_stats=json.dumps(job_data.get('column_stats')) if job_data.get('column_stats') else None
            )
            db.add(job)
            db.commit()
        finally:
            db.close()

    async def get_user_jobs(self, email: str):
        db = self.SessionLocal()
        jobs = db.query(ValidationJob).filter(ValidationJob.user_email == email).order_by(ValidationJob.created_at.desc()).all()
        result = [
            {
                "id": j.id, 
                "filename": j.filename, 
                "created_at": j.created_at, 
                "rules": json.loads(j.rules) if j.rules else [],
                "module": getattr(j, "module", "validation") or "validation",
                "total_rows": getattr(j, "total_rows", 0) or 0,
                "valid_rows": getattr(j, "valid_rows", 0) or 0,
                "invalid_rows": getattr(j, "invalid_rows", 0) or 0,
                "column_stats": json.loads(getattr(j, "column_stats", "{}") or "{}") if getattr(j, "column_stats", None) else {}
            } 
            for j in jobs
        ]
        db.close()
        return result

    async def delete_job(self, email: str, job_id: str):
        db = self.SessionLocal()
        try:
            deleted = db.query(ValidationJob).filter(
                ValidationJob.user_email == email,
                ValidationJob.id == job_id
            ).delete()
            db.commit()
            return deleted
        finally:
            db.close()

    async def clear_user_jobs(self, email: str, module: str = None):
        db = self.SessionLocal()
        try:
            query = db.query(ValidationJob).filter(ValidationJob.user_email == email)
            if module:
                query = query.filter(ValidationJob.module == module)
            deleted = query.delete()
            db.commit()
            return deleted
        finally:
            db.close()

    # --- Global Validation Rule Repo ---

    async def create_rule_repo(self, data: dict):
        db = self.SessionLocal()
        try:
            entry = QualityValidationRuleRepoPG(
                id=data['id'],
                name=data['name'],
                description=data.get('description', ''),
                severity=data.get('severity', 'Standard'),
                space=data.get('space', 'Global Repository'),
                category=data.get('category', 'Validity'),
                logic_type=data.get('logic_type', 'condition'),
                use_for_validation=data.get('use_for_validation', True),
                definition=json.dumps(data.get('definition') or {}),
                rules=json.dumps(data.get('rules', [])),
                author_email=data.get('author_email'),
                author_name=data.get('author_name'),
                updated_at=datetime.utcnow(),
            )
            db.add(entry)
            db.commit()
        finally:
            db.close()

    async def get_all_rule_repos(self):
        db = self.SessionLocal()
        rows = db.query(QualityValidationRuleRepoPG).order_by(QualityValidationRuleRepoPG.created_at.desc()).all()
        result = [
            {
                "id": r.id,
                "name": r.name,
                "description": r.description or '',
                "severity": r.severity or 'Standard',
                "space": r.space or 'Global Repository',
                "category": r.category or 'Validity',
                "logic_type": r.logic_type or 'condition',
                "use_for_validation": True if r.use_for_validation is None else bool(r.use_for_validation),
                "definition": json.loads(r.definition) if r.definition else {},
                "rules": json.loads(r.rules) if r.rules else [],
                "author_email": r.author_email or '',
                "author_name": r.author_name or 'Anonymous',
                "created_at": r.created_at.isoformat() if r.created_at else '',
                "updated_at": (r.updated_at or r.created_at).isoformat() if (r.updated_at or r.created_at) else ''
            }
            for r in rows
        ]
        db.close()
        return result

    async def delete_rule_repo(self, repo_id: str, email: str):
        db = self.SessionLocal()
        try:
            deleted = db.query(QualityValidationRuleRepoPG).filter(
                QualityValidationRuleRepoPG.id == repo_id,
                QualityValidationRuleRepoPG.author_email == email
            ).delete()
            db.commit()
            return deleted
        finally:
            db.close()

    # --- Global Cleaning Operation Repo ---

    async def create_cleaning_op_repo(self, data: dict):
        db = self.SessionLocal()
        try:
            entry = CleaningOperationRepoPG(
                id=data['id'],
                name=data['name'],
                description=data.get('description', ''),
                severity=data.get('severity', 'Standard'),
                space=data.get('space', 'Global Repository'),
                category=data.get('category', 'Standardization'),
                operation_kind=data.get('operation_kind', 'replace_value'),
                definition=json.dumps(data.get('definition') or {}),
                operations=json.dumps(data.get('operations', [])),
                author_email=data.get('author_email'),
                author_name=data.get('author_name'),
                updated_at=datetime.utcnow(),
            )
            db.add(entry)
            db.commit()
        finally:
            db.close()

    async def get_all_cleaning_op_repos(self):
        db = self.SessionLocal()
        rows = db.query(CleaningOperationRepoPG).order_by(CleaningOperationRepoPG.created_at.desc()).all()
        result = [
            {
                "id": r.id,
                "name": r.name,
                "description": r.description or '',
                "severity": r.severity or 'Standard',
                "space": r.space or 'Global Repository',
                "category": r.category or 'Standardization',
                "operation_kind": r.operation_kind or 'replace_value',
                "definition": json.loads(r.definition) if r.definition else {},
                "operations": json.loads(r.operations) if r.operations else [],
                "author_email": r.author_email or '',
                "author_name": r.author_name or 'Anonymous',
                "created_at": r.created_at.isoformat() if r.created_at else '',
                "updated_at": (r.updated_at or r.created_at).isoformat() if (r.updated_at or r.created_at) else ''
            }
            for r in rows
        ]
        db.close()
        return result

    async def delete_cleaning_op_repo(self, repo_id: str, email: str):
        db = self.SessionLocal()
        try:
            deleted = db.query(CleaningOperationRepoPG).filter(
                CleaningOperationRepoPG.id == repo_id,
                CleaningOperationRepoPG.author_email == email
            ).delete()
            db.commit()
            return deleted
        finally:
            db.close()

    # --- Connections ---
    async def save_connection(self, conn_data: dict):
        db = self.SessionLocal()
        try:
            new_conn = DbConnection(
                id=conn_data['id'],
                user_email=conn_data['user_email'],
                name=conn_data['name'],
                db_type=conn_data['db_type'],
                host=conn_data['host'],
                port=int(conn_data['port']),
                database=conn_data['database'],
                username=conn_data['username'],
                password=conn_data['password']
            )
            db.add(new_conn)
            db.commit()
        finally:
            db.close()

    async def get_user_connections(self, email: str):
        db = self.SessionLocal()
        conns = db.query(DbConnection).filter(DbConnection.user_email == email).all()
        db.close()
        return conns

    async def get_connection(self, conn_id: str, getattr_email: str = None):
        db = self.SessionLocal()
        query = db.query(DbConnection).filter(DbConnection.id == conn_id)
        if getattr_email:
            query = query.filter(DbConnection.user_email == getattr_email)
        conn = query.first()
        db.close()
        if conn:
            return {
                "id": conn.id,
                "name": conn.name,
                "db_type": conn.db_type,
                "host": conn.host,
                "port": conn.port,
                "database": conn.database,
                "username": conn.username,
                "password": conn.password
            }
        return None

    # ─── Saved Pipelines ──────────────────────────────────────────────────────

    def _normalize_run_time(self, value: str) -> str:
        hour, minute = parse_run_time(value)
        return f"{hour:02d}:{minute:02d}"

    def _serialize_schedule(self, row: PipelineSchedule) -> dict:
        pipeline_name = row.pipeline.name if getattr(row, "pipeline", None) is not None else ""
        def _utc_iso(dt):
            """Return an ISO-8601 string with a trailing 'Z' so browsers parse it as UTC."""
            return dt.isoformat() + 'Z' if dt else None
        return {
            'id': row.id,
            'pipeline_id': row.pipeline_id,
            'pipeline_name': pipeline_name,
            'schedule_name': row.schedule_name,
            'frequency': row.frequency,
            'run_time': row.run_time,
            'day_of_week': row.day_of_week or '',
            'day_of_month': row.day_of_month,
            'timezone': row.timezone or 'UTC',
            'is_active': bool(row.is_active),
            'notes': row.notes or '',
            'last_run_at': _utc_iso(row.last_run_at),
            'next_run_at': _utc_iso(row.next_run_at),
            'created_at': _utc_iso(row.created_at) or '',
        }

    def _serialize_pipeline_run(self, row: PipelineRun) -> dict:
        return {
            'id': row.id,
            'pipeline_id': row.pipeline_id,
            'pipeline_name': row.pipeline_name,
            'trigger': row.trigger or 'manual',
            'status': row.status,
            'node_count': row.node_count or 0,
            'logs': json.loads(row.logs) if row.logs else [],
            'output_file': row.output_file,
            'error_message': row.error_message,
            'started_at': row.started_at.isoformat() if row.started_at else '',
            'finished_at': row.finished_at.isoformat() if row.finished_at else None,
            'duration_seconds': row.duration_seconds,
        }

    async def save_pipeline(self, data: dict):
        db = self.SessionLocal()
        try:
            existing = db.query(SavedPipeline).filter(
                SavedPipeline.id == data.get('id', ''),
                SavedPipeline.user_email == data['user_email']
            ).first()
            if existing:
                existing.name = data.get('name', existing.name)
                existing.description = data.get('description', existing.description)
                existing.nodes = json.dumps(data.get('nodes', []))
                existing.edges = json.dumps(data.get('edges', []))
                existing.tags = data.get('tags', existing.tags)
                existing.updated_at = datetime.utcnow()
                db.commit()
                return existing.id
            else:
                pipeline_id = data.get('id') or str(uuid.uuid4())
                entry = SavedPipeline(
                    id=pipeline_id,
                    user_email=data['user_email'],
                    name=data['name'],
                    description=data.get('description', ''),
                    nodes=json.dumps(data.get('nodes', [])),
                    edges=json.dumps(data.get('edges', [])),
                    tags=data.get('tags', ''),
                    is_active=True,
                    updated_at=datetime.utcnow(),
                )
                db.add(entry)
                db.commit()
                return pipeline_id
        finally:
            db.close()

    async def get_user_pipelines(self, email: str):
        db = self.SessionLocal()
        rows = db.query(SavedPipeline).filter(
            SavedPipeline.user_email == email,
            SavedPipeline.is_active == True
        ).order_by(SavedPipeline.updated_at.desc()).all()
        result = [
            {
                'id': r.id,
                'name': r.name,
                'description': r.description or '',
                'nodes': json.loads(r.nodes) if r.nodes else [],
                'edges': json.loads(r.edges) if r.edges else [],
                'tags': r.tags or '',
                'created_at': r.created_at.isoformat() if r.created_at else '',
                'updated_at': r.updated_at.isoformat() if r.updated_at else '',
            }
            for r in rows
        ]
        db.close()
        return result

    async def get_pipeline(self, pipeline_id: str, email: str):
        db = self.SessionLocal()
        row = db.query(SavedPipeline).filter(
            SavedPipeline.id == pipeline_id,
            SavedPipeline.user_email == email
        ).first()
        db.close()
        if row:
            return {
                'id': row.id,
                'name': row.name,
                'description': row.description or '',
                'nodes': json.loads(row.nodes) if row.nodes else [],
                'edges': json.loads(row.edges) if row.edges else [],
                'tags': row.tags or '',
                'created_at': row.created_at.isoformat() if row.created_at else '',
                'updated_at': row.updated_at.isoformat() if row.updated_at else '',
            }
        return None

    async def delete_pipeline(self, pipeline_id: str, email: str):
        db = self.SessionLocal()
        try:
            deleted = db.query(SavedPipeline).filter(
                SavedPipeline.id == pipeline_id,
                SavedPipeline.user_email == email
            ).delete()
            db.commit()
            return deleted
        finally:
            db.close()

    # ─── Pipeline Schedules ───────────────────────────────────────────────────

    async def save_schedule(self, data: dict):
        db = self.SessionLocal()
        try:
            normalized_frequency = normalize_frequency(data.get('frequency'))
            normalized_run_time = self._normalize_run_time(data.get('run_time'))
            normalized_timezone = normalize_timezone_name(data.get('timezone', 'UTC'))
            normalized_day_of_week = normalize_day_of_week(data.get('day_of_week')) if data.get('day_of_week') else None
            normalized_day_of_month = int(data['day_of_month']) if data.get('day_of_month') is not None else None
            existing = None

            if data.get('id'):
                existing = db.query(PipelineSchedule).filter(
                    PipelineSchedule.id == data['id'],
                    PipelineSchedule.user_email == data['user_email']
                ).first()

            if normalized_frequency != 'Weekly':
                normalized_day_of_week = None
            if normalized_frequency != 'Monthly':
                normalized_day_of_month = None

            if 'is_active' in data:
                is_active = bool(data.get('is_active'))
            elif existing is not None:
                is_active = bool(existing.is_active)
            else:
                is_active = True

            next_run_at = compute_next_run_at(
                normalized_frequency,
                normalized_run_time,
                normalized_timezone,
                normalized_day_of_week,
                normalized_day_of_month,
            ) if is_active else None

            if existing is not None:
                existing.pipeline_id = data['pipeline_id']
                existing.schedule_name = data['schedule_name']
                existing.frequency = normalized_frequency
                existing.run_time = normalized_run_time
                existing.day_of_week = normalized_day_of_week
                existing.day_of_month = normalized_day_of_month
                existing.timezone = normalized_timezone
                existing.is_active = is_active
                existing.notes = data.get('notes', existing.notes or '')
                existing.next_run_at = next_run_at
                db.commit()
                return existing.id

            schedule_id = data.get('id') or str(uuid.uuid4())
            entry = PipelineSchedule(
                id=schedule_id,
                pipeline_id=data['pipeline_id'],
                user_email=data['user_email'],
                schedule_name=data['schedule_name'],
                frequency=normalized_frequency,
                run_time=normalized_run_time,
                day_of_week=normalized_day_of_week,
                day_of_month=normalized_day_of_month,
                timezone=normalized_timezone,
                is_active=is_active,
                notes=data.get('notes', ''),
                next_run_at=next_run_at,
            )
            db.add(entry)
            db.commit()
            return schedule_id
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    async def get_pipeline_schedules(self, pipeline_id: str, email: str):
        db = self.SessionLocal()
        rows = db.query(PipelineSchedule).options(joinedload(PipelineSchedule.pipeline)).filter(
            PipelineSchedule.pipeline_id == pipeline_id,
            PipelineSchedule.user_email == email
        ).order_by(PipelineSchedule.created_at.desc()).all()
        result = [self._serialize_schedule(r) for r in rows]
        db.close()
        return result

    async def get_all_user_schedules(self, email: str):
        db = self.SessionLocal()
        rows = db.query(PipelineSchedule).options(joinedload(PipelineSchedule.pipeline)).filter(
            PipelineSchedule.user_email == email
        ).order_by(PipelineSchedule.created_at.desc()).all()
        result = [self._serialize_schedule(r) for r in rows]
        db.close()
        return result

    async def initialize_schedule_next_runs(self):
        db = self.SessionLocal()
        try:
            rows = db.query(PipelineSchedule).filter(
                PipelineSchedule.is_active == True,
                PipelineSchedule.next_run_at.is_(None)
            ).all()
            changed = 0
            for row in rows:
                row.next_run_at = compute_next_run_at(
                    row.frequency,
                    row.run_time,
                    row.timezone or 'UTC',
                    row.day_of_week,
                    row.day_of_month,
                )
                changed += 1

            if changed:
                db.commit()
            return changed
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    async def claim_due_schedules(self, limit: int = 10):
        db = self.SessionLocal()
        try:
            now = datetime.utcnow()
            rows = db.query(PipelineSchedule).options(joinedload(PipelineSchedule.pipeline)).filter(
                PipelineSchedule.is_active == True,
                PipelineSchedule.next_run_at.isnot(None),
                PipelineSchedule.next_run_at <= now,
            ).order_by(PipelineSchedule.next_run_at.asc()).with_for_update(skip_locked=True, of=PipelineSchedule).limit(limit).all()

            claimed = []
            for row in rows:
                scheduled_for = row.next_run_at or now
                row.last_run_at = now
                row.next_run_at = compute_next_run_at(
                    row.frequency,
                    row.run_time,
                    row.timezone or 'UTC',
                    row.day_of_week,
                    row.day_of_month,
                    now_utc=now,
                )
                claimed.append({
                    'id': row.id,
                    'pipeline_id': row.pipeline_id,
                    'pipeline_name': row.pipeline.name if row.pipeline else '',
                    'schedule_name': row.schedule_name,
                    'user_email': row.user_email,
                    'scheduled_for': scheduled_for.isoformat() if scheduled_for else None,
                    'next_run_at': row.next_run_at.isoformat() if row.next_run_at else None,
                })

            if claimed:
                db.commit()
            return claimed
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    async def toggle_schedule(self, schedule_id: str, email: str):
        db = self.SessionLocal()
        try:
            row = db.query(PipelineSchedule).filter(
                PipelineSchedule.id == schedule_id,
                PipelineSchedule.user_email == email
            ).first()
            if row:
                row.is_active = not row.is_active
                row.next_run_at = compute_next_run_at(
                    row.frequency,
                    row.run_time,
                    row.timezone or 'UTC',
                    row.day_of_week,
                    row.day_of_month,
                ) if row.is_active else None
                db.commit()
                return row.is_active
            return None
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    async def delete_schedule(self, schedule_id: str, email: str):
        db = self.SessionLocal()
        try:
            deleted = db.query(PipelineSchedule).filter(
                PipelineSchedule.id == schedule_id,
                PipelineSchedule.user_email == email
            ).delete()
            db.commit()
            return deleted
        finally:
            db.close()

    # ─── Pipeline Runs ────────────────────────────────────────────────────────

    async def create_pipeline_run(self, data: dict):
        db = self.SessionLocal()
        try:
            run_id = data.get('id') or str(uuid.uuid4())
            entry = PipelineRun(
                id=run_id,
                pipeline_id=data.get('pipeline_id'),
                user_email=data['user_email'],
                pipeline_name=data['pipeline_name'],
                trigger=data.get('trigger', 'manual'),
                status=data.get('status', 'running'),
                node_count=data.get('node_count', 0),
            )
            db.add(entry)
            db.commit()
            return run_id
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    async def update_pipeline_run(self, run_id: str, email: str, update: dict):
        db = self.SessionLocal()
        try:
            row = db.query(PipelineRun).filter(
                PipelineRun.id == run_id,
                PipelineRun.user_email == email
            ).first()
            if row:
                if 'status' in update:
                    row.status = update['status']
                if 'logs' in update:
                    row.logs = json.dumps(update['logs'])
                if 'output_file' in update:
                    row.output_file = update['output_file']
                if 'error_message' in update:
                    row.error_message = update['error_message']
                if update.get('status') in ('completed', 'failed'):
                    row.finished_at = datetime.utcnow()
                    if row.started_at:
                        row.duration_seconds = (row.finished_at - row.started_at).total_seconds()
                db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    async def get_pipeline_runs(self, email: str, pipeline_id: str = None, limit: int = 50):
        db = self.SessionLocal()
        query = db.query(PipelineRun).filter(PipelineRun.user_email == email)
        if pipeline_id:
            query = query.filter(PipelineRun.pipeline_id == pipeline_id)
        rows = query.order_by(PipelineRun.started_at.desc()).limit(limit).all()
        result = [self._serialize_pipeline_run(r) for r in rows]
        db.close()
        return result

    async def delete_pipeline_run(self, run_id: str, email: str):
        db = self.SessionLocal()
        try:
            deleted = db.query(PipelineRun).filter(
                PipelineRun.id == run_id,
                PipelineRun.user_email == email
            ).delete()
            db.commit()
            return deleted
        finally:
            db.close()


db = DatabaseManager()
async def get_user(email: str): return await db.get_user(email)
async def create_user(user_data: dict): return await db.create_user(user_data)
async def update_user_otp(email: str, otp: str, created_at: datetime): return await db.update_user_otp(email, otp, created_at)
async def verify_user(email: str): return await db.verify_user(email)
