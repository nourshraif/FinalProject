# app/database/db.py

import re
import psycopg2
import os
from pathlib import Path
from typing import Optional, Tuple

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
        cur.execute("""
            ALTER TABLE user_profiles
              ADD COLUMN IF NOT EXISTS profile_slug VARCHAR(255) UNIQUE,
              ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE;
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
        cur.execute("""
            ALTER TABLE company_searches
            ADD COLUMN IF NOT EXISTS user_id INTEGER
                REFERENCES users(id) ON DELETE CASCADE,
            ADD COLUMN IF NOT EXISTS results_count INTEGER
                DEFAULT 0;
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_company_searches_user ON company_searches(user_id);")

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

        # Admin role
        cur.execute("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
        """)

        # Plan (free / pro / business)
        cur.execute("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS plan VARCHAR(50) DEFAULT 'free';
        """)

        # ── Subscriptions (Stripe) ─────────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS subscriptions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER
                    REFERENCES users(id) ON DELETE CASCADE,
                stripe_customer_id VARCHAR(255),
                stripe_subscription_id VARCHAR(255),
                plan VARCHAR(50) DEFAULT 'free'
                    CHECK (plan IN ('free', 'pro', 'business')),
                status VARCHAR(50) DEFAULT 'active'
                    CHECK (status IN (
                        'active', 'canceled',
                        'past_due', 'trialing'
                    )),
                current_period_end TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id)
            );
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);")

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

        # ── Contact requests (company → candidate) ───────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS contact_requests (
                id SERIAL PRIMARY KEY,
                company_user_id INTEGER
                    REFERENCES users(id) ON DELETE CASCADE,
                candidate_user_id INTEGER
                    REFERENCES users(id) ON DELETE CASCADE,
                message TEXT NOT NULL,
                status VARCHAR(20) DEFAULT 'pending'
                    CHECK (status IN (
                        'pending', 'accepted', 'declined'
                    )),
                company_email_revealed BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(company_user_id, candidate_user_id)
            );
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_contact_requests_candidate ON contact_requests(candidate_user_id);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_contact_requests_company ON contact_requests(company_user_id);")

        # ── Contact messages (public contact us form) ────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS contact_messages (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                full_name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                company VARCHAR(255),
                subject VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                status VARCHAR(20) DEFAULT 'new'
                    CHECK (status IN ('new', 'in_progress', 'resolved')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        # Backward-compatible migration for existing databases
        cur.execute("ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON contact_messages(status);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages(created_at DESC);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_contact_messages_user_id ON contact_messages(user_id);")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS contact_message_replies (
                id SERIAL PRIMARY KEY,
                contact_message_id INTEGER REFERENCES contact_messages(id) ON DELETE CASCADE,
                sender_type VARCHAR(20) NOT NULL
                    CHECK (sender_type IN ('admin', 'user')),
                sender_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                message TEXT NOT NULL,
                sent_via VARCHAR(20) NOT NULL
                    CHECK (sent_via IN ('backend', 'email')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_contact_message_replies_message_id ON contact_message_replies(contact_message_id);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_contact_message_replies_created_at ON contact_message_replies(created_at DESC);")

        # ── Notifications ─────────────────────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER
                    REFERENCES users(id) ON DELETE CASCADE,
                type VARCHAR(50) NOT NULL
                    CHECK (type IN (
                      'contact_request',
                      'request_accepted',
                      'request_declined',
                      'job_alert',
                      'new_job_match',
                      'profile_view',
                      'system'
                    )),
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                link VARCHAR(500),
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_notifications_user
                ON notifications(user_id);
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_notifications_unread
                ON notifications(user_id, is_read);
        """)

        # ── Password reset tokens ─────────────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id SERIAL PRIMARY KEY,
                user_id INTEGER
                    REFERENCES users(id) ON DELETE CASCADE,
                token VARCHAR(255) UNIQUE NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                used BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);")

        # ── Job alert settings (job seeker email alerts) ─────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS job_alert_settings (
                id SERIAL PRIMARY KEY,
                user_id INTEGER
                    REFERENCES users(id) ON DELETE CASCADE,
                is_enabled BOOLEAN DEFAULT TRUE,
                frequency VARCHAR(20) DEFAULT 'daily'
                    CHECK (frequency IN (
                        'immediate', 'daily', 'weekly'
                    )),
                min_match_score INTEGER DEFAULT 70,
                last_sent_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id)
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS sent_job_alerts (
                id SERIAL PRIMARY KEY,
                user_id INTEGER
                    REFERENCES users(id) ON DELETE CASCADE,
                job_id INTEGER
                    REFERENCES jobs(id) ON DELETE CASCADE,
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, job_id)
            );
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_alert_settings_user ON job_alert_settings(user_id);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_sent_alerts_user ON sent_job_alerts(user_id);")

        # ── Company posted jobs ─────────────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS posted_jobs (
                id SERIAL PRIMARY KEY,
                company_user_id INTEGER
                    REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                company_name VARCHAR(255) NOT NULL,
                location VARCHAR(255),
                job_type VARCHAR(50) DEFAULT 'full-time'
                    CHECK (job_type IN (
                        'full-time', 'part-time',
                        'contract', 'internship', 'remote'
                    )),
                experience_level VARCHAR(50) DEFAULT 'mid'
                    CHECK (experience_level IN (
                        'junior', 'mid', 'senior', 'lead', 'any'
                    )),
                salary_min INTEGER,
                salary_max INTEGER,
                salary_currency VARCHAR(10) DEFAULT 'USD',
                description TEXT NOT NULL,
                requirements TEXT,
                benefits TEXT,
                skills_required TEXT[],
                application_url VARCHAR(500),
                application_email VARCHAR(255),
                is_active BOOLEAN DEFAULT TRUE,
                is_featured BOOLEAN DEFAULT FALSE,
                views_count INTEGER DEFAULT 0,
                applications_count INTEGER DEFAULT 0,
                expires_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_posted_jobs_company ON posted_jobs(company_user_id);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_posted_jobs_active ON posted_jobs(is_active);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_posted_jobs_created ON posted_jobs(created_at DESC);")
        
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
    """Query users table by email (case-insensitive). Return all fields as dict or None if not found."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT id, email, full_name, hashed_password, user_type, is_verified, is_active, is_admin,
                   COALESCE(NULLIF(TRIM(plan), ''), 'free') AS plan,
                   created_at, updated_at
            FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM(%s));
            """,
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
            """
            SELECT id, email, full_name, hashed_password, user_type, is_verified, is_active, is_admin,
                   COALESCE(NULLIF(TRIM(plan), ''), 'free') AS plan,
                   created_at, updated_at
            FROM users WHERE id = %s;
            """,
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
                p.updated_at,
                p.profile_slug,
                p.is_public
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
            "created_at", "updated_at", "profile_slug", "is_public",
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


def upsert_user_profile_cv(
    user_id: int,
    cv_filename: str,
    cv_text: str,
    skills: list,
) -> bool:
    """Update or insert user_profiles with CV data (cv_filename, cv_text, skills). Keyed by user email."""
    user = get_user_by_id(user_id)
    if not user:
        return False
    email = user["email"]
    full_name = user.get("full_name") or ""
    skills = [str(s).strip() for s in (skills or []) if str(s).strip()]

    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO user_profiles (email, full_name, cv_filename, cv_text, skills, updated_at)
            VALUES (%s, %s, %s, %s, %s, NOW())
            ON CONFLICT (email) DO UPDATE SET
                cv_filename = EXCLUDED.cv_filename,
                cv_text = EXCLUDED.cv_text,
                skills = EXCLUDED.skills,
                updated_at = NOW();
            """,
            (email, full_name, cv_filename, cv_text or None, skills),
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


def count_saved_jobs_for_user(user_id: int) -> int:
    """Number of jobs saved by this user."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT COUNT(*) FROM saved_jobs WHERE user_id = %s;", (user_id,))
        row = cur.fetchone()
        return int(row[0]) if row and row[0] is not None else 0
    finally:
        cur.close()
        conn.close()


def count_company_active_posted_jobs(company_user_id: int) -> int:
    """Active posted jobs for a company (is_active = TRUE, not expired)."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT COUNT(*) FROM posted_jobs
            WHERE company_user_id = %s
              AND is_active = TRUE
              AND (expires_at IS NULL OR expires_at > NOW());
            """,
            (company_user_id,),
        )
        row = cur.fetchone()
        return int(row[0]) if row and row[0] is not None else 0
    finally:
        cur.close()
        conn.close()


def count_company_contact_requests_last_30_days(company_user_id: int) -> int:
    """Contact requests sent by company in the last 30 days."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT COUNT(*) FROM contact_requests
            WHERE company_user_id = %s
              AND created_at > NOW() - INTERVAL '30 days';
            """,
            (company_user_id,),
        )
        row = cur.fetchone()
        return int(row[0]) if row and row[0] is not None else 0
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


# ---------------------------------------------------------------------------
# Search history (company users)
# ---------------------------------------------------------------------------

def get_search_history(user_id: int, limit: int = 20) -> list:
    """Return search history for a company user. Each dict: id, company_name, required_skills, results_count, searched_at."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT id, company_name, required_skills, results_count, searched_at
            FROM company_searches
            WHERE user_id = %s
            ORDER BY searched_at DESC
            LIMIT %s
            """,
            (user_id, limit),
        )
        rows = cur.fetchall()
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in rows]
    finally:
        cur.close()
        conn.close()


def delete_search_history_item(search_id: int, user_id: int) -> bool:
    """Delete one search history item. Returns True."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "DELETE FROM company_searches WHERE id = %s AND user_id = %s",
            (search_id, user_id),
        )
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


def clear_search_history(user_id: int) -> bool:
    """Delete all search history for a user. Returns True."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM company_searches WHERE user_id = %s", (user_id,))
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


# ---------------------------------------------------------------------------
# Contact requests
# ---------------------------------------------------------------------------

def send_contact_request(
    company_user_id: int,
    candidate_user_id: int,
    message: str,
) -> int:
    """Create or return existing contact request. Returns request id."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT id FROM contact_requests
            WHERE company_user_id = %s AND candidate_user_id = %s
            """,
            (company_user_id, candidate_user_id),
        )
        row = cur.fetchone()
        if row is not None:
            return row[0]
        cur.execute(
            """
            INSERT INTO contact_requests (company_user_id, candidate_user_id, message)
            VALUES (%s, %s, %s)
            RETURNING id
            """,
            (company_user_id, candidate_user_id, message),
        )
        request_id = cur.fetchone()[0]
        conn.commit()
        return request_id
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def get_candidate_requests(candidate_user_id: int) -> list:
    """Return contact requests received by candidate (for job seeker)."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT
                cr.id,
                cr.company_user_id,
                cr.candidate_user_id,
                cr.message,
                cr.status,
                cr.company_email_revealed,
                cr.created_at,
                cr.updated_at,
                cp.company_name,
                u.full_name AS contact_name
            FROM contact_requests cr
            JOIN users u ON u.id = cr.company_user_id
            LEFT JOIN company_profiles cp ON cp.user_id = cr.company_user_id
            WHERE cr.candidate_user_id = %s
            ORDER BY cr.created_at DESC
            """,
            (candidate_user_id,),
        )
        rows = cur.fetchall()
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in rows]
    finally:
        cur.close()
        conn.close()


def get_company_requests(company_user_id: int) -> list:
    """Return contact requests sent by company. candidate_email only when status='accepted'."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT
                cr.id,
                cr.company_user_id,
                cr.candidate_user_id,
                cr.message,
                cr.status,
                cr.company_email_revealed,
                cr.created_at,
                cr.updated_at,
                COALESCE(up.full_name, u.full_name) AS candidate_name,
                up.headline,
                u.email AS candidate_email
            FROM contact_requests cr
            JOIN users u ON u.id = cr.candidate_user_id
            LEFT JOIN user_profiles up ON up.email = u.email
            WHERE cr.company_user_id = %s
            ORDER BY cr.created_at DESC
            """,
            (company_user_id,),
        )
        rows = cur.fetchall()
        cols = [d[0] for d in cur.description]
        result = [dict(zip(cols, row)) for row in rows]
        for r in result:
            if r.get("status") != "accepted":
                r["candidate_email"] = None
        return result
    finally:
        cur.close()
        conn.close()


def update_request_status(
    request_id: int,
    candidate_user_id: int,
    status: str,
) -> bool:
    """Update contact request status (accept/decline). Returns True on success."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            UPDATE contact_requests
            SET status = %s, updated_at = NOW()
            WHERE id = %s AND candidate_user_id = %s
            """,
            (status, request_id, candidate_user_id),
        )
        conn.commit()
        return cur.rowcount > 0
    except Exception:
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


def get_contact_request_by_id(request_id: int) -> Optional[dict]:
    """Get a single contact request by id (for fetching company email on accept)."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT cr.*, u.email AS company_email, u.full_name AS company_contact_name
            FROM contact_requests cr
            JOIN users u ON u.id = cr.company_user_id
            WHERE cr.id = %s
            """,
            (request_id,),
        )
        row = cur.fetchone()
        if row is None:
            return None
        cols = [d[0] for d in cur.description]
        return dict(zip(cols, row))
    finally:
        cur.close()
        conn.close()


# ---------------------------------------------------------------------------
# Contact messages (public contact form)
# ---------------------------------------------------------------------------

def create_contact_message(
    user_id: Optional[int],
    full_name: str,
    email: str,
    company: Optional[str],
    subject: str,
    message: str,
) -> int:
    """Create a contact message and return its id."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO contact_messages (user_id, full_name, email, company, subject, message)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                user_id,
                (full_name or "").strip(),
                (email or "").strip(),
                (company or "").strip() or None,
                (subject or "").strip(),
                (message or "").strip(),
            ),
        )
        message_id = cur.fetchone()[0]
        conn.commit()
        return message_id
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def get_contact_messages(
    limit: int = 50,
    offset: int = 0,
    status: Optional[str] = None,
) -> list:
    """Return admin contact messages ordered by newest first."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        where = []
        params = []
        if status and status.strip():
            where.append("status = %s")
            params.append(status.strip())
        where_sql = f"WHERE {' AND '.join(where)}" if where else ""
        cur.execute(
            f"""
            SELECT
                cm.id,
                cm.user_id,
                cm.full_name,
                cm.email,
                cm.company,
                cm.subject,
                cm.message,
                cm.status,
                cm.created_at,
                cm.updated_at,
                MAX(cmr.created_at) AS last_reply_at,
                COUNT(cmr.id) AS replies_count
            FROM contact_messages cm
            LEFT JOIN contact_message_replies cmr ON cmr.contact_message_id = cm.id
            {where_sql}
            GROUP BY cm.id
            ORDER BY COALESCE(MAX(cmr.created_at), cm.created_at) DESC
            LIMIT %s OFFSET %s
            """,
            tuple(params + [limit, offset]),
        )
        rows = cur.fetchall()
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in rows]
    finally:
        cur.close()
        conn.close()


def update_contact_message_status(message_id: int, status: str) -> bool:
    """Update contact message status. Returns True if updated."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            UPDATE contact_messages
            SET status = %s, updated_at = NOW()
            WHERE id = %s
            """,
            (status, message_id),
        )
        conn.commit()
        return cur.rowcount > 0
    except Exception:
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


def get_contact_message_by_id(message_id: int) -> Optional[dict]:
    """Get a single contact message row."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT id, user_id, full_name, email, company, subject, message, status, created_at, updated_at
            FROM contact_messages
            WHERE id = %s
            """,
            (message_id,),
        )
        row = cur.fetchone()
        if row is None:
            return None
        cols = [d[0] for d in cur.description]
        return dict(zip(cols, row))
    finally:
        cur.close()
        conn.close()


def get_contact_message_thread(message_id: int) -> Optional[dict]:
    """Get message + replies ordered oldest-first."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT id, user_id, full_name, email, company, subject, message, status, created_at, updated_at
            FROM contact_messages
            WHERE id = %s
            """,
            (message_id,),
        )
        root = cur.fetchone()
        if root is None:
            return None
        root_cols = [d[0] for d in cur.description]
        message_obj = dict(zip(root_cols, root))

        cur.execute(
            """
            SELECT id, contact_message_id, sender_type, sender_user_id, message, sent_via, created_at
            FROM contact_message_replies
            WHERE contact_message_id = %s
            ORDER BY created_at ASC, id ASC
            """,
            (message_id,),
        )
        rows = cur.fetchall()
        cols = [d[0] for d in cur.description]
        message_obj["replies"] = [dict(zip(cols, row)) for row in rows]
        return message_obj
    finally:
        cur.close()
        conn.close()


def add_contact_message_reply(
    message_id: int,
    sender_type: str,
    message: str,
    sender_user_id: Optional[int] = None,
    sent_via: str = "backend",
) -> int:
    """Add reply to contact message and return reply id."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO contact_message_replies
            (contact_message_id, sender_type, sender_user_id, message, sent_via)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                message_id,
                sender_type,
                sender_user_id,
                (message or "").strip(),
                sent_via,
            ),
        )
        reply_id = cur.fetchone()[0]
        cur.execute(
            """
            UPDATE contact_messages
            SET updated_at = NOW(),
                status = CASE WHEN status = 'resolved' THEN 'in_progress' ELSE status END
            WHERE id = %s
            """,
            (message_id,),
        )
        conn.commit()
        return reply_id
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def get_user_contact_messages(user_id: int, limit: int = 50, offset: int = 0) -> list:
    """Get contact messages belonging to one logged-in user."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT
                cm.id,
                cm.user_id,
                cm.full_name,
                cm.email,
                cm.company,
                cm.subject,
                cm.message,
                cm.status,
                cm.created_at,
                cm.updated_at,
                MAX(cmr.created_at) AS last_reply_at,
                COUNT(cmr.id) AS replies_count
            FROM contact_messages cm
            LEFT JOIN contact_message_replies cmr ON cmr.contact_message_id = cm.id
            WHERE cm.user_id = %s
            GROUP BY cm.id
            ORDER BY COALESCE(MAX(cmr.created_at), cm.created_at) DESC
            LIMIT %s OFFSET %s
            """,
            (user_id, limit, offset),
        )
        rows = cur.fetchall()
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in rows]
    finally:
        cur.close()
        conn.close()


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------

