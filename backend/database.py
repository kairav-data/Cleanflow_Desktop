import os
import time
from sqlalchemy import create_engine, Column, Integer, String, Boolean, Text, DateTime, text, ForeignKey
from sqlalchemy.orm import sessionmaker, declarative_base, relationship
from datetime import datetime
import json

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
    # Relationships
    jobs = relationship("ValidationJob", back_populates="owner")
    connections = relationship("DbConnection", back_populates="owner")

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

class DatabaseManager:
    def __init__(self):
        self.pg_engine = create_engine(PG_URL)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.pg_engine)
        self._init_postgres()

    def _init_postgres(self):
        retries = 10
        while retries > 0:
            try:
                with self.pg_engine.connect() as conn:
                    conn.execute(text("SELECT 1"))
                Base.metadata.create_all(bind=self.pg_engine)
                
                # --- Quick migrations for missing columns in dev ---
                migration_queries = [
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
                    "ALTER TABLE validation_jobs ADD COLUMN IF NOT EXISTS column_stats TEXT;"
                ]
                
                for query in migration_queries:
                    try:
                        with self.pg_engine.begin() as conn:
                            conn.execute(text(query))
                    except Exception as e:
                        pass
                
                print("✅ PostgreSQL initialized and tables verified.")
                return
            except Exception as e:
                print(f"🔄 Postgres not ready ({retries} retries left): {e}")
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
                "otp_created_at": user.otp_created_at
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

db = DatabaseManager()
async def get_user(email: str): return await db.get_user(email)
async def create_user(user_data: dict): return await db.create_user(user_data)
async def update_user_otp(email: str, otp: str, created_at: datetime): return await db.update_user_otp(email, otp, created_at)
async def verify_user(email: str): return await db.verify_user(email)
