"""
Quick script to enable pgvector extension in your database.

This can be used if you already have a database running and just need to enable pgvector.

Usage:
    From project root: python -m scripts.enable_pgvector
    From scripts folder: python enable_pgvector.py
    From anywhere: python scripts/enable_pgvector.py
"""

import sys
import io
from pathlib import Path

# Fix Windows console encoding for emoji support
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Add project root to path (works from any directory)
project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from app.database.db import get_connection
import os
from dotenv import load_dotenv

load_dotenv()


def enable_pgvector():
    """Enable pgvector extension in the database"""
    print("\n" + "="*70)
    print("  Enabling pgvector Extension")
    print("="*70 + "\n")
    
    try:
        conn = get_connection()
        cur = conn.cursor()
        
        # Enable pgvector extension
        print("Creating pgvector extension...")
        cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        conn.commit()
        
        # Verify it's enabled
        cur.execute("SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';")
        result = cur.fetchone()
        
        if result:
            print(f"✓ pgvector extension enabled successfully!")
            print(f"  Extension: {result[0]}")
            print(f"  Version: {result[1]}")
        else:
            print("⚠️  Extension might not be enabled. Check database logs.")
        
        cur.close()
        conn.close()
        
        return True
        
    except Exception as e:
        error_msg = str(e)
        print(f"Error enabling pgvector: {error_msg}")
        print("\nTroubleshooting:")
        print("1. Make sure PostgreSQL is running")
        print("2. If using Docker, make sure container is running: docker ps")
        print("3. pgvector extension is NOT installed in your local PostgreSQL")
        print("\n   SOLUTIONS:")
        print("   Option A: Use Docker (recommended)")
        print("   - Run: docker compose up -d postgres")
        print("   - Then run this script again")
        print("\n   Option B: Install pgvector on local PostgreSQL")
        print("   - Download from: https://github.com/pgvector/pgvector")
        print("   - Follow installation instructions for Windows")
        print("   - Then run this script again")
        return False


if __name__ == "__main__":
    success = enable_pgvector()
    sys.exit(0 if success else 1)