def create_notification(
    user_id: int,
    type: str,
    title: str,
    message: str,
    link: str = None,
) -> int:
    """Insert notification and return new id."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO notifications
            (user_id, type, title, message, link)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
            """,
            (user_id, type, title, message, link),
        )
        notification_id = cur.fetchone()[0]
        conn.commit()
        return notification_id
    finally:
        cur.close()
        conn.close()


def get_user_notifications(
    user_id: int,
    limit: int = 20,
    unread_only: bool = False,
) -> list:
    """Return notifications for user ordered by newest first."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        query = """
            SELECT id, user_id, type, title, message, link, is_read, created_at
            FROM notifications
            WHERE user_id = %s
        """
        params = [user_id]
        if unread_only:
            query += " AND is_read = FALSE"
        query += " ORDER BY created_at DESC LIMIT %s"
        params.append(limit)
        cur.execute(query, tuple(params))
        rows = cur.fetchall()
        cols = [d[0] for d in cur.description]
        out = []
        for row in rows:
            item = dict(zip(cols, row))
            if item.get("created_at") and hasattr(item["created_at"], "isoformat"):
                item["created_at"] = item["created_at"].isoformat()
            out.append(item)
        return out
    finally:
        cur.close()
        conn.close()


def get_unread_count(user_id: int) -> int:
    """Return unread notifications count for user."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT COUNT(*) FROM notifications
            WHERE user_id = %s AND is_read = FALSE
            """,
            (user_id,),
        )
        return cur.fetchone()[0]
    finally:
        cur.close()
        conn.close()


def count_notifications_for_user(user_id: int) -> int:
    """Return total notification rows for user (read or unread)."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT COUNT(*) FROM notifications WHERE user_id = %s",
            (user_id,),
        )
        return cur.fetchone()[0]
    finally:
        cur.close()
        conn.close()


