# app/database/db.py

import psycopg2
import os
from pathlib import Path
from typing import Optional

# Load .env from project root (folder containing app/)
if getattr(os, "_db_env_loaded", None) is None:
    try:
        from dotenv import load_dotenv
        root = Path(__file__).resolve().parent.parent.parent
        load_dotenv(root / ".env")
        os._db_env_loaded = True
    except Exception:
        pass


def get_connection():
    """Get database connection."""
    return psycopg2.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        database=os.getenv('DB_NAME', 'jobs_db'),
        user=os.getenv('DB_USER', 'postgres'),
        password=os.getenv('DB_PASSWORD', '202211217nour'),
        port=int(os.getenv('DB_PORT', '5433'))  # 5433 = Docker Postgres
    )


def init_database():
    """Initialize database with required tables."""
    conn = get_connection()
    cur = conn.cursor()
    
    try:
        # Enable pgvector extension (needed for user profile embeddings)
        cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")

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
        
        # ── User profiles table (job seekers who uploaded a CV) ──────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS user_profiles (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                full_name VARCHAR(255),
                cv_text TEXT,
                skills TEXT[],                -- array of extracted skill strings
                skills_embedding vector(384), -- sentence-transformer embedding (all-MiniLM-L6-v2 = 384 dims)
                cv_filename VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_user_profiles_email
                ON user_profiles(email);
        """)

        # Add profile fields if missing (job seeker profile page)
        cur.execute("""
            ALTER TABLE user_profiles
              ADD COLUMN IF NOT EXISTS headline VARCHAR(255),
              ADD COLUMN IF NOT EXISTS bio TEXT,
              ADD COLUMN IF NOT EXISTS location VARCHAR(255),
              ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR(255),
              ADD COLUMN IF NOT EXISTS years_experience INTEGER;
        """)

        # ── Company search log (optional audit trail) ─────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS company_searches (
                id SERIAL PRIMARY KEY,
                company_name VARCHAR(255),
                required_skills TEXT[],
                searched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # ── CV uploads (job matcher: store uploaded CVs) ──────────────────────
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

        # ── Authentication tables ───────────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                full_name VARCHAR(255) NOT NULL,
                hashed_password VARCHAR(255) NOT NULL,
                user_type VARCHAR(20) NOT NULL
                    CHECK (user_type IN ('jobseeker', 'company')),
                is_verified BOOLEAN DEFAULT FALSE,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS company_profiles (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                company_name VARCHAR(255) NOT NULL,
                website VARCHAR(255),
                industry VARCHAR(100),
                company_size VARCHAR(50),
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        cur.execute("""
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'company_profiles_user_id_unique'
                ) THEN
                    ALTER TABLE company_profiles
                    ADD CONSTRAINT company_profiles_user_id_unique UNIQUE (user_id);
                END IF;
            END $$;
        """)
        cur.execute("""
            ALTER TABLE company_profiles
            ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500);
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_users_type ON users(user_type);")

        # ── Job applications (tracker for job seekers) ─────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS job_applications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                job_title VARCHAR(255) NOT NULL,
                company VARCHAR(255) NOT NULL,
                job_url VARCHAR(500),
                location VARCHAR(255),
                status VARCHAR(50) DEFAULT 'applied'
                    CHECK (status IN (
                        'applied', 'interviewing',
                        'offer', 'rejected', 'saved'
                    )),
                notes TEXT,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_applications_user_id ON job_applications(user_id);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_applications_status ON job_applications(status);")

        # ── Saved jobs (bookmarks for job seekers) ───────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS saved_jobs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
                saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, job_id)
            );
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_saved_jobs_user_id ON saved_jobs(user_id);")

        # ── Saved candidates (company bookmarks + notes) ─────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS saved_candidates (
                id SERIAL PRIMARY KEY,
                company_user_id INTEGER
                    REFERENCES users(id) ON DELETE CASCADE,
                candidate_user_id INTEGER
                    REFERENCES users(id) ON DELETE CASCADE,
                notes TEXT,
                saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(company_user_id, candidate_user_id)
            );
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_saved_candidates_company ON saved_candidates(company_user_id);")
        
        conn.commit()
        print("Database initialized successfully")
        
        # Show current count
        cur.execute("SELECT COUNT(*) FROM jobs")
        count = cur.fetchone()[0]
        print(f"Current jobs in database: {count}")
        
    except Exception as e:
        print(f"Error: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()


def save_cv_upload(file_name: str, extracted_text: str, skills: list) -> int:
    """Store a CV upload in the database. Returns the new row id."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        text_snippet = (extracted_text or "")[:5000]
        skills_str = ",".join(s.strip() for s in skills) if skills else ""
        cur.execute(
            """
            INSERT INTO cv_uploads (file_name, extracted_text, skills_text, uploaded_at)
            VALUES (%s, %s, %s, NOW())
            RETURNING id;
            """,
            (file_name, text_snippet, skills_str),
        )
        row_id = cur.fetchone()[0]
        conn.commit()
        return row_id
    finally:
        cur.close()
        conn.close()


def _row_to_dict(cur, row):
    """Convert a cursor row to a dict using column names."""
    if row is None:
        return None
    return dict(zip([d[0] for d in cur.description], row))


def get_user_by_email(email: str) -> Optional[dict]:
    """Query users table by email. Return all fields as dict or None if not found."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT id, email, full_name, hashed_password, user_type, is_verified, is_active, created_at, updated_at FROM users WHERE email = %s;",
            (email,),
        )
        row = cur.fetchone()
        return _row_to_dict(cur, row)
    finally:
        cur.close()
        conn.close()


