"""
Setup script for vector matching tables.

This script:
1. Enables pgvector extension
2. Creates job_embeddings and cv_embeddings tables
3. Creates indexes for fast similarity search
4. Verifies everything is set up correctly

Run this if you get "relation job_embeddings does not exist" error.
"""

import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

from app.database.db import get_connection, init_database
from sentence_transformers import SentenceTransformer


def setup_vector_tables():
    """Set up pgvector extension and required tables."""
    print("\n" + "="*70)
    print("  Setting Up Vector Matching Tables")
    print("="*70 + "\n")
    
    # Step 0: Ensure jobs table exists (job_embeddings references it)
    print("Step 0: Ensuring jobs table exists...")
    try:
        init_database()
    except Exception as e:
        print(f"❌ Error initializing database: {e}")
        return False
    
    # Get embedding dimension (needed for vector column)
    print("Loading embedding model to get dimension...")
    model = SentenceTransformer('all-MiniLM-L6-v2')
    embedding_dim = model.get_sentence_embedding_dimension()
    print(f"✓ Embedding dimension: {embedding_dim}\n")
    
    conn = None
    cur = None
    
    try:
        conn = get_connection()
        cur = conn.cursor()
        
        # Step 1: Enable pgvector extension
        print("Step 1: Enabling pgvector extension...")
        try:
            cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
            conn.commit()
            print("✓ pgvector extension enabled\n")
        except Exception as e:
            print(f"❌ Error enabling pgvector: {e}")
            print("\n💡 Solutions:")
            print("   - If using Docker: Make sure you're using pgvector/pgvector image")
            print("   - Start Docker: docker compose up -d postgres")
            print("   - If using local PostgreSQL: Install pgvector extension")
            return False
        
        # Step 2: Create job_embeddings table
        print("Step 2: Creating job_embeddings table...")
        try:
            cur.execute(f"""
                CREATE TABLE IF NOT EXISTS job_embeddings (
                    job_id INTEGER PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
                    full_text TEXT NOT NULL,
                    skills_text TEXT,
                    embedding vector({embedding_dim}) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            conn.commit()
            print("✓ job_embeddings table created\n")
        except Exception as e:
            print(f"❌ Error creating job_embeddings table: {e}")
            return False
        
        # Step 3: Create index for job_embeddings
        print("Step 3: Creating index for job_embeddings...")
        try:
            cur.execute("""
                CREATE INDEX IF NOT EXISTS job_embeddings_embedding_idx 
                ON job_embeddings 
                USING ivfflat (embedding vector_cosine_ops)
                WITH (lists = 100);
            """)
            conn.commit()
            print("✓ Index created\n")
        except Exception as e:
            print(f"⚠️  Warning creating index: {e}")
            print("   (This is okay, index creation might fail if table is empty)\n")
        
        # Step 3b: Create cv_uploads table (store uploaded CVs)
        print("Step 3b: Creating cv_uploads table...")
        try:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS cv_uploads (
                    id SERIAL PRIMARY KEY,
                    file_name VARCHAR(255) NOT NULL,
                    extracted_text TEXT,
                    skills_text TEXT NOT NULL,
                    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            cur.execute("CREATE INDEX IF NOT EXISTS idx_cv_uploads_uploaded_at ON cv_uploads(uploaded_at DESC);")
            conn.commit()
            print("✓ cv_uploads table created\n")
        except Exception as e:
            print(f"⚠️  cv_uploads: {e}\n")
        
        # Step 4: Create cv_embeddings table
        print("Step 4: Creating cv_embeddings table...")
        try:
            cur.execute(f"""
                CREATE TABLE IF NOT EXISTS cv_embeddings (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR(255),
                    skills_text TEXT NOT NULL,
                    embedding vector({embedding_dim}) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            conn.commit()
            print("✓ cv_embeddings table created\n")
        except Exception as e:
            print(f"❌ Error creating cv_embeddings table: {e}")
            return False
        
        # Step 5: Verify setup
        print("Step 5: Verifying setup...")
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('job_embeddings', 'cv_embeddings')
            ORDER BY table_name;
        """)
        tables = [row[0] for row in cur.fetchall()]
        
        if 'job_embeddings' in tables and 'cv_embeddings' in tables:
            print("✓ All tables created successfully!")
        else:
            print(f"⚠️  Missing tables. Found: {tables}")
        
        # Check pgvector extension
        cur.execute("SELECT extname FROM pg_extension WHERE extname = 'vector';")
        if cur.fetchone():
            print("✓ pgvector extension is enabled")
        else:
            print("⚠️  pgvector extension not found")
        
        # Check job count
        cur.execute("SELECT COUNT(*) FROM jobs WHERE is_active = TRUE;")
        job_count = cur.fetchone()[0]
        print(f"✓ Jobs in database: {job_count}")
        
        # Check embeddings count
        cur.execute("SELECT COUNT(*) FROM job_embeddings;")
        embedding_count = cur.fetchone()[0]
        print(f"✓ Job embeddings generated: {embedding_count}")
        
        if job_count > 0 and embedding_count == 0:
            print("\n💡 Next step: Generate embeddings for existing jobs")
            print("   This will be done automatically when you run the matching app")
        
        print("\n" + "="*70)
        print("✅ Setup Complete!")
        print("="*70 + "\n")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        if conn:
            conn.rollback()
        return False
        
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


if __name__ == "__main__":
    success = setup_vector_tables()
    sys.exit(0 if success else 1)