def mark_notification_read(notification_id: int, user_id: int) -> bool:
    """Mark one notification as read."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            UPDATE notifications
            SET is_read = TRUE
            WHERE id = %s AND user_id = %s
            """,
            (notification_id, user_id),
        )
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


def mark_all_notifications_read(user_id: int) -> bool:
    """Mark all unread notifications as read for user."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            UPDATE notifications
            SET is_read = TRUE
            WHERE user_id = %s AND is_read = FALSE
            """,
            (user_id,),
        )
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


def delete_notification(notification_id: int, user_id: int) -> bool:
    """Delete one notification for user."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            DELETE FROM notifications
            WHERE id = %s AND user_id = %s
            """,
            (notification_id, user_id),
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
# Password reset tokens
# ---------------------------------------------------------------------------

def create_password_reset_token(user_id: int, token: str) -> bool:
    """Store a password reset token (expires in 1 hour). Returns True on success."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO password_reset_tokens (user_id, token, expires_at)
            VALUES (%s, %s, NOW() + INTERVAL '1 hour')
            """,
            (user_id, token),
        )
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


def get_valid_password_reset_token(token: str) -> Optional[dict]:
    """Return token row with user_id and user full_name if token is valid and not expired. None otherwise."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT prt.id, prt.user_id, u.full_name
            FROM password_reset_tokens prt
            JOIN users u ON u.id = prt.user_id
            WHERE prt.token = %s AND prt.used = FALSE AND prt.expires_at > NOW()
            """,
            (token,),
        )
        row = cur.fetchone()
        if row is None:
            return None
        return {"id": row[0], "user_id": row[1], "full_name": row[2]}
    finally:
        cur.close()
        conn.close()


def mark_password_reset_used(token: str) -> bool:
    """Mark a reset token as used. Returns True."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "UPDATE password_reset_tokens SET used = TRUE WHERE token = %s",
            (token,),
        )
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


def update_user_password(user_id: int, hashed_password: str) -> bool:
    """Update user's hashed password. Returns True."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "UPDATE users SET hashed_password = %s WHERE id = %s",
            (hashed_password, user_id),
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
# Admin
# ---------------------------------------------------------------------------