def create_user(email: str, full_name: str, hashed_password: str, user_type: str) -> int:
    """Insert new row into users table. Return new user id."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO users (email, full_name, hashed_password, user_type)
            VALUES (%s, %s, %s, %s)
            RETURNING id;
            """,
            (email, full_name, hashed_password, user_type),
        )
        user_id = cur.fetchone()[0]
        conn.commit()
        return user_id
    finally:
        cur.close()
        conn.close()


def get_user_by_id(user_id: int) -> Optional[dict]:
    """Query users table by id. Return all fields as dict or None."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT id, email, full_name, hashed_password, user_type, is_verified, is_active, created_at, updated_at FROM users WHERE id = %s;",
            (user_id,),
        )
        row = cur.fetchone()
        return _row_to_dict(cur, row)
    finally:
        cur.close()
        conn.close()


def get_user_profile(user_id: int) -> Optional[dict]:
    """
    Query user_profiles joined with users by user id.
    Return: id, email, full_name, headline, bio, location, linkedin_url,
            years_experience, skills, cv_filename, created_at, updated_at.
    Return None if user not found.
    """
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT
                p.id,
                u.email,
                COALESCE(NULLIF(TRIM(p.full_name), ''), u.full_name) AS full_name,
                p.headline,
                p.bio,
                p.location,
                p.linkedin_url,
                p.years_experience,
                p.skills,
                p.cv_filename,
                p.created_at,
                p.updated_at
            FROM users u
            LEFT JOIN user_profiles p ON p.email = u.email
            WHERE u.id = %s;
            """,
            (user_id,),
        )
        row = cur.fetchone()
        if row is None:
            return None
        cols = [
            "id", "email", "full_name", "headline", "bio", "location",
            "linkedin_url", "years_experience", "skills", "cv_filename",
            "created_at", "updated_at",
        ]
        out = dict(zip(cols, row))
        if out["full_name"] is None:
            cur.execute("SELECT full_name FROM users WHERE id = %s;", (user_id,))
            r = cur.fetchone()
            out["full_name"] = r[0] if r else ""
        if out["skills"] is None:
            out["skills"] = []
        if out["created_at"] and hasattr(out["created_at"], "isoformat"):
            out["created_at"] = out["created_at"].isoformat()
        if out["updated_at"] and hasattr(out["updated_at"], "isoformat"):
            out["updated_at"] = out["updated_at"].isoformat()
        return out
    finally:
        cur.close()
        conn.close()


