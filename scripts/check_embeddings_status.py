"""
Check the status of job embeddings in the database.

This script helps diagnose why matching might not be working.
"""

import sys
from pathlib import Path

project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

from app.database.db import get_connection


def check_embeddings_status():
    """Check embeddings status and provide diagnostics."""
    print("\n" + "="*70)
    print("  Job Embeddings Status Check")
    print("="*70 + "\n")
    
    try:
        conn = get_connection()
        cur = conn.cursor()
        
        # Check total jobs
        cur.execute("SELECT COUNT(*) FROM jobs WHERE is_active = TRUE;")
        total_jobs = cur.fetchone()[0]
        print(f"📊 Total active jobs in database: {total_jobs}")
        
        if total_jobs == 0:
            print("\n❌ No jobs in database!")
            print("   Run the scraper first: python -m scripts.scheduled_scraper")
            print("   Or start Docker: docker compose up")
            return False
        
        # Check jobs with descriptions
        cur.execute("""
            SELECT COUNT(*) 
            FROM jobs 
            WHERE is_active = TRUE 
            AND description IS NOT NULL 
            AND description != '';
        """)
        jobs_with_desc = cur.fetchone()[0]
        print(f"📝 Jobs with descriptions: {jobs_with_desc}")
        
        # Check if job_embeddings table exists
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'job_embeddings'
            );
        """)
        table_exists = cur.fetchone()[0]
        
        if not table_exists:
            print("\n❌ job_embeddings table does NOT exist!")
            print("   Run: python -m scripts.setup_vector_tables")
            return False
        
        print(f"✓ job_embeddings table exists")
        
        # Check embeddings count
        cur.execute("SELECT COUNT(*) FROM job_embeddings;")
        embedding_count = cur.fetchone()[0]
        print(f"🔢 Job embeddings generated: {embedding_count}")
        
        if embedding_count == 0:
            print("\n⚠️  No embeddings generated yet!")
            print("   This is why matching isn't working.")
            print("\n   To generate embeddings, run:")
            print("   python -c \"from app.services.vector_matching_service import VectorSkillMatcher; m = VectorSkillMatcher(); m.generate_job_embeddings()\"")
            return False
        
        # Check coverage
        coverage = (embedding_count / jobs_with_desc * 100) if jobs_with_desc > 0 else 0
        print(f"📈 Embedding coverage: {coverage:.1f}%")
        
        if coverage < 50:
            print(f"\n⚠️  Low coverage! Only {coverage:.1f}% of jobs have embeddings.")
            print("   Consider regenerating embeddings.")
        
        # Sample some job titles
        cur.execute("""
            SELECT j.job_title, j.company, j.source
            FROM jobs j
            LEFT JOIN job_embeddings je ON j.id = je.job_id
            WHERE j.is_active = TRUE
            LIMIT 5;
        """)
        sample_jobs = cur.fetchall()
        
        print(f"\n📋 Sample jobs in database:")
        for i, (title, company, source) in enumerate(sample_jobs, 1):
            print(f"   {i}. {title[:50]} @ {company} ({source})")
        
        cur.close()
        conn.close()
        
        print("\n" + "="*70)
        if embedding_count > 0:
            print("✅ Everything looks good! Embeddings are ready for matching.")
        else:
            print("❌ Embeddings need to be generated before matching will work.")
        print("="*70 + "\n")
        
        return embedding_count > 0
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = check_embeddings_status()
    sys.exit(0 if success else 1)