def get_platform_stats() -> dict:
    """Return platform stats for admin dashboard."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        stats = {}
        cur.execute("SELECT COUNT(*) FROM users")
        stats["total_users"] = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM users WHERE user_type = 'jobseeker'")
        stats["total_jobseekers"] = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM users WHERE user_type = 'company'")
        stats["total_companies"] = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM jobs")
        stats["total_jobs"] = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM job_applications")
        stats["total_applications"] = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM contact_requests")
        stats["total_contact_requests"] = cur.fetchone()[0]
        cur.execute(
            "SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '24 hours'"
        )
        stats["new_users_today"] = cur.fetchone()[0]
        cur.execute(
            "SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '7 days'"
        )
        stats["new_users_week"] = cur.fetchone()[0]
        cur.execute(
            "SELECT COUNT(*) FROM jobs WHERE scraped_at > NOW() - INTERVAL '24 hours'"
        )
        stats["jobs_scraped_today"] = cur.fetchone()[0]
        return stats
    finally:
        cur.close()
        conn.close()


def remove_duplicate_jobs() -> int:
    conn = get_connection()
    cur = conn.cursor()
    try:
        # Delete duplicates keeping the most recent one
        cur.execute(
            """
            DELETE FROM jobs a
            USING jobs b
            WHERE a.id < b.id
            AND a.job_url = b.job_url
            """
        )
        deleted = cur.rowcount
        conn.commit()
        return deleted
    finally:
        cur.close()
        conn.close()


def normalize_job_sources() -> int:
    """Normalize source names in existing jobs rows."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            UPDATE jobs
            SET source = CASE
                WHEN LOWER(TRIM(source)) IN ('hirelebanese', 'hire_lebanese') THEN 'HireLebanese'
                WHEN LOWER(TRIM(source)) IN ('weworkremotely', 'we_work_remotely') THEN 'WeWorkRemotely'
                WHEN LOWER(TRIM(source)) IN ('remoteok', 'remote_ok') THEN 'RemoteOK'
                WHEN LOWER(TRIM(source)) = 'remotive' THEN 'Remotive'
                WHEN LOWER(TRIM(source)) = 'himalayas' THEN 'Himalayas'
                WHEN LOWER(TRIM(source)) = 'arbeitnow' THEN 'Arbeitnow'
                WHEN LOWER(TRIM(source)) = 'bayt' THEN 'Bayt'
                WHEN LOWER(TRIM(source)) = 'linkedin' THEN 'LinkedIn'
                WHEN LOWER(TRIM(source)) = 'indeed' THEN 'Indeed'
                WHEN LOWER(TRIM(source)) IN ('careersandjobs', 'careers_and_jobs', 'careersandjobsinlebanon', 'careers_and_jobs_in_lebanon')
                    THEN 'CareersAndJobsInLebanon'
                ELSE source
            END
            WHERE source IS NOT NULL AND TRIM(source) != '';
            """
        )
        updated = cur.rowcount
        conn.commit()
        return updated
    finally:
        cur.close()
        conn.close()


def remove_inactive_or_expired_jobs() -> dict:
    """
    Remove jobs that are no longer active or expired.
    - Scraped jobs table: delete where is_active = FALSE
    - Posted jobs table: delete where is_active = FALSE or expires_at <= NOW()
    Returns deletion counts.
    """
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM jobs WHERE is_active = FALSE")
        deleted_scraped = cur.rowcount

        cur.execute(
            """
            DELETE FROM posted_jobs
            WHERE is_active = FALSE
               OR (expires_at IS NOT NULL AND expires_at <= NOW())
            """
        )
        deleted_posted = cur.rowcount

        conn.commit()
        return {
            "deleted_scraped": deleted_scraped,
            "deleted_posted": deleted_posted,
            "total_deleted": deleted_scraped + deleted_posted,
        }
    finally:
        cur.close()
        conn.close()


def get_all_users(limit: int = 50, offset: int = 0, search: Optional[str] = None) -> list:
    """Return users for admin list. If search is set, filter by email or full_name ILIKE."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        if search and search.strip():
            pattern = f"%{search.strip()}%"
            cur.execute(
                """
                SELECT id, email, full_name, user_type, is_active, is_admin, created_at
                FROM users
                WHERE email ILIKE %s OR full_name ILIKE %s
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s
                """,
                (pattern, pattern, limit, offset),
            )
        else:
            cur.execute(
                """
                SELECT id, email, full_name, user_type, is_active, is_admin, created_at
                FROM users
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s
                """,
                (limit, offset),
            )
        rows = cur.fetchall()
        cols = ["id", "email", "full_name", "user_type", "is_active", "is_admin", "created_at"]
        out = []
        for row in rows:
            d = dict(zip(cols, row))
            if d.get("created_at") and hasattr(d["created_at"], "isoformat"):
                d["created_at"] = d["created_at"].isoformat()
            out.append(d)
        return out
    finally:
        cur.close()
        conn.close()


def get_all_users_total(search: Optional[str] = None) -> int:
    """Return total count of users (for pagination). If search set, filter by email or full_name."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        if search and search.strip():
            pattern = f"%{search.strip()}%"
            cur.execute(
                "SELECT COUNT(*) FROM users WHERE email ILIKE %s OR full_name ILIKE %s",
                (pattern, pattern),
            )
        else:
            cur.execute("SELECT COUNT(*) FROM users")
        return cur.fetchone()[0]
    finally:
        cur.close()
        conn.close()


def toggle_user_active(user_id: int) -> bool:
    """Toggle is_active for user. Returns True."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "UPDATE users SET is_active = NOT is_active WHERE id = %s",
            (user_id,),
        )
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


def make_user_admin(user_id: int) -> bool:
    """Set is_admin = TRUE for user. Returns True."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("UPDATE users SET is_admin = TRUE WHERE id = %s", (user_id,))
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


def get_recent_activity() -> list:
    """Return last 20 activities: registrations, contact_requests, job_applications. Sorted by created_at DESC."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        activities = []
        cur.execute(
            """
            SELECT full_name, user_type, created_at
            FROM users
            ORDER BY created_at DESC
            LIMIT 20
            """
        )
        for row in cur.fetchall():
            name, utype, created_at = row
            activities.append({
                "type": "registration",
                "description": f"{name or 'Someone'} joined as {utype or 'user'}",
                "created_at": created_at,
            })
        cur.execute(
            """
            SELECT id, created_at FROM contact_requests
            ORDER BY created_at DESC
            LIMIT 20
            """
        )
        for row in cur.fetchall():
            activities.append({
                "type": "contact_request",
                "description": "Contact request sent",
                "created_at": row[1],
            })
        cur.execute(
            """
            SELECT id, applied_at FROM job_applications
            ORDER BY applied_at DESC
            LIMIT 20
            """
        )
        for row in cur.fetchall():
            activities.append({
                "type": "application",
                "description": "New application tracked",
                "created_at": row[1],
            })
        for a in activities:
            if a.get("created_at") and hasattr(a["created_at"], "isoformat"):
                a["created_at"] = a["created_at"].isoformat()
        activities.sort(key=lambda x: x.get("created_at") or "", reverse=True)
        return activities[:20]
    finally:
        cur.close()
        conn.close()