def upsert_user_profile(user_id: int, data: dict) -> bool:
    """
    INSERT or UPDATE user_profiles for this user_id.
    Updates: full_name, headline, bio, location, linkedin_url, years_experience.
    Also updates full_name in users table.
    """
    user = get_user_by_id(user_id)
    if not user:
        return False
    email = user["email"]
    full_name = (data.get("full_name") or "").strip() or user["full_name"]
    headline = (data.get("headline") or "").strip()[:255]
    bio = (data.get("bio") or "").strip()
    location = (data.get("location") or "").strip()[:255]
    linkedin_url = (data.get("linkedin_url") or "").strip()[:255]
    years_experience = data.get("years_experience")
    if years_experience is not None and not isinstance(years_experience, int):
        try:
            years_experience = int(years_experience)
        except (TypeError, ValueError):
            years_experience = None

    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            UPDATE users SET full_name = %s, updated_at = NOW() WHERE id = %s;
            """,
            (full_name, user_id),
        )
        cur.execute(
            """
            INSERT INTO user_profiles
                (email, full_name, headline, bio, location, linkedin_url, years_experience, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (email) DO UPDATE SET
                full_name         = EXCLUDED.full_name,
                headline          = EXCLUDED.headline,
                bio               = EXCLUDED.bio,
                location          = EXCLUDED.location,
                linkedin_url      = EXCLUDED.linkedin_url,
                years_experience  = EXCLUDED.years_experience,
                updated_at        = NOW();
            """,
            (email, full_name, headline or None, bio or None, location or None, linkedin_url or None, years_experience),
        )
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


def update_user_skills(user_id: int, skills: list) -> bool:
    """Update skills array in user_profiles for this user. Creates profile row if missing."""
    user = get_user_by_id(user_id)
    if not user:
        return False
    email = user["email"]
    skills = [str(s).strip() for s in (skills or []) if str(s).strip()]

    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO user_profiles (email, full_name, skills, updated_at)
            VALUES (%s, %s, %s, NOW())
            ON CONFLICT (email) DO UPDATE SET skills = EXCLUDED.skills, updated_at = NOW();
            """,
            (email, user["full_name"] or "", skills),
        )
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


def get_user_applications(user_id: int) -> list:
    """Return all job_applications for user_id, ordered by updated_at DESC."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT id, user_id, job_title, company, job_url, location,
                   status, notes, applied_at, updated_at
            FROM job_applications
            WHERE user_id = %s
            ORDER BY updated_at DESC;
            """,
            (user_id,),
        )
        rows = cur.fetchall()
        cols = [
            "id", "user_id", "job_title", "company", "job_url", "location",
            "status", "notes", "applied_at", "updated_at",
        ]
        out = []
        for row in rows:
            d = dict(zip(cols, row))
            for k in ("applied_at", "updated_at"):
                if d.get(k) and hasattr(d[k], "isoformat"):
                    d[k] = d[k].isoformat()
            out.append(d)
        return out
    finally:
        cur.close()
        conn.close()


