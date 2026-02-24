# app/database/db.py

import psycopg2
import os


def get_connection():
    """Get database connection."""
    return psycopg2.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        database=os.getenv('DB_NAME', 'jobs_db'),
        user=os.getenv('DB_USER', 'postgres'),
        password=os.getenv('DB_PASSWORD', '202211217nour'),
        port=int(os.getenv('DB_PORT', '5432'))  # Default to 5432
    )


def init_database():
    """Initialize database with required tables."""
    conn = get_connection()
    cur = conn.cursor()
    
    try:
        # Create jobs table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS jobs (
                id SERIAL PRIMARY KEY,
                source VARCHAR(50) NOT NULL,
                job_title VARCHAR(255) NOT NULL,
                company VARCHAR(255) NOT NULL,
                location VARCHAR(255),
                description TEXT,
                job_url VARCHAR(500) UNIQUE NOT NULL,
                scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT TRUE
            );
        """)
        
        # Create indexes
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs(source);
            CREATE INDEX IF NOT EXISTS idx_jobs_scraped_at ON jobs(scraped_at DESC);
            CREATE INDEX IF NOT EXISTS idx_jobs_is_active ON jobs(is_active);
            CREATE INDEX IF NOT EXISTS idx_jobs_url ON jobs(job_url);
            CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company);
        """)
        
        # Create views for easier querying
        cur.execute("""
            CREATE OR REPLACE VIEW recent_jobs AS
            SELECT 
                id,
                source,
                job_title,
                company,
                location,
                job_url,
                scraped_at,
                created_at
            FROM jobs
            WHERE is_active = TRUE
                AND scraped_at > NOW() - INTERVAL '7 days'
            ORDER BY scraped_at DESC;
        """)
        
        cur.execute("""
            CREATE OR REPLACE VIEW job_statistics AS
            SELECT 
                source,
                COUNT(*) as total_jobs,
                COUNT(CASE WHEN scraped_at > NOW() - INTERVAL '24 hours' THEN 1 END) as jobs_last_24h,
                COUNT(CASE WHEN scraped_at > NOW() - INTERVAL '7 days' THEN 1 END) as jobs_last_week,
                MAX(scraped_at) as last_scraped
            FROM jobs
            WHERE is_active = TRUE
            GROUP BY source
            ORDER BY total_jobs DESC;
        """)
        
        conn.commit()
        print("✅ Database initialized successfully")
        
        # Show current count
        cur.execute("SELECT COUNT(*) FROM jobs")
        count = cur.fetchone()[0]
        print(f"📊 Current jobs in database: {count}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    init_database()