# ---------------------------------------------------------------------------
# Subscriptions (Stripe)
# ---------------------------------------------------------------------------

def get_user_subscription(user_id: int) -> Optional[dict]:
    """Return subscription row for user_id or None."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT id, user_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end, created_at, updated_at FROM subscriptions WHERE user_id = %s",
            (user_id,),
        )
        row = cur.fetchone()
        if row is None:
            return None
        cols = ["id", "user_id", "stripe_customer_id", "stripe_subscription_id", "plan", "status", "current_period_end", "created_at", "updated_at"]
        out = dict(zip(cols, row))
        for k in ("current_period_end", "created_at", "updated_at"):
            if out.get(k) and hasattr(out[k], "isoformat"):
                out[k] = out[k].isoformat()
        return out
    finally:
        cur.close()
        conn.close()


def upsert_subscription(
    user_id: int,
    stripe_customer_id: str,
    stripe_subscription_id: str,
    plan: str,
    status: str,
    current_period_end,
) -> bool:
    """Insert or update subscription; also set users.plan. Returns True."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO subscriptions
                (user_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                stripe_customer_id = EXCLUDED.stripe_customer_id,
                stripe_subscription_id = EXCLUDED.stripe_subscription_id,
                plan = EXCLUDED.plan,
                status = EXCLUDED.status,
                current_period_end = EXCLUDED.current_period_end,
                updated_at = NOW();
            """,
            (user_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end),
        )
        cur.execute("UPDATE users SET plan = %s WHERE id = %s", (plan, user_id))
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


def cancel_subscription(user_id: int) -> bool:
    """Set subscription status to canceled and users.plan to free. Returns True."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "UPDATE subscriptions SET status = 'canceled', updated_at = NOW() WHERE user_id = %s",
            (user_id,),
        )
        cur.execute("UPDATE users SET plan = 'free' WHERE id = %s", (user_id,))
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


def get_user_id_by_stripe_subscription_id(stripe_subscription_id: str) -> Optional[int]:
    """Return user_id for a given stripe_subscription_id or None."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT user_id FROM subscriptions WHERE stripe_subscription_id = %s",
            (stripe_subscription_id,),
        )
        row = cur.fetchone()
        return row[0] if row else None
    finally:
        cur.close()
        conn.close()


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------

def get_jobseeker_analytics(user_id: int) -> dict:
    """Return analytics dict for a jobseeker."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        out = {
            "applications_by_status": {"applied": 0, "interviewing": 0, "offer": 0, "rejected": 0},
            "applications_over_time": [],
            "top_companies_applied": [],
            "saved_jobs_count": 0,
            "profile_completeness": 0,
            "skills_count": 0,
            "contact_requests_received": 0,
            "contact_requests_accepted": 0,
        }
        cur.execute(
            "SELECT status, COUNT(*) FROM job_applications WHERE user_id = %s GROUP BY status",
            (user_id,),
        )
        for row in cur.fetchall():
            status, count = row[0], row[1]
            if status in out["applications_by_status"]:
                out["applications_by_status"][status] = count
        cur.execute(
            """
            SELECT DATE(applied_at) AS date, COUNT(*)
            FROM job_applications
            WHERE user_id = %s AND applied_at > NOW() - INTERVAL '30 days'
            GROUP BY DATE(applied_at)
            ORDER BY date ASC
            """,
            (user_id,),
        )
        for row in cur.fetchall():
            d, c = row[0], row[1]
            out["applications_over_time"].append({"date": d.isoformat()[:10] if hasattr(d, "isoformat") else str(d)[:10], "count": c})
        cur.execute(
            """
            SELECT company, COUNT(*) AS count
            FROM job_applications
            WHERE user_id = %s
            GROUP BY company
            ORDER BY count DESC
            LIMIT 5
            """,
            (user_id,),
        )
        for row in cur.fetchall():
            out["top_companies_applied"].append({"company": row[0] or "Unknown", "count": row[1]})
        cur.execute("SELECT COUNT(*) FROM saved_jobs WHERE user_id = %s", (user_id,))
        out["saved_jobs_count"] = cur.fetchone()[0] or 0
        profile = get_user_profile(user_id)
        if profile:
            skills = profile.get("skills") or []
            out["skills_count"] = len(skills) if isinstance(skills, list) else 0
            filled = 0
            for k in ("headline", "bio", "location", "cv_filename"):
                v = profile.get(k)
                if v is not None and (str(v).strip() if isinstance(v, str) else True):
                    filled += 1
            if skills:
                filled += 1
            out["profile_completeness"] = min(100, round((filled / 5.0) * 100))
        cur.execute(
            "SELECT status, COUNT(*) FROM contact_requests WHERE candidate_user_id = %s GROUP BY status",
            (user_id,),
        )
        for row in cur.fetchall():
            status, count = row[0], row[1]
            out["contact_requests_received"] += count
            if status == "accepted":
                out["contact_requests_accepted"] = count
        if out["contact_requests_accepted"] == 0 and out["contact_requests_received"] > 0:
            cur.execute(
                "SELECT COUNT(*) FROM contact_requests WHERE candidate_user_id = %s AND status = 'accepted'",
                (user_id,),
            )
            out["contact_requests_accepted"] = cur.fetchone()[0] or 0
        return out
    finally:
        cur.close()
        conn.close()


def get_company_analytics(user_id: int) -> dict:
    """Return analytics dict for a company."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        out = {
            "searches_over_time": [],
            "top_searched_skills": [],
            "saved_candidates_count": 0,
            "contact_requests_sent": 0,
            "contact_requests_accepted": 0,
            "avg_results_per_search": 0.0,
            "total_searches": 0,
        }
        cur.execute(
            """
            SELECT DATE(searched_at) AS date, COUNT(*)
            FROM company_searches
            WHERE user_id = %s AND searched_at > NOW() - INTERVAL '30 days'
            GROUP BY DATE(searched_at)
            ORDER BY date ASC
            """,
            (user_id,),
        )
        for row in cur.fetchall():
            d, c = row[0], row[1]
            out["searches_over_time"].append({"date": d.isoformat()[:10] if hasattr(d, "isoformat") else str(d)[:10], "count": c})
        cur.execute(
            """
            SELECT skill, COUNT(*) AS count
            FROM (
                SELECT unnest(required_skills) AS skill
                FROM company_searches
                WHERE user_id = %s AND required_skills IS NOT NULL
            ) t
            GROUP BY skill
            ORDER BY count DESC
            LIMIT 10
            """,
            (user_id,),
        )
        for row in cur.fetchall():
            out["top_searched_skills"].append({"skill": row[0] or "?", "count": row[1]})
        cur.execute(
            "SELECT COUNT(*) FROM saved_candidates WHERE company_user_id = %s",
            (user_id,),
        )
        out["saved_candidates_count"] = cur.fetchone()[0] or 0
        cur.execute(
            "SELECT status, COUNT(*) FROM contact_requests WHERE company_user_id = %s GROUP BY status",
            (user_id,),
        )
        for row in cur.fetchall():
            status, count = row[0], row[1]
            out["contact_requests_sent"] += count
            if status == "accepted":
                out["contact_requests_accepted"] = count
        if out["contact_requests_accepted"] == 0 and out["contact_requests_sent"] > 0:
            cur.execute(
                "SELECT COUNT(*) FROM contact_requests WHERE company_user_id = %s AND status = 'accepted'",
                (user_id,),
            )
            out["contact_requests_accepted"] = cur.fetchone()[0] or 0
        cur.execute(
            "SELECT COUNT(*), COALESCE(AVG(results_count), 0) FROM company_searches WHERE user_id = %s",
            (user_id,),
        )
        row = cur.fetchone()
        out["total_searches"] = row[0] or 0
        out["avg_results_per_search"] = round(float(row[1] or 0), 1)
        return out
    finally:
        cur.close()
        conn.close()


# ---------------------------------------------------------------------------
# Job alerts
# ---------------------------------------------------------------------------

def get_alert_settings(user_id: int) -> dict:
    """Return job alert settings for user_id or default dict."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT id, user_id, is_enabled, frequency, min_match_score, last_sent_at, created_at, updated_at FROM job_alert_settings WHERE user_id = %s",
            (user_id,),
        )
        row = cur.fetchone()
        if row is None:
            return {"is_enabled": True, "frequency": "daily", "min_match_score": 70}
        cols = ["id", "user_id", "is_enabled", "frequency", "min_match_score", "last_sent_at", "created_at", "updated_at"]
        out = dict(zip(cols, row))
        for k in ("last_sent_at", "created_at", "updated_at"):
            if out.get(k) and hasattr(out[k], "isoformat"):
                out[k] = out[k].isoformat()
        return out
    finally:
        cur.close()
        conn.close()