def create_application(user_id: int, data: dict) -> int:
    """INSERT into job_applications. Return new application id."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO job_applications
                (user_id, job_title, company, job_url, location, status, notes)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id;
            """,
            (
                user_id,
                (data.get("job_title") or "").strip()[:255],
                (data.get("company") or "").strip()[:255],
                (data.get("job_url") or "").strip()[:500] or None,
                (data.get("location") or "").strip()[:255] or None,
                (data.get("status") or "applied").strip()[:50],
                (data.get("notes") or "").strip() or None,
            ),
        )
        app_id = cur.fetchone()[0]
        conn.commit()
        return app_id
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def update_application(app_id: int, user_id: int, data: dict) -> bool:
    """UPDATE job_applications SET ... WHERE id = %s AND user_id = %s. Return True on success."""
    if not data:
        return True
    updates = []
    values = []
    if "job_title" in data and data["job_title"] is not None:
        updates.append("job_title = %s")
        values.append(str(data["job_title"]).strip()[:255])
    if "company" in data and data["company"] is not None:
        updates.append("company = %s")
        values.append(str(data["company"]).strip()[:255])
    if "job_url" in data:
        updates.append("job_url = %s")
        values.append((data["job_url"] or "").strip()[:500] or None)
    if "location" in data:
        updates.append("location = %s")
        values.append((data["location"] or "").strip()[:255] or None)
    if "status" in data and data["status"] is not None:
        updates.append("status = %s")
        values.append(str(data["status"]).strip()[:50])
    if "notes" in data:
        updates.append("notes = %s")
        values.append((data["notes"] or "").strip() or None)
    if not updates:
        return True
    updates.append("updated_at = NOW()")
    values.extend([app_id, user_id])
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            f"UPDATE job_applications SET {', '.join(updates)} WHERE id = %s AND user_id = %s;",
            values,
        )
        conn.commit()
        return cur.rowcount > 0
    except Exception:
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


def delete_application(app_id: int, user_id: int) -> bool:
    """DELETE FROM job_applications WHERE id = %s AND user_id = %s. Return True on success."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "DELETE FROM job_applications WHERE id = %s AND user_id = %s;",
            (app_id, user_id),
        )
        conn.commit()
        return cur.rowcount > 0
    except Exception:
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


def get_saved_jobs(user_id: int) -> list:
    """Return list of job dicts (from jobs table) with saved_at, ordered by saved_at DESC."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT j.id, j.source, j.job_title, j.company, j.location, j.description,
                   j.job_url, j.scraped_at, sj.saved_at
            FROM jobs j
            JOIN saved_jobs sj ON j.id = sj.job_id
            WHERE sj.user_id = %s
            ORDER BY sj.saved_at DESC;
            """,
            (user_id,),
        )
        rows = cur.fetchall()
        cols = [
            "id", "source", "job_title", "company", "location", "description",
            "job_url", "scraped_at", "saved_at",
        ]
        out = []
        for row in rows:
            d = dict(zip(cols, row))
            for k in ("scraped_at", "saved_at"):
                if d.get(k) and hasattr(d[k], "isoformat"):
                    d[k] = d[k].isoformat()
            out.append(d)
        return out
    finally:
        cur.close()
        conn.close()


def save_job(user_id: int, job_id: int) -> bool:
    """INSERT INTO saved_jobs ON CONFLICT DO NOTHING. Return True on success."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO saved_jobs (user_id, job_id)
            VALUES (%s, %s)
            ON CONFLICT (user_id, job_id) DO NOTHING;
            """,
            (user_id, job_id),
        )
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


def unsave_job(user_id: int, job_id: int) -> bool:
    """DELETE FROM saved_jobs WHERE user_id = %s AND job_id = %s. Return True on success."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "DELETE FROM saved_jobs WHERE user_id = %s AND job_id = %s;",
            (user_id, job_id),
        )
        conn.commit()
        return cur.rowcount >= 0
    except Exception:
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


def is_job_saved(user_id: int, job_id: int) -> bool:
    """Return True if (user_id, job_id) exists in saved_jobs."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT 1 FROM saved_jobs WHERE user_id = %s AND job_id = %s;",
            (user_id, job_id),
        )
        return cur.fetchone() is not None
    finally:
        cur.close()
        conn.close()


def get_company_profile(user_id: int) -> Optional[dict]:
    """
    Return company_profiles row joined with users (email, full_name).
    Return None if no company profile found.
    """
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT cp.id, cp.user_id, cp.company_name, cp.website, cp.industry,
                   cp.company_size, cp.description, cp.logo_url, cp.created_at,
                   u.email, u.full_name
            FROM company_profiles cp
            JOIN users u ON u.id = cp.user_id
            WHERE cp.user_id = %s;
            """,
            (user_id,),
        )
        row = cur.fetchone()
        if row is None:
            return None
        cols = [
            "id", "user_id", "company_name", "website", "industry",
            "company_size", "description", "logo_url", "created_at",
            "email", "full_name",
        ]
        out = dict(zip(cols, row))
        if out.get("created_at") and hasattr(out["created_at"], "isoformat"):
            out["created_at"] = out["created_at"].isoformat()
        return out
    finally:
        cur.close()
        conn.close()


