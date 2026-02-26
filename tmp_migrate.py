import psycopg2
from urllib.parse import urlparse
import os

db_url = "postgresql://postgres.hvxpqbphffsettcyqdfz:LHA2Pwgz3MbSoe5s@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require"

try:
    print("Connecting to Supabase...")
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cursor = conn.cursor()
    
    queries = [
        "ALTER TABLE validation_jobs ADD COLUMN IF NOT EXISTS total_rows INTEGER DEFAULT 0;",
        "ALTER TABLE validation_jobs ADD COLUMN IF NOT EXISTS valid_rows INTEGER DEFAULT 0;",
        "ALTER TABLE validation_jobs ADD COLUMN IF NOT EXISTS invalid_rows INTEGER DEFAULT 0;",
        "ALTER TABLE validation_jobs ADD COLUMN IF NOT EXISTS column_stats TEXT;"
    ]
    
    for q in queries:
        try:
            print(f"Executing: {q}")
            cursor.execute(q)
            print("Success!")
        except Exception as e:
            print(f"Error executing {q}: {e}")
            
    cursor.close()
    conn.close()
    print("Done")
except Exception as e:
    print(f"Failed to connect: {e}")