def upsert_alert_settings(
    user_id: int,
    is_enabled: bool,
    frequency: str,
    min_match_score: int,
) -> bool:
    """Insert or update job_alert_settings. Returns True."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO job_alert_settings (user_id, is_enabled, frequency, min_match_score, updated_at)
            VALUES (%s, %s, %s, %s, NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                is_enabled = EXCLUDED.is_enabled,
                frequency = EXCLUDED.frequency,
                min_match_score = EXCLUDED.min_match_score,
                updated_at = NOW();
            """,
            (user_id, is_enabled, frequency, min_match_score),
        )
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


def get_users_for_alerts() -> list:
    """Return list of jobseeker users with alerts enabled and skills. Join users + user_profiles (by email) + job_alert_settings."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT
                u.id,
                u.email,
                u.full_name,
                p.skills,
                jas.frequency,
                jas.min_match_score,
                jas.last_sent_at
            FROM users u
            JOIN user_profiles p ON p.email = u.email
            JOIN job_alert_settings jas ON jas.user_id = u.id
            WHERE u.user_type = 'jobseeker'
            AND u.is_active = TRUE
            AND jas.is_enabled = TRUE
            AND p.skills IS NOT NULL
            AND array_length(p.skills, 1) > 0
            """
        )
        rows = cur.fetchall()
        cols = ["id", "email", "full_name", "skills", "frequency", "min_match_score", "last_sent_at"]
        out = []
        for row in rows:
            d = dict(zip(cols, row))
            if d["skills"] is None:
                d["skills"] = []
            out.append(d)
        return out
    finally:
        cur.close()
        conn.close()


def get_recent_jobs(limit: int = 10) -> list:
    """Return most recent jobs (is_active=True), for test alerts."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT id, source, job_title, company, location, description, job_url, scraped_at
            FROM jobs
            WHERE is_active = TRUE
            ORDER BY scraped_at DESC NULLS LAST
            LIMIT %s
            """,
            (limit,),
        )
        rows = cur.fetchall()
        cols = ["id", "source", "job_title", "company", "location", "description", "job_url", "scraped_at"]
        out = []
        for row in rows:
            d = dict(zip(cols, row))
            if d.get("scraped_at") and hasattr(d["scraped_at"], "isoformat"):
                d["scraped_at"] = d["scraped_at"].isoformat()
            out.append(d)
        return out
    finally:
        cur.close()
        conn.close()


def get_new_jobs_since(since_timestamp) -> list:
    """Return jobs scraped after since_timestamp, is_active=True, limit 100."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT id, source, job_title, company, location, description, job_url, scraped_at
            FROM jobs
            WHERE scraped_at > %s AND is_active = TRUE
            ORDER BY scraped_at DESC
            LIMIT 100
            """,
            (since_timestamp,),
        )
        rows = cur.fetchall()
        cols = ["id", "source", "job_title", "company", "location", "description", "job_url", "scraped_at"]
        out = []
        for row in rows:
            d = dict(zip(cols, row))
            if d.get("scraped_at") and hasattr(d["scraped_at"], "isoformat"):
                d["scraped_at"] = d["scraped_at"].isoformat()
            out.append(d)
        return out
    finally:
        cur.close()
        conn.close()


def search_jobs(
    q: Optional[str] = None,
    source: Optional[str] = None,
    location: Optional[str] = None,
    date_posted: Optional[str] = None,
    sort_by: str = "recent",
    limit: int = 20,
    offset: int = 0,
) -> Tuple[list, int]:
    """
    Search jobs with optional filters. Returns (list of job dicts, total count).
    """
    conn = get_connection()
    cur = conn.cursor()
    try:
        where = ["is_active = TRUE"]
        params = []
        if q and q.strip():
            t = f"%{q.strip()}%"
            where.append("(job_title ILIKE %s OR company ILIKE %s OR description ILIKE %s)")
            params.extend([t, t, t])
        if source and source.strip():
            where.append("LOWER(TRIM(source)) = LOWER(TRIM(%s))")
            params.append(source.strip())
        if location and location.strip():
            where.append("location ILIKE %s")
            params.append(f"%{location.strip()}%")
        if date_posted == "24h":
            where.append("scraped_at > NOW() - INTERVAL '24 hours'")
        elif date_posted == "7d":
            where.append("scraped_at > NOW() - INTERVAL '7 days'")
        elif date_posted == "30d":
            where.append("scraped_at > NOW() - INTERVAL '30 days'")
        where_sql = " AND ".join(where)
        order = "ORDER BY scraped_at DESC NULLS LAST" if sort_by == "recent" else "ORDER BY job_title ASC"
        cur.execute(
            f"""
            SELECT id, source, job_title, company, location, description, job_url, scraped_at
            FROM jobs
            WHERE {where_sql}
            {order}
            LIMIT %s OFFSET %s
            """,
            params + [limit, offset],
        )
        rows = cur.fetchall()
        cols = ["id", "source", "job_title", "company", "location", "description", "job_url", "scraped_at"]
        out = []
        for row in rows:
            d = dict(zip(cols, row))
            if d.get("scraped_at") and hasattr(d["scraped_at"], "isoformat"):
                d["scraped_at"] = d["scraped_at"].isoformat()
            out.append(d)
        cur.execute(
            f"SELECT COUNT(*) FROM jobs WHERE {where_sql}",
            tuple(params),
        )
        total = cur.fetchone()[0]
        return out, total
    finally:
        cur.close()
        conn.close()


def get_job_sources() -> list:
    """Return distinct active job sources, ordered."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT source
            FROM (
                SELECT DISTINCT ON (LOWER(TRIM(source)))
                    TRIM(source) AS source
                FROM jobs
                WHERE is_active = TRUE
                  AND source IS NOT NULL
                  AND TRIM(source) != ''
                ORDER BY LOWER(TRIM(source)), id DESC
            ) s
            ORDER BY source
            """
        )
        return [r[0] for r in cur.fetchall()]
    finally:
        cur.close()
        conn.close()