def upsert_company_profile(user_id: int, data: dict) -> bool:
    """
    INSERT or UPDATE company_profiles for user_id.
    Also UPDATE users SET full_name if contact_name provided.
    """
    user = get_user_by_id(user_id)
    if not user:
        return False
    company_name = (data.get("company_name") or "").strip()[:255] or "Company"
    website = (data.get("website") or "").strip()[:255] or None
    industry = (data.get("industry") or "").strip()[:100] or None
    company_size = (data.get("company_size") or "").strip()[:50] or None
    description = (data.get("description") or "").strip() or None
    contact_name = (data.get("contact_name") or "").strip()[:255] or user.get("full_name") or ""

    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            UPDATE users SET full_name = %s WHERE id = %s;
            """,
            (contact_name, user_id),
        )
        cur.execute(
            """
            INSERT INTO company_profiles
                (user_id, company_name, website, industry, company_size, description)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (user_id) DO UPDATE SET
                company_name = EXCLUDED.company_name,
                website = EXCLUDED.website,
                industry = EXCLUDED.industry,
                company_size = EXCLUDED.company_size,
                description = EXCLUDED.description;
            """,
            (user_id, company_name, website, industry, company_size, description),
        )
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


# ---------------------------------------------------------------------------
# Saved candidates (company users)
# ---------------------------------------------------------------------------

def get_saved_candidates(company_user_id: int) -> list:
    """Return list of saved candidates with profile data for a company user."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT
                sc.id,
                sc.candidate_user_id,
                sc.notes,
                sc.saved_at,
                sc.updated_at,
                COALESCE(up.full_name, u.full_name) AS full_name,
                u.email AS email,
                up.skills,
                up.headline,
                up.location,
                up.cv_filename
            FROM saved_candidates sc
            JOIN users u ON u.id = sc.candidate_user_id
            LEFT JOIN user_profiles up ON up.email = u.email
            WHERE sc.company_user_id = %s
            ORDER BY sc.saved_at DESC
            """,
            (company_user_id,),
        )
        rows = cur.fetchall()
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in rows]
    finally:
        cur.close()
        conn.close()


def save_candidate(company_user_id: int, candidate_user_id: int) -> bool:
    """Save a candidate for a company user. Returns True on success."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO saved_candidates (company_user_id, candidate_user_id)
            VALUES (%s, %s)
            ON CONFLICT (company_user_id, candidate_user_id) DO NOTHING
            """,
            (company_user_id, candidate_user_id),
        )
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


def unsave_candidate(company_user_id: int, candidate_user_id: int) -> bool:
    """Remove a saved candidate. Returns True."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            DELETE FROM saved_candidates
            WHERE company_user_id = %s AND candidate_user_id = %s
            """,
            (company_user_id, candidate_user_id),
        )
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


def update_candidate_notes(company_user_id: int, candidate_user_id: int, notes: str) -> bool:
    """Update notes for a saved candidate. Returns True."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            UPDATE saved_candidates SET notes = %s, updated_at = NOW()
            WHERE company_user_id = %s AND candidate_user_id = %s
            """,
            (notes or "", company_user_id, candidate_user_id),
        )
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


def is_candidate_saved(company_user_id: int, candidate_user_id: int) -> bool:
    """Return True if the candidate is saved by the company user."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT 1 FROM saved_candidates
            WHERE company_user_id = %s AND candidate_user_id = %s
            """,
            (company_user_id, candidate_user_id),
        )
        return cur.fetchone() is not None
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    init_database()
    