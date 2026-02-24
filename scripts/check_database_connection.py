"""
Quick script to check which PostgreSQL you're connecting to.

This helps diagnose if you're connecting to Docker or local PostgreSQL.
"""

import sys
from pathlib import Path

project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

from app.database.db import get_connection
import psycopg2


def check_connection():
    """Check which PostgreSQL instance we're connecting to."""
    print("\n" + "="*70)
    print("  Database Connection Check")
    print("="*70 + "\n")
    
    try:
        conn = get_connection()
        cur = conn.cursor()
        
        # Get PostgreSQL version and location
        cur.execute("SELECT version();")
        version = cur.fetchone()[0]
        
        # Check if pgvector is available
        cur.execute("""
            SELECT extname, extversion 
            FROM pg_extension 
            WHERE extname = 'vector';
        """)
        pgvector = cur.fetchone()
        
        # Get database name and user
        cur.execute("SELECT current_database(), current_user;")
        db_name, db_user = cur.fetchone()
        
        print(f"✓ Connected successfully!")
        print(f"\nDatabase: {db_name}")
        print(f"User: {db_user}")
        print(f"\nPostgreSQL Version:")
        print(f"  {version.split(',')[0]}")
        
        if pgvector:
            print(f"\n✓ pgvector extension is ENABLED")
            print(f"  Version: {pgvector[1]}")
        else:
            print(f"\n❌ pgvector extension is NOT enabled")
            print(f"\n💡 This means you're connecting to LOCAL PostgreSQL, not Docker!")
            print(f"   Docker PostgreSQL has pgvector pre-installed.")
        
        # Check for job_embeddings table
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'job_embeddings';
        """)
        has_table = cur.fetchone()
        
        if has_table:
            print(f"\n✓ job_embeddings table exists")
        else:
            print(f"\n❌ job_embeddings table does NOT exist")
        
        cur.close()
        conn.close()
        
        return pgvector is not None
        
    except psycopg2.OperationalError as e:
        print(f"❌ Connection failed: {e}")
        print("\n💡 Make sure:")
        print("   1. PostgreSQL is running (local or Docker)")
        print("   2. Connection settings in .env are correct")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


if __name__ == "__main__":
    has_pgvector = check_connection()
    
    if not has_pgvector:
        print("\n" + "="*70)
        print("  SOLUTION")
        print("="*70)
        print("""
You're connecting to LOCAL PostgreSQL, not Docker!

To fix this, you have 2 options:

OPTION 1: Stop local PostgreSQL (Recommended)
  1. Open PowerShell as Administrator
  2. Run: net stop postgresql-x64-16
  3. Make sure Docker container is running: docker ps
  4. If not running: docker start postgres-vector
  5. Run this check again: python -m scripts.check_database_connection

OPTION 2: Use different port for Docker
  1. Stop Docker container: docker stop postgres-vector
  2. Remove it: docker rm postgres-vector
  3. Update docker-compose.yml to use port 5433
  4. Update .env file: DB_PORT=5433
  5. Start Docker: docker-compose up -d postgres
  6. Run this check again
        """)
    
    sys.exit(0 if has_pgvector else 1)