def get_job_locations(limit: int = 50) -> list:
    """Return distinct job locations (non-null, non-empty), ordered, limited."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT DISTINCT location FROM jobs
            WHERE is_active = TRUE AND location IS NOT NULL AND TRIM(location) != ''
            ORDER BY location
            LIMIT %s
            """,
            (limit,),
        )
        return [r[0] for r in cur.fetchall()]
    finally:
        cur.close()
        conn.close()


def get_job_by_id(job_id: int) -> Optional[dict]:
    """Return scraped job from jobs table by id."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT id, source, job_title, company, location, description, job_url, scraped_at
            FROM jobs
            WHERE id = %s AND is_active = TRUE
            """,
            (job_id,),
        )
        row = cur.fetchone()
        if row is None:
            return None
        cols = ["id", "source", "job_title", "company", "location", "description", "job_url", "scraped_at"]
        out = dict(zip(cols, row))
        if out.get("scraped_at") and hasattr(out["scraped_at"], "isoformat"):
            out["scraped_at"] = out["scraped_at"].isoformat()
        return out
    finally:
        cur.close()
        conn.close()


def mark_jobs_as_alerted(user_id: int, job_ids: list) -> bool:
    """Insert into sent_job_alerts for each job_id (ON CONFLICT DO NOTHING), then update last_sent_at."""
    if not job_ids:
        return True
    conn = get_connection()
    cur = conn.cursor()
    try:
        for jid in job_ids:
            cur.execute(
                "INSERT INTO sent_job_alerts (user_id, job_id) VALUES (%s, %s) ON CONFLICT (user_id, job_id) DO NOTHING",
                (user_id, jid),
            )
        cur.execute(
            "UPDATE job_alert_settings SET last_sent_at = NOW() WHERE user_id = %s",
            (user_id,),
        )
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


