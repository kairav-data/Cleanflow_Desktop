import asyncio
from database import db, UserPG, ValidationJob, DbConnection

async def inspect_database():
    print("🚀 --- PostgreSQL Database Inspection --- 🚀")
    
    session = db.SessionLocal()
    try:
        # 1. List Users
        print("\n[Users Table]")
        users = session.query(UserPG).all()
        if not users:
            print("No users found in database.")
        for u in users:
            print(f"📧 Email: {u.email} | 👤 Name: {u.full_name} | ⭐ Premium: {u.is_premium}")

        # 2. List Validation Jobs
        print("\n[Validation Jobs Table]")
        jobs = session.query(ValidationJob).all()
        if not jobs:
            print("No validation jobs found.")
        for j in jobs:
            print(f"📄 Job ID: {j.id} | 📂 File: {j.filename} | 🕒 Date: {j.created_at}")

        # 3. List Saved Connections
        print("\n[External DB Connections Table]")
        conns = session.query(DbConnection).all()
        if not conns:
            print("No saved database connections.")
        for c in conns:
            print(f"🔗 Name: {c.name} | 🏠 Host: {c.host} | 👤 User: {c.username}")

    except Exception as e:
        print(f"❌ Error reading Database: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    asyncio.run(inspect_database())