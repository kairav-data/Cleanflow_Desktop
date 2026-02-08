import os
import time
from sqlalchemy import create_engine, Column, Integer, String, Boolean, Text, DateTime, text, ForeignKey
from sqlalchemy.orm import sessionmaker, declarative_base, relationship
from datetime import datetime

# --- Docker Connection Config ---
PG_URL = os.getenv("DATABASE_URL", "postgresql://user:password@postgres:5432/cleanflow_db")

Base = declarative_base()

# --- PostgreSQL Schema ---

class UserPG(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    full_name = Column(String, nullable=True)
    hashed_password = Column(String)
    is_premium = Column(Boolean, default=False)
    # Relationships
    jobs = relationship("ValidationJob", back_populates="owner")
    connections = relationship("DbConnection", back_populates="owner")

class ValidationJob(Base):
    __tablename__ = "validation_jobs"
    id = Column(String, primary_key=True)  # Using UUID string
    user_email = Column(String, ForeignKey("users.email"))
    filename = Column(String)
    status = Column(String)
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
                print("✅ PostgreSQL initialized and tables created.")
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
                hashed_password=user_data['hashed_password'],
                is_premium=user_data.get('is_premium', False)
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
                "hashed_password": user.hashed_password,
                "is_premium": user.is_premium
            }
        return None

    async def upgrade_user(self, email: str):
        db = self.SessionLocal()
        user = db.query(UserPG).filter(UserPG.email == email).first()
        if user:
            user.is_premium = True
            db.commit()
        db.close()

    # --- Job History ---
    async def save_job(self, job_data: dict):
        db = self.SessionLocal()
        try:
            job = ValidationJob(
                id=job_data['id'],
                user_email=job_data['user_email'],
                filename=job_data.get('filename', 'unknown'),
                status=job_data.get('status', 'completed')
            )
            db.add(job)
            db.commit()
        finally:
            db.close()

    async def get_user_jobs(self, email: str):
        db = self.SessionLocal()
        jobs = db.query(ValidationJob).filter(ValidationJob.user_email == email).all()
        result = [{"id": j.id, "filename": j.filename, "created_at": j.created_at} for j in jobs]
        db.close()
        return result

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

db = DatabaseManager()
async def get_user(email: str): return await db.get_user(email)
async def create_user(user_data: dict): return await db.create_user(user_data)