def get_already_alerted_job_ids(user_id: int) -> set:
    """Return set of job_ids already sent to this user."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT job_id FROM sent_job_alerts WHERE user_id = %s", (user_id,))
        return {row[0] for row in cur.fetchall()}
    finally:
        cur.close()
        conn.close()


# ---------------------------------------------------------------------------
# Public profile (slug, visibility)
# ---------------------------------------------------------------------------

def generate_slug(full_name: str, user_id: int) -> str:
    """Convert full_name to a unique slug with user_id suffix."""
    slug = (full_name or "").lower()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"\s+", "-", slug.strip())
    slug = (slug or "user") + "-" + str(user_id)
    return slug


def get_profile_by_slug(slug: str) -> Optional[dict]:
    """Return public profile by slug; exclude sensitive fields and email."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT
                p.full_name,
                p.headline,
                p.bio,
                p.location,
                p.linkedin_url,
                p.years_experience,
                p.skills,
                p.profile_slug,
                p.is_public,
                p.created_at,
                u.full_name AS user_full_name,
                u.id AS user_id
            FROM user_profiles p
            JOIN users u ON u.email = p.email
            WHERE p.profile_slug = %s
            AND p.is_public = TRUE
            AND u.is_active = TRUE
            """,
            (slug,),
        )
        row = cur.fetchone()
        if row is None:
            return None
        full_name = row[0] or row[10] or ""
        headline = row[1]
        bio = row[2]
        location = row[3]
        linkedin_url = row[4]
        years_experience = row[5]
        skills = row[6] or []
        profile_slug = row[7]
        is_public = row[8]
        created_at = row[9]
        user_id = row[11]
        year = created_at.year if created_at and hasattr(created_at, "year") else None
        return {
            "full_name": full_name,
            "headline": headline,
            "bio": bio,
            "location": location,
            "linkedin_url": linkedin_url,
            "years_experience": years_experience,
            "skills": skills,
            "profile_slug": profile_slug,
            "is_public": is_public,
            "member_since": year,
            "user_id": user_id,
        }
    finally:
        cur.close()
        conn.close()


def ensure_user_has_slug(user_id: int, full_name: str) -> str:
    """Ensure user has a profile_slug; create or update as needed. Return slug."""
    user = get_user_by_id(user_id)
    if not user:
        raise ValueError("User not found")
    email = user["email"]
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT profile_slug FROM user_profiles WHERE email = %s",
            (email,),
        )
        row = cur.fetchone()
        if row and row[0]:
            return row[0]
        slug = generate_slug(full_name, user_id)
        cur.execute(
            """
            INSERT INTO user_profiles (email, full_name, profile_slug, is_public)
            VALUES (%s, %s, %s, TRUE)
            ON CONFLICT (email) DO UPDATE SET
                profile_slug = CASE
                    WHEN user_profiles.profile_slug IS NULL OR TRIM(user_profiles.profile_slug) = ''
                    THEN EXCLUDED.profile_slug
                    ELSE user_profiles.profile_slug
                END,
                full_name = COALESCE(NULLIF(TRIM(user_profiles.full_name), ''), EXCLUDED.full_name)
            """,
            (email, full_name or user.get("full_name"), slug),
        )
        conn.commit()
        cur.execute("SELECT profile_slug FROM user_profiles WHERE email = %s", (email,))
        row = cur.fetchone()
        return (row[0] or slug) if row else slug
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def update_profile_visibility(user_id: int, is_public: bool) -> bool:
    """Update user_profiles.is_public for this user (by email). Returns True."""
    user = get_user_by_id(user_id)
    if not user:
        return False
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "UPDATE user_profiles SET is_public = %s WHERE email = %s",
            (is_public, user["email"]),
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
# Company posted jobs
# ---------------------------------------------------------------------------

def create_posted_job(company_user_id: int, data: dict) -> int:
    """Insert a posted job. Return new job id."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        expires_at = data.get("expires_at")
        if isinstance(expires_at, str) and expires_at.strip():
            try:
                from datetime import datetime
                expires_at = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            except Exception:
                expires_at = None
        elif expires_at is not None and not hasattr(expires_at, "isoformat"):
            expires_at = None
        cur.execute(
            """
            INSERT INTO posted_jobs (
                company_user_id, title, company_name, location, job_type,
                experience_level, salary_min, salary_max, salary_currency,
                description, requirements, benefits, skills_required,
                application_url, application_email, expires_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                company_user_id,
                (data.get("title") or "").strip(),
                (data.get("company_name") or "").strip(),
                data.get("location") or None,
                (data.get("job_type") or "full-time").strip(),
                (data.get("experience_level") or "mid").strip(),
                data.get("salary_min"),
                data.get("salary_max"),
                (data.get("salary_currency") or "USD").strip(),
                (data.get("description") or "").strip(),
                (data.get("requirements") or "").strip() or None,
                (data.get("benefits") or "").strip() or None,
                data.get("skills_required") or [],
                (data.get("application_url") or "").strip() or None,
                (data.get("application_email") or "").strip() or None,
                expires_at,
            ),
        )
        job_id = cur.fetchone()[0]
        conn.commit()
        return job_id
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def get_company_posted_jobs(company_user_id: int) -> list:
    """Return all posted jobs for this company, newest first."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT id, company_user_id, title, company_name, location, job_type,
                   experience_level, salary_min, salary_max, salary_currency,
                   description, requirements, benefits, skills_required,
                   application_url, application_email, is_active, is_featured,
                   views_count, applications_count, expires_at, created_at, updated_at
            FROM posted_jobs
            WHERE company_user_id = %s
            ORDER BY created_at DESC
            """,
            (company_user_id,),
        )
        rows = cur.fetchall()
        cols = [
            "id", "company_user_id", "title", "company_name", "location", "job_type",
            "experience_level", "salary_min", "salary_max", "salary_currency",
            "description", "requirements", "benefits", "skills_required",
            "application_url", "application_email", "is_active", "is_featured",
            "views_count", "applications_count", "expires_at", "created_at", "updated_at",
        ]
        out = []
        for row in rows:
            d = dict(zip(cols, row))
            for k in ("expires_at", "created_at", "updated_at"):
                if d.get(k) and hasattr(d[k], "isoformat"):
                    d[k] = d[k].isoformat()
            out.append(d)
        return out
    finally:
        cur.close()
        conn.close()


def get_all_posted_jobs(
    limit: int = 20,
    offset: int = 0,
    job_type: Optional[str] = None,
    experience_level: Optional[str] = None,
    search: Optional[str] = None,
) -> list:
    """Return active, non-expired posted jobs with optional filters."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        q = """
            SELECT pj.id, pj.company_user_id, pj.title, pj.company_name, pj.location,
                   pj.job_type, pj.experience_level, pj.salary_min, pj.salary_max,
                   pj.salary_currency, pj.description, pj.requirements, pj.benefits,
                   pj.skills_required, pj.application_url, pj.application_email,
                   pj.is_active, pj.is_featured, pj.views_count, pj.applications_count,
                   pj.expires_at, pj.created_at, pj.updated_at,
                   cp.company_name AS profile_company_name
            FROM posted_jobs pj
            LEFT JOIN company_profiles cp ON cp.user_id = pj.company_user_id
            WHERE pj.is_active = TRUE
            AND (pj.expires_at IS NULL OR pj.expires_at > NOW())
            """
        params = []
        if job_type:
            q += " AND pj.job_type = %s"
            params.append(job_type)
        if experience_level:
            q += " AND pj.experience_level = %s"
            params.append(experience_level)
        if search and search.strip():
            q += " AND (pj.title ILIKE %s OR pj.description ILIKE %s)"
            t = f"%{search.strip()}%"
            params.extend([t, t])
        q += " ORDER BY pj.is_featured DESC, pj.created_at DESC LIMIT %s OFFSET %s"
        params.extend([limit, offset])
        cur.execute(q, tuple(params))
        rows = cur.fetchall()
        cols = [
            "id", "company_user_id", "title", "company_name", "location", "job_type",
            "experience_level", "salary_min", "salary_max", "salary_currency",
            "description", "requirements", "benefits", "skills_required",
            "application_url", "application_email", "is_active", "is_featured",
            "views_count", "applications_count", "expires_at", "created_at", "updated_at",
            "profile_company_name",
        ]
        out = []
        for row in rows:
            d = dict(zip(cols, row))
            if d.get("profile_company_name") and not d.get("company_name"):
                d["company_name"] = d["profile_company_name"]
            for k in ("expires_at", "created_at", "updated_at"):
                if d.get(k) and hasattr(d[k], "isoformat"):
                    d[k] = d[k].isoformat()
            out.append(d)
        return out
    finally:
        cur.close()
        conn.close()


def count_all_posted_jobs(
    job_type: Optional[str] = None,
    experience_level: Optional[str] = None,
    search: Optional[str] = None,
) -> int:
    """Count active, non-expired posted jobs with the same filters as get_all_posted_jobs."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        q = """
            SELECT COUNT(*)
            FROM posted_jobs pj
            WHERE pj.is_active = TRUE
            AND (pj.expires_at IS NULL OR pj.expires_at > NOW())
            """
        params = []
        if job_type:
            q += " AND pj.job_type = %s"
            params.append(job_type)
        if experience_level:
            q += " AND pj.experience_level = %s"
            params.append(experience_level)
        if search and search.strip():
            q += " AND (pj.title ILIKE %s OR pj.description ILIKE %s)"
            t = f"%{search.strip()}%"
            params.extend([t, t])
        cur.execute(q, tuple(params))
        row = cur.fetchone()
        return int(row[0]) if row and row[0] is not None else 0
    finally:
        cur.close()
        conn.close()


def get_posted_job_by_id(job_id: int) -> Optional[dict]:
    """Return posted job by id with company info; increment views_count."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT pj.id, pj.company_user_id, pj.title, pj.company_name, pj.location,
                   pj.job_type, pj.experience_level, pj.salary_min, pj.salary_max,
                   pj.salary_currency, pj.description, pj.requirements, pj.benefits,
                   pj.skills_required, pj.application_url, pj.application_email,
                   pj.is_active, pj.is_featured, pj.views_count, pj.applications_count,
                   pj.expires_at, pj.created_at, pj.updated_at,
                   cp.description AS company_desc, cp.website AS company_website,
                   cp.industry, cp.company_size
            FROM posted_jobs pj
            LEFT JOIN company_profiles cp ON cp.user_id = pj.company_user_id
            WHERE pj.id = %s
            """,
            (job_id,),
        )
        row = cur.fetchone()
        if row is None:
            return None
        cols = [
            "id", "company_user_id", "title", "company_name", "location", "job_type",
            "experience_level", "salary_min", "salary_max", "salary_currency",
            "description", "requirements", "benefits", "skills_required",
            "application_url", "application_email", "is_active", "is_featured",
            "views_count", "applications_count", "expires_at", "created_at", "updated_at",
            "company_desc", "company_website", "industry", "company_size",
        ]
        d = dict(zip(cols, row))
        for k in ("expires_at", "created_at", "updated_at"):
            if d.get(k) and hasattr(d[k], "isoformat"):
                d[k] = d[k].isoformat()
        cur.execute(
            "UPDATE posted_jobs SET views_count = views_count + 1 WHERE id = %s",
            (job_id,),
        )
        conn.commit()
        return d
    finally:
        cur.close()
        conn.close()


def update_posted_job(job_id: int, company_user_id: int, data: dict) -> bool:
    """Update posted job. Only non-None keys in data are updated."""
    allowed = (
        "title", "company_name", "location", "job_type", "experience_level",
        "salary_min", "salary_max", "salary_currency", "description",
        "requirements", "benefits", "skills_required",
        "application_url", "application_email", "is_active",
    )
    updates = []
    values = []
    for k in allowed:
        if k not in data:
            continue
        v = data[k]
        if k in ("title", "company_name", "description", "requirements", "benefits",
                 "application_url", "application_email", "location", "salary_currency"):
            v = (v or "").strip() or None
        if k == "skills_required" and v is not None and not isinstance(v, list):
            v = []
        updates.append(f"{k} = %s")
        values.append(v)
    if not updates:
        return True
    values.extend([job_id, company_user_id])
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            f"UPDATE posted_jobs SET {', '.join(updates)}, updated_at = NOW() WHERE id = %s AND company_user_id = %s",
            tuple(values),
        )
        conn.commit()
        return cur.rowcount > 0
    except Exception:
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


def toggle_job_active(job_id: int, company_user_id: int) -> bool:
    """Toggle is_active. Return True."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "UPDATE posted_jobs SET is_active = NOT is_active, updated_at = NOW() WHERE id = %s AND company_user_id = %s",
            (job_id, company_user_id),
        )
        conn.commit()
        return cur.rowcount > 0
    except Exception:
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


def delete_posted_job(job_id: int, company_user_id: int) -> bool:
    """Delete posted job. Return True if deleted."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "DELETE FROM posted_jobs WHERE id = %s AND company_user_id = %s",
            (job_id, company_user_id),
        )
        conn.commit()
        return cur.rowcount > 0
    except Exception:
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    init_database()
    