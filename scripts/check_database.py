"""
Script to check if jobs are actually in the database.
"""

import sys
import io
from pathlib import Path

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Add the project root to Python path
project_root = Path(__file__).parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from app.database.db import get_connection


def check_database():
    """Check what's in the database."""
    conn = None
    try:
        print("=" * 70)
        print("🔍 Checking Database...")
        print("=" * 70)
        
        # Connect to database
        conn = get_connection()
        cur = conn.cursor()
        
        # Get total count
        cur.execute("SELECT COUNT(*) FROM jobs")
        total = cur.fetchone()[0]
        print(f"\n📊 Total jobs in database: {total}")
        
        # Get count by source
        cur.execute("""
            SELECT source, COUNT(*) 
            FROM jobs 
            GROUP BY source 
            ORDER BY COUNT(*) DESC
        """)
        
        print(f"\n📋 Jobs by source:")
        print("-" * 70)
        for source, count in cur.fetchall():
            print(f"  {source:20s} : {count:4d} jobs")
        
        # Get recent jobs
        cur.execute("""
            SELECT id, source, job_title, company, job_url, scraped_at
            FROM jobs 
            ORDER BY scraped_at DESC 
            LIMIT 5
        """)
        
        print(f"\n🕒 Most recent 5 jobs:")
        print("-" * 70)
        for row in cur.fetchall():
            job_id, source, title, company, url, scraped_at = row
            print(f"  [{job_id}] {source} | {title[:40]:40s} | {company[:20]:20s}")
            print(f"      URL: {url[:60]}")
            print(f"      Scraped: {scraped_at}")
            print()
        
        # Check database connection info
        cur.execute("SELECT current_database(), current_user, version()")
        db_info = cur.fetchone()
        print(f"📌 Database Info:")
        print(f"  Database: {db_info[0]}")
        print(f"  User: {db_info[1]}")
        print(f"  PostgreSQL: {db_info[2].split(',')[0]}")
        
        cur.close()
        print("\n" + "=" * 70)
        print("✅ Database check complete!")
        print("=" * 70)
        
    except Exception as e:
        print(f"\n❌ Error checking database: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    check_database()
