# app/database/db.py

import re
import json
import psycopg2
import os
from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple, List, Dict, Any
from psycopg2.extras import Json
#from .db import get_db, get_connection
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
        password=os.getenv('DB_PASSWORD', 'AliTlais@2004'),
        port=int(os.getenv('DB_PORT', '5433'))  # 5433 = Docker Postgres
    )


def ensure_admin_platform_tables() -> None:
    """Create admin tables added after initial deploy (safe to run on every API start)."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS announcements (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                target VARCHAR(20) DEFAULT 'all',
                sent_by INTEGER REFERENCES users(id),
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                recipients_count INTEGER DEFAULT 0
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS platform_settings (
                id SERIAL PRIMARY KEY,
                key VARCHAR(100) UNIQUE NOT NULL,
                value VARCHAR(255) NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        cur.execute("""
            ALTER TABLE notifications
            ADD COLUMN IF NOT EXISTS announcement_id INTEGER
            REFERENCES announcements(id) ON DELETE CASCADE
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_notifications_announcement
            ON notifications(announcement_id)
            WHERE announcement_id IS NOT NULL
        """)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def ensure_notification_application_types() -> None:
    """Allow in-app notification types for Vertex application pipeline."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;"
        )
        cur.execute("""
            ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
            CHECK (type IN (
                'contact_request',
                'request_accepted',
                'request_declined',
                'job_alert',
                'new_job_match',
                'profile_view',
                'system',
                'job_application',
                'application_status'
            ));
        """)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def create_archive_tables() -> None:
    """
    Create archive tables for expired/stale jobs (safe to run on every API start).

    archived_jobs        — mirrors the scraped jobs table
    archived_posted_jobs — mirrors the company-posted jobs table

    These tables are append-only and used exclusively for analytics and
    historical reporting. They are never queried for active job listings.
    """
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS archived_jobs (
                id              INTEGER NOT NULL,
                source          VARCHAR(50),
                job_title       VARCHAR(255),
                company         VARCHAR(255),
                location        VARCHAR(255),
                description     TEXT,
                job_url         VARCHAR(500),
                scraped_at      TIMESTAMP,
                created_at      TIMESTAMP,
                archived_at     TIMESTAMP DEFAULT NOW(),
                archive_reason  VARCHAR(50) DEFAULT 'stale_30d'
            );
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_archived_jobs_archived_at
            ON archived_jobs(archived_at DESC);
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_archived_jobs_source
            ON archived_jobs(source);
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS archived_posted_jobs (
                id                  INTEGER NOT NULL,
                company_user_id     INTEGER,
                title               VARCHAR(255),
                company_name        VARCHAR(255),
                location            VARCHAR(255),
                job_type            VARCHAR(50),
                experience_level    VARCHAR(50),
                salary_min          INTEGER,
                salary_max          INTEGER,
                salary_currency     VARCHAR(10),
                description         TEXT,
                requirements        TEXT,
                benefits            TEXT,
                skills_required     TEXT[],
                is_featured         BOOLEAN,
                views_count         INTEGER,
                applications_count  INTEGER,
                expires_at          TIMESTAMP,
                created_at          TIMESTAMP,
                updated_at          TIMESTAMP,
                archived_at         TIMESTAMP DEFAULT NOW(),
                archive_reason      VARCHAR(50) DEFAULT 'expired_60d'
            );
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_archived_posted_jobs_archived_at
            ON archived_posted_jobs(archived_at DESC);
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_archived_posted_jobs_company
            ON archived_posted_jobs(company_user_id);
        """)

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def purge_old_archive_data() -> dict:
    """
    Delete archive rows older than 6 months.

    Archive tables are append-only but must themselves be bounded.
    Keeping 6 months of history covers full quarterly comparisons and
    seasonal hiring patterns without letting the archive grow too large.
    """
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "DELETE FROM archived_jobs WHERE archived_at < NOW() - INTERVAL '6 months'"
        )
        purged_scraped = cur.rowcount

        cur.execute(
            "DELETE FROM archived_posted_jobs WHERE archived_at < NOW() - INTERVAL '6 months'"
        )
        purged_posted = cur.rowcount

        conn.commit()
        return {"purged_archived_jobs": purged_scraped, "purged_archived_posted": purged_posted}
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def cleanup_old_notifications() -> int:
    """
    Delete stale notifications to prevent the table growing indefinitely.

    Rules:
      - Read notifications older than 30 days  → deleted
      - Unread notifications older than 90 days → deleted (assumed irrelevant)
    """
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            DELETE FROM notifications
            WHERE (is_read = TRUE  AND created_at < NOW() - INTERVAL '30 days')
               OR (is_read = FALSE AND created_at < NOW() - INTERVAL '90 days')
            """
        )
        deleted = cur.rowcount
        conn.commit()
        return deleted
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def ensure_subscription_cancel_at_period_end() -> None:
    """Add cancel_at_period_end flag for Stripe cancel-at-period-end flow."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            ALTER TABLE subscriptions
            ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE
        """)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def ensure_expired_application_support() -> None:
    """
    Schema migration (safe to run on every start) that enables clean job expiry:

    1. Adds job_title + company_name columns to posted_job_applications so the
       application record still carries display info after its job is deleted.
    2. Backfills those columns from posted_jobs for existing rows.
    3. Makes posted_job_id nullable and changes the FK from ON DELETE CASCADE
       to ON DELETE SET NULL — jobs can now be deleted without wiping applications.
    4. Adds 'expired' to the application status CHECK constraint.
    """
    conn = get_connection()
    cur = conn.cursor()
    try:
        # 1. Add columns if they don't exist
        cur.execute("""
            ALTER TABLE posted_job_applications
            ADD COLUMN IF NOT EXISTS job_title    VARCHAR(255),
            ADD COLUMN IF NOT EXISTS company_name VARCHAR(255)
        """)

        # 2. Backfill from posted_jobs for any rows that are still joined
        cur.execute("""
            UPDATE posted_job_applications a
            SET    job_title    = j.title,
                   company_name = j.company_name
            FROM   posted_jobs j
            WHERE  j.id = a.posted_job_id
              AND  (a.job_title IS NULL OR a.company_name IS NULL)
        """)

        # 3. Make posted_job_id nullable (idempotent — DROP NOT NULL is safe)
        cur.execute("""
            ALTER TABLE posted_job_applications
            ALTER COLUMN posted_job_id DROP NOT NULL
        """)

        # 4. Swap FK from CASCADE → SET NULL (drop old, add new)
        cur.execute("""
            ALTER TABLE posted_job_applications
            DROP CONSTRAINT IF EXISTS posted_job_applications_posted_job_id_fkey
        """)
        cur.execute("""
            ALTER TABLE posted_job_applications
            ADD CONSTRAINT posted_job_applications_posted_job_id_fkey
            FOREIGN KEY (posted_job_id)
            REFERENCES posted_jobs(id)
            ON DELETE SET NULL
        """)

        # 5. Expand status CHECK to include 'expired'
        cur.execute("""
            ALTER TABLE posted_job_applications
            DROP CONSTRAINT IF EXISTS posted_job_applications_status_check
        """)
        cur.execute("""
            ALTER TABLE posted_job_applications
            ADD CONSTRAINT posted_job_applications_status_check
            CHECK (status IN (
                'applied', 'reviewing', 'interviewing',
                'offer', 'rejected', 'withdrawn', 'expired'
            ))
        """)

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def ensure_saved_jobs_supports_posted_jobs() -> None:
    """
    Schema migration (safe to run on every start):

    `saved_jobs.job_id` used to have a FK to `jobs(id)`, which silently
    rejected attempts to save a company-posted job (those are referenced
    using a negative id, `pj.id * -1`, matching the convention used by the
    matching pipeline so scraped jobs and posted jobs share one id-space).
    Drop that FK so both positive ids (scraped jobs) and negative ids
    (posted jobs) can be saved.
    """
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            ALTER TABLE saved_jobs
            DROP CONSTRAINT IF EXISTS saved_jobs_job_id_fkey
        """)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def ensure_user_match_runs_table() -> None:
    """Store each user's most recent job match run (safe on every API start)."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS user_match_runs (
                user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                skills TEXT[] NOT NULL DEFAULT '{}',
                total_matched INTEGER NOT NULL DEFAULT 0,
                jobs JSONB NOT NULL DEFAULT '[]',
                ran_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_user_match_runs_ran_at
            ON user_match_runs(ran_at DESC);
        """)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def save_user_match_run(
    user_id: int,
    skills: List[str],
    total_matched: int,
    jobs: List[Dict[str, Any]],
) -> bool:
    """Upsert the latest match run for a user."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO user_match_runs (user_id, skills, total_matched, jobs, ran_at)
            VALUES (%s, %s, %s, %s, NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                skills = EXCLUDED.skills,
                total_matched = EXCLUDED.total_matched,
                jobs = EXCLUDED.jobs,
                ran_at = NOW()
            """,
            (user_id, skills, total_matched, Json(jobs)),
        )
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def get_user_match_run(user_id: int) -> Optional[dict]:
    """Return the user's most recent match run, or None if never matched."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT skills, total_matched, jobs, ran_at
            FROM user_match_runs
            WHERE user_id = %s
            """,
            (user_id,),
        )
        row = cur.fetchone()
        if not row:
            return None
        skills, total_matched, jobs, ran_at = row
        if isinstance(jobs, str):
            jobs = json.loads(jobs)
        ran_at_str = ran_at.isoformat() if hasattr(ran_at, "isoformat") else str(ran_at)
        return {
            "skills": list(skills or []),
            "total_matched": int(total_matched or 0),
            "jobs": jobs if isinstance(jobs, list) else [],
            "ran_at": ran_at_str,
        }
    finally:
        cur.close()
        conn.close()


def ensure_vertex_application_tables() -> None:
    """Create Vertex job application pipeline tables (safe on every API start)."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS posted_job_applications (
                id SERIAL PRIMARY KEY,
                posted_job_id INTEGER NOT NULL
                    REFERENCES posted_jobs(id) ON DELETE CASCADE,
                jobseeker_user_id INTEGER NOT NULL
                    REFERENCES users(id) ON DELETE CASCADE,
                status VARCHAR(50) DEFAULT 'applied'
                    CHECK (status IN (
                        'applied', 'reviewing', 'interviewing',
                        'offer', 'rejected', 'withdrawn'
                    )),
                cover_message TEXT,
                applicant_name VARCHAR(255) NOT NULL,
                applicant_email VARCHAR(255) NOT NULL,
                headline VARCHAR(255),
                location VARCHAR(255),
                years_experience INTEGER DEFAULT 0,
                skills TEXT[],
                cv_filename VARCHAR(255),
                profile_slug VARCHAR(100),
                company_notes TEXT,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(posted_job_id, jobseeker_user_id)
            );
        """)
        cur.execute(
            "CREATE INDEX IF NOT EXISTS idx_pja_job ON posted_job_applications(posted_job_id);"
        )
        cur.execute(
            "CREATE INDEX IF NOT EXISTS idx_pja_seeker ON posted_job_applications(jobseeker_user_id);"
        )
        cur.execute(
            "CREATE INDEX IF NOT EXISTS idx_pja_status ON posted_job_applications(status);"
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


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

        cur.execute("""
            ALTER TABLE company_searches
            ADD COLUMN IF NOT EXISTS user_id INTEGER
                REFERENCES users(id) ON DELETE CASCADE,
            ADD COLUMN IF NOT EXISTS results_count INTEGER
                DEFAULT 0;
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_company_searches_user ON company_searches(user_id);")

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
                      'system',
                      'job_application',
                      'application_status'
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

        cur.execute("""
            CREATE TABLE IF NOT EXISTS posted_job_applications (
                id SERIAL PRIMARY KEY,
                posted_job_id INTEGER NOT NULL
                    REFERENCES posted_jobs(id) ON DELETE CASCADE,
                jobseeker_user_id INTEGER NOT NULL
                    REFERENCES users(id) ON DELETE CASCADE,
                status VARCHAR(50) DEFAULT 'applied'
                    CHECK (status IN (
                        'applied', 'reviewing', 'interviewing',
                        'offer', 'rejected', 'withdrawn'
                    )),
                cover_message TEXT,
                applicant_name VARCHAR(255) NOT NULL,
                applicant_email VARCHAR(255) NOT NULL,
                headline VARCHAR(255),
                location VARCHAR(255),
                years_experience INTEGER DEFAULT 0,
                skills TEXT[],
                cv_filename VARCHAR(255),
                profile_slug VARCHAR(100),
                company_notes TEXT,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(posted_job_id, jobseeker_user_id)
            );
        """)
        cur.execute(
            "CREATE INDEX IF NOT EXISTS idx_pja_job ON posted_job_applications(posted_job_id);"
        )
        cur.execute(
            "CREATE INDEX IF NOT EXISTS idx_pja_seeker ON posted_job_applications(jobseeker_user_id);"
        )
        cur.execute(
            "CREATE INDEX IF NOT EXISTS idx_pja_status ON posted_job_applications(status);"
        )

        cur.execute("""
            CREATE TABLE IF NOT EXISTS announcements (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                target VARCHAR(20) DEFAULT 'all',
                sent_by INTEGER REFERENCES users(id),
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                recipients_count INTEGER DEFAULT 0
            );
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS platform_settings (
                id SERIAL PRIMARY KEY,
                key VARCHAR(100) UNIQUE NOT NULL,
                value VARCHAR(255) NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        cur.execute("""
            ALTER TABLE notifications
            ADD COLUMN IF NOT EXISTS announcement_id INTEGER
            REFERENCES announcements(id) ON DELETE CASCADE
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_notifications_announcement
            ON notifications(announcement_id)
            WHERE announcement_id IS NOT NULL
        """)
        
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
    """Return list of job dicts with saved_at, ordered by saved_at DESC.

    `saved_jobs.job_id` can be a positive id (a row in `jobs`, scraped job
    boards) or a negative id (a row in `posted_jobs`, company-posted jobs,
    stored as `pj.id * -1` to match the convention used by the matching
    pipeline). Both kinds are unioned together here.
    """
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT j.id, j.source, j.job_title, j.company, j.location, j.description,
                   j.job_url, j.scraped_at, sj.saved_at, j.is_active
            FROM jobs j
            JOIN saved_jobs sj ON j.id = sj.job_id
            WHERE sj.user_id = %s AND sj.job_id > 0

            UNION ALL

            SELECT (pj.id * -1) AS id, 'company_posted' AS source, pj.title AS job_title,
                   pj.company_name AS company, pj.location, pj.description,
                   COALESCE(pj.application_url, '') AS job_url, pj.created_at AS scraped_at,
                   sj.saved_at, pj.is_active
            FROM posted_jobs pj
            JOIN saved_jobs sj ON sj.job_id = (pj.id * -1)
            WHERE sj.user_id = %s

            ORDER BY saved_at DESC;
            """,
            (user_id, user_id),
        )
        rows = cur.fetchall()
        cols = [
            "id", "source", "job_title", "company", "location", "description",
            "job_url", "scraped_at", "saved_at", "is_active",
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


def count_company_saved_candidates(company_user_id: int) -> int:
    """Saved candidates for a company."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT COUNT(*) FROM saved_candidates WHERE company_user_id = %s;",
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
        accepted_ids = get_accepted_contact_candidate_ids(company_user_id)
        result = []
        for row in rows:
            item = dict(zip(cols, row))
            revealed = item.get("candidate_user_id") in accepted_ids
            item["email_revealed"] = revealed
            if not revealed:
                item["email"] = None
            result.append(item)
        return result
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
            if (r.get("status") or "").strip().lower() != "accepted":
                r["candidate_email"] = None
        return result
    finally:
        cur.close()
        conn.close()


def get_accepted_contact_candidate_ids(company_user_id: int) -> set:
    """Candidate user IDs where the company has an accepted contact request."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT candidate_user_id FROM contact_requests
            WHERE company_user_id = %s AND LOWER(TRIM(status)) = 'accepted'
            """,
            (company_user_id,),
        )
        return {row[0] for row in cur.fetchall()}
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
    announcement_id: Optional[int] = None,
) -> int:
    """Insert notification and return new id."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO notifications
            (user_id, type, title, message, link, announcement_id)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (user_id, type, title, message, link, announcement_id),
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
        try:
            from app.models.scraper_source import (
                count_scraper_sources,
                seed_default_scraper_sources,
            )

            if count_scraper_sources(active_only=False) == 0:
                seed_default_scraper_sources()
            stats["total_job_boards"] = count_scraper_sources(active_only=True)
        except Exception:
            stats["total_job_boards"] = 0
        return stats
    finally:
        cur.close()
        conn.close()


def _date_key(value) -> str:
    if value is None:
        return ""
    if hasattr(value, "isoformat"):
        return value.isoformat()[:10]
    return str(value)[:10]


def _fill_daily_counts(rows: list, days: int = 30) -> list:
    """Fill missing days with zero counts for chart continuity."""
    from datetime import date, timedelta

    by_date: dict[str, int] = {}
    for row in rows:
        d = row.get("date")
        if d:
            by_date[str(d)[:10]] = int(row.get("count") or 0)
    today = date.today()
    start = today - timedelta(days=days - 1)
    out = []
    cur = start
    while cur <= today:
        key = cur.isoformat()
        out.append({"date": key, "count": by_date.get(key, 0)})
        cur += timedelta(days=1)
    return out


def get_admin_analytics(days: int = 30) -> dict:
    """Platform analytics for admin: growth series, plans, estimated revenue."""
    days = max(7, min(int(days), 90))
    config = get_plan_config()
    pro_price = float(config.get("pro_monthly_price") or 0)
    business_price = float(config.get("business_monthly_price") or 0)

    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT COALESCE(NULLIF(TRIM(plan), ''), 'free') AS plan, COUNT(*)
            FROM users
            WHERE is_active = TRUE
            GROUP BY 1
            ORDER BY 1
            """
        )
        plan_counts = {row[0]: row[1] for row in cur.fetchall()}
        free_count = plan_counts.get("free", 0)
        pro_count = plan_counts.get("pro", 0)
        business_count = plan_counts.get("business", 0)
        paid_count = pro_count + business_count

        cur.execute(
            """
            SELECT status, COUNT(*) FROM subscriptions
            WHERE status IS NOT NULL
            GROUP BY status
            """
        )
        sub_status = {row[0]: row[1] for row in cur.fetchall()}
        active_subs = sub_status.get("active", 0)

        estimated_mrr = pro_count * pro_price + business_count * business_price

        cur.execute(
            f"""
            SELECT DATE(created_at) AS d, COUNT(*)
            FROM users
            WHERE created_at >= CURRENT_DATE - INTERVAL '{days - 1} days'
            GROUP BY DATE(created_at)
            ORDER BY d ASC
            """
        )
        users_rows = [{"date": _date_key(d), "count": c} for d, c in cur.fetchall()]

        cur.execute(
            f"""
            SELECT DATE(created_at) AS d, user_type, COUNT(*)
            FROM users
            WHERE created_at >= CURRENT_DATE - INTERVAL '{days - 1} days'
            GROUP BY DATE(created_at), user_type
            ORDER BY d ASC
            """
        )
        signups_by_day: dict[str, dict] = {}
        for d, utype, c in cur.fetchall():
            key = _date_key(d)
            if key not in signups_by_day:
                signups_by_day[key] = {"jobseekers": 0, "companies": 0}
            if utype == "company":
                signups_by_day[key]["companies"] = c
            else:
                signups_by_day[key]["jobseekers"] = c
        from datetime import date as date_cls, timedelta

        signups_stacked = []
        today_d = date_cls.today()
        start_d = today_d - timedelta(days=days - 1)
        cur_d = start_d
        while cur_d <= today_d:
            key = cur_d.isoformat()
            bucket = signups_by_day.get(key, {"jobseekers": 0, "companies": 0})
            js = bucket["jobseekers"]
            co = bucket["companies"]
            signups_stacked.append(
                {"date": key, "jobseekers": js, "companies": co, "count": js + co}
            )
            cur_d += timedelta(days=1)

        cur.execute(
            f"""
            SELECT DATE(scraped_at) AS d, COUNT(*)
            FROM jobs
            WHERE scraped_at >= CURRENT_DATE - INTERVAL '{days - 1} days'
            GROUP BY DATE(scraped_at)
            ORDER BY d ASC
            """
        )
        jobs_rows = [{"date": _date_key(d), "count": c} for d, c in cur.fetchall()]

        cur.execute(
            f"""
            SELECT DATE(applied_at) AS d, COUNT(*)
            FROM job_applications
            WHERE applied_at >= CURRENT_DATE - INTERVAL '{days - 1} days'
            GROUP BY DATE(applied_at)
            ORDER BY d ASC
            """
        )
        apps_rows = [{"date": _date_key(d), "count": c} for d, c in cur.fetchall()]

        cur.execute(
            f"""
            SELECT DATE(created_at) AS d, COUNT(*)
            FROM contact_requests
            WHERE created_at >= CURRENT_DATE - INTERVAL '{days - 1} days'
            GROUP BY DATE(created_at)
            ORDER BY d ASC
            """
        )
        contacts_rows = [{"date": _date_key(d), "count": c} for d, c in cur.fetchall()]

        cur.execute(
            "SELECT user_type, COUNT(*) FROM users WHERE is_active = TRUE GROUP BY user_type"
        )
        user_types = [
            {"type": row[0] or "unknown", "count": row[1]}
            for row in cur.fetchall()
        ]

        return {
            "period_days": days,
            "revenue": {
                "estimated_mrr": round(estimated_mrr, 2),
                "estimated_arr": round(estimated_mrr * 12, 2),
                "pro_monthly_price": pro_price,
                "business_monthly_price": business_price,
                "paid_users": paid_count,
                "active_subscriptions": active_subs,
                "disclaimer": "Estimated from active user plans and admin pricing — not Stripe payout data.",
            },
            "plans": {
                "free": free_count,
                "pro": pro_count,
                "business": business_count,
            },
            "plan_distribution": [
                {"plan": "Free", "count": free_count, "color": "#64748b"},
                {"plan": "Pro", "count": pro_count, "color": "#6366f1"},
                {"plan": "Business", "count": business_count, "color": "#22c55e"},
            ],
            "subscription_status": [
                {"status": k, "count": v} for k, v in sub_status.items()
            ],
            "users_over_time": _fill_daily_counts(users_rows, days),
            "signups_by_type_over_time": signups_stacked,
            "jobs_over_time": _fill_daily_counts(jobs_rows, days),
            "applications_over_time": _fill_daily_counts(apps_rows, days),
            "contact_requests_over_time": _fill_daily_counts(contacts_rows, days),
            "user_types": user_types,
        }
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
    TTL-based lifecycle cleanup — runs nightly.

    Scraped jobs (jobs table):
      • Mark inactive: not re-seen by the scraper in 30+ days.
      • Hard-delete: already inactive AND not saved by any user.

    Company-posted jobs (posted_jobs table):
      • Expired = is_active=FALSE, OR explicit expires_at passed,
        OR created >30 days ago with no expires_at set.
      • If the job has active applications → soft-delete only (mark inactive).
      • If no applications → hard-delete immediately.
    """
    conn = get_connection()
    cur = conn.cursor()
    try:
        # ── Scraped jobs ──────────────────────────────────────────────────
        # 1. Mark stale (not re-scraped in 30 days) as inactive
        cur.execute(
            """
            UPDATE jobs
            SET    is_active = FALSE
            WHERE  is_active = TRUE
              AND  scraped_at < NOW() - INTERVAL '30 days'
            """
        )
        marked_stale = cur.rowcount

        # 2. Archive inactive scraped jobs that no user has saved, then remove
        # Description is intentionally excluded — metadata only keeps the archive lean
        cur.execute(
            """
            INSERT INTO archived_jobs
                (id, source, job_title, company, location,
                 job_url, scraped_at, created_at, archived_at, archive_reason)
            SELECT
                id, source, job_title, company, location,
                job_url, scraped_at, created_at, NOW(), 'stale_30d'
            FROM jobs
            WHERE is_active = FALSE
              AND id NOT IN (SELECT job_id FROM saved_jobs)
            """
        )
        archived_scraped = cur.rowcount

        cur.execute(
            """
            DELETE FROM jobs
            WHERE  is_active = FALSE
              AND  id NOT IN (SELECT job_id FROM saved_jobs)
            """
        )
        deleted_scraped = cur.rowcount

        # ── Company-posted jobs ───────────────────────────────────────────
        # Mark expired (explicit expiry, admin deactivation, or no expiry + 60 days old)
        cur.execute(
            """
            UPDATE posted_jobs
            SET    is_active = FALSE
            WHERE  is_active = TRUE
              AND (
                    (expires_at IS NOT NULL AND expires_at <= NOW())
                 OR (expires_at IS NULL     AND created_at < NOW() - INTERVAL '30 days')
              )
            """
        )
        marked_posted = cur.rowcount

        # Close any still-pending applications on expired jobs with 'expired' status
        cur.execute(
            """
            UPDATE posted_job_applications
            SET    status     = 'expired',
                   updated_at = NOW()
            WHERE  posted_job_id IN (
                       SELECT id FROM posted_jobs WHERE is_active = FALSE
                   )
              AND  status NOT IN ('rejected', 'withdrawn', 'expired', 'offer')
            """
        )

        # Archive ALL inactive posted jobs (applications are safe — FK is now SET NULL)
        # description/requirements/benefits are excluded — metadata only keeps the archive lean
        cur.execute(
            """
            INSERT INTO archived_posted_jobs
                (id, company_user_id, title, company_name, location, job_type,
                 experience_level, salary_min, salary_max, salary_currency,
                 skills_required, is_featured, views_count, applications_count,
                 expires_at, created_at, updated_at, archived_at, archive_reason)
            SELECT
                id, company_user_id, title, company_name, location, job_type,
                experience_level, salary_min, salary_max, salary_currency,
                skills_required, is_featured, views_count, applications_count,
                expires_at, created_at, updated_at, NOW(),
                CASE
                    WHEN expires_at IS NOT NULL AND expires_at <= NOW() THEN 'explicit_expiry'
                    WHEN expires_at IS NULL                             THEN 'no_expiry_60d'
                    ELSE 'deactivated'
                END
            FROM posted_jobs
            WHERE is_active = FALSE
            """
        )
        archived_posted = cur.rowcount

        cur.execute("DELETE FROM posted_jobs WHERE is_active = FALSE")
        deleted_posted = cur.rowcount

        conn.commit()
        return {
            "marked_stale_scraped": marked_stale,
            "archived_scraped": archived_scraped,
            "deleted_scraped": deleted_scraped,
            "marked_expired_posted": marked_posted,
            "archived_posted": archived_posted,
            "deleted_posted": deleted_posted,
            "total_archived": archived_scraped + archived_posted,
            "total_deleted": deleted_scraped + deleted_posted,
        }
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def _admin_users_where(
    search: Optional[str] = None,
    user_type: Optional[str] = None,
    status: Optional[str] = None,
    joined_from: Optional[str] = None,
    joined_to: Optional[str] = None,
) -> tuple[str, list]:
    """Build WHERE clause and params for admin user list filters."""
    where = ["1=1"]
    params: list = []
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        where.append("(email ILIKE %s OR full_name ILIKE %s)")
        params.extend([pattern, pattern])
    ut = (user_type or "").strip().lower()
    if ut == "jobseeker":
        where.append("user_type = %s")
        params.append("jobseeker")
    elif ut == "company":
        where.append("user_type = %s")
        params.append("company")
    elif ut == "admin":
        where.append("is_admin = TRUE")
    st = (status or "").strip().lower()
    if st == "active":
        where.append("is_active = TRUE")
    elif st == "inactive":
        where.append("is_active = FALSE")
    if joined_from and joined_from.strip():
        where.append("created_at >= %s::date")
        params.append(joined_from.strip()[:10])
    if joined_to and joined_to.strip():
        where.append("created_at < (%s::date + INTERVAL '1 day')")
        params.append(joined_to.strip()[:10])
    return " AND ".join(where), params


def get_all_users(
    limit: int = 50,
    offset: int = 0,
    search: Optional[str] = None,
    user_type: Optional[str] = None,
    status: Optional[str] = None,
    joined_from: Optional[str] = None,
    joined_to: Optional[str] = None,
) -> list:
    """Return users for admin list with optional filters."""
    clause, params = _admin_users_where(
        search, user_type, status, joined_from, joined_to
    )
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            SELECT id, email, full_name, user_type, is_active, is_admin, created_at
            FROM users
            WHERE {clause}
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
            """,
            tuple(params + [limit, offset]),
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


def get_all_users_total(
    search: Optional[str] = None,
    user_type: Optional[str] = None,
    status: Optional[str] = None,
    joined_from: Optional[str] = None,
    joined_to: Optional[str] = None,
) -> int:
    """Return total count of users matching admin list filters."""
    clause, params = _admin_users_where(
        search, user_type, status, joined_from, joined_to
    )
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(f"SELECT COUNT(*) FROM users WHERE {clause}", tuple(params))
        return cur.fetchone()[0] or 0
    finally:
        cur.close()
        conn.close()


def get_admin_user_counts() -> dict:
    """Counts for job seekers, companies, and admins (unfiltered)."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT COUNT(*) FROM users WHERE user_type = 'jobseeker' AND is_admin = FALSE"
        )
        jobseekers = cur.fetchone()[0] or 0
        cur.execute(
            "SELECT COUNT(*) FROM users WHERE user_type = 'company' AND is_admin = FALSE"
        )
        companies = cur.fetchone()[0] or 0
        cur.execute("SELECT COUNT(*) FROM users WHERE is_admin = TRUE")
        admins = cur.fetchone()[0] or 0
        cur.execute("SELECT COUNT(*) FROM users")
        total = cur.fetchone()[0] or 0
        return {
            "all": total,
            "jobseekers": jobseekers,
            "companies": companies,
            "admins": admins,
        }
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


def get_recent_activity(limit: int = 10) -> list:
    """Return last N activities (default 10): registrations, contact_requests, job_applications."""
    limit = max(5, min(int(limit), 10))
    conn = get_connection()
    cur = conn.cursor()
    try:
        activities = []
        cur.execute(
            """
            SELECT full_name, user_type, created_at
            FROM users
            ORDER BY created_at DESC
            LIMIT %s
            """,
            (limit,),
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
            LIMIT %s
            """,
            (limit,),
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
            LIMIT %s
            """,
            (limit,),
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
        return activities[:limit]
    finally:
        cur.close()
        conn.close()


# ---------------------------------------------------------------------------
# Subscriptions (Stripe)
# ---------------------------------------------------------------------------

def _subscription_period_end_dt(value) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.replace(tzinfo=None) if value.tzinfo else value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).replace(tzinfo=None)
    except (TypeError, ValueError):
        return None


def get_user_subscription(user_id: int) -> Optional[dict]:
    """Return subscription row for user_id or None."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT id, user_id, stripe_customer_id, stripe_subscription_id, plan, status,
                   current_period_end, cancel_at_period_end, created_at, updated_at
            FROM subscriptions WHERE user_id = %s
            """,
            (user_id,),
        )
        row = cur.fetchone()
        if row is None:
            return None
        cols = [
            "id", "user_id", "stripe_customer_id", "stripe_subscription_id", "plan", "status",
            "current_period_end", "cancel_at_period_end", "created_at", "updated_at",
        ]
        out = dict(zip(cols, row))
        for k in ("current_period_end", "created_at", "updated_at"):
            if out.get(k) and hasattr(out[k], "isoformat"):
                out[k] = out[k].isoformat()
        out["cancel_at_period_end"] = bool(out.get("cancel_at_period_end"))
        if out.get("cancel_at_period_end"):
            end = _subscription_period_end_dt(out.get("current_period_end"))
            if end is not None and end <= datetime.utcnow():
                cancel_subscription(user_id)
                return None
        return out
    finally:
        cur.close()
        conn.close()


def get_effective_user_plan(user_id: int, stored_plan: str = "free") -> str:
    """Paid subscription tier until it ends; otherwise users.plan."""
    sub = get_user_subscription(user_id)
    if sub:
        plan = (sub.get("plan") or "").strip().lower()
        status = (sub.get("status") or "").strip().lower()
        if plan in ("pro", "business") and status in ("active", "trialing"):
            return plan
    normalized = (stored_plan or "free").strip().lower()
    return normalized if normalized in ("free", "pro", "business") else "free"


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
                (user_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end, cancel_at_period_end, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, FALSE, NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                stripe_customer_id = EXCLUDED.stripe_customer_id,
                stripe_subscription_id = EXCLUDED.stripe_subscription_id,
                plan = EXCLUDED.plan,
                status = EXCLUDED.status,
                current_period_end = EXCLUDED.current_period_end,
                cancel_at_period_end = FALSE,
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


def schedule_subscription_cancellation(user_id: int, current_period_end=None) -> bool:
    """Mark subscription to end at period close; keep plan active until then."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            UPDATE subscriptions
            SET cancel_at_period_end = TRUE,
                status = 'active',
                current_period_end = COALESCE(%s, current_period_end),
                updated_at = NOW()
            WHERE user_id = %s
            """,
            (current_period_end, user_id),
        )
        conn.commit()
        return cur.rowcount > 0
    except Exception:
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


def cancel_subscription(user_id: int) -> bool:
    """End subscription immediately and revert user to Free."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            UPDATE subscriptions
            SET status = 'canceled',
                cancel_at_period_end = FALSE,
                updated_at = NOW()
            WHERE user_id = %s
            """,
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


def sync_subscription_from_stripe(
    user_id: int,
    *,
    status: str,
    current_period_end,
    cancel_at_period_end: bool,
    plan: Optional[str] = None,
) -> bool:
    """Sync subscription row from Stripe webhook or API without downgrading early."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        if plan:
            cur.execute(
                """
                UPDATE subscriptions
                SET status = %s,
                    current_period_end = %s,
                    cancel_at_period_end = %s,
                    plan = %s,
                    updated_at = NOW()
                WHERE user_id = %s
                """,
                (status, current_period_end, cancel_at_period_end, plan, user_id),
            )
            if status == "active" and not cancel_at_period_end:
                cur.execute("UPDATE users SET plan = %s WHERE id = %s", (plan, user_id))
        else:
            cur.execute(
                """
                UPDATE subscriptions
                SET status = %s,
                    current_period_end = %s,
                    cancel_at_period_end = %s,
                    updated_at = NOW()
                WHERE user_id = %s
                """,
                (status, current_period_end, cancel_at_period_end, user_id),
            )
        conn.commit()
        return cur.rowcount > 0
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
    """Return analytics for a company: hiring funnel (Growth+) and outreach (Business)."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        out = {
            "applications_by_status": {
                "applied": 0,
                "reviewing": 0,
                "interviewing": 0,
                "offer": 0,
                "rejected": 0,
                "withdrawn": 0,
            },
            "applications_over_time": [],
            "total_applications": 0,
            "total_job_views": 0,
            "active_jobs": 0,
            "application_rate": 0.0,
            "interview_rate": 0.0,
            "offer_rate": 0.0,
            "top_jobs": [],
            # Business outreach metrics
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
            SELECT COUNT(*) FILTER (WHERE is_active = TRUE)
            FROM posted_jobs
            WHERE company_user_id = %s
            """,
            (user_id,),
        )
        out["active_jobs"] = cur.fetchone()[0] or 0

        cur.execute(
            """
            SELECT COALESCE(SUM(views_count), 0)
            FROM posted_jobs
            WHERE company_user_id = %s
            """,
            (user_id,),
        )
        out["total_job_views"] = int(cur.fetchone()[0] or 0)

        cur.execute(
            """
            SELECT a.status, COUNT(*)
            FROM posted_job_applications a
            JOIN posted_jobs j ON j.id = a.posted_job_id
            WHERE j.company_user_id = %s
            GROUP BY a.status
            """,
            (user_id,),
        )
        for row in cur.fetchall():
            status, count = row[0], row[1]
            if status in out["applications_by_status"]:
                out["applications_by_status"][status] = count
        out["total_applications"] = sum(out["applications_by_status"].values())

        cur.execute(
            """
            SELECT DATE(a.applied_at) AS date, COUNT(*)
            FROM posted_job_applications a
            JOIN posted_jobs j ON j.id = a.posted_job_id
            WHERE j.company_user_id = %s
              AND a.applied_at > NOW() - INTERVAL '30 days'
            GROUP BY DATE(a.applied_at)
            ORDER BY date ASC
            """,
            (user_id,),
        )
        for row in cur.fetchall():
            d, c = row[0], row[1]
            out["applications_over_time"].append(
                {
                    "date": d.isoformat()[:10] if hasattr(d, "isoformat") else str(d)[:10],
                    "count": c,
                }
            )

        cur.execute(
            """
            SELECT j.id, j.title, j.applications_count, j.views_count
            FROM posted_jobs j
            WHERE j.company_user_id = %s
            ORDER BY j.applications_count DESC, j.views_count DESC
            LIMIT 5
            """,
            (user_id,),
        )
        for row in cur.fetchall():
            job_id, title, apps, views = row[0], row[1], row[2] or 0, row[3] or 0
            conversion = round((apps / views) * 100, 1) if views > 0 else 0.0
            out["top_jobs"].append(
                {
                    "posted_job_id": job_id,
                    "job_title": title or "Untitled role",
                    "applications_count": apps,
                    "views_count": views,
                    "conversion_rate": conversion,
                }
            )

        pipeline_total = (
            out["applications_by_status"]["applied"]
            + out["applications_by_status"]["reviewing"]
            + out["applications_by_status"]["interviewing"]
            + out["applications_by_status"]["offer"]
            + out["applications_by_status"]["rejected"]
        )
        if out["total_job_views"] > 0:
            out["application_rate"] = round(
                (out["total_applications"] / out["total_job_views"]) * 100, 1
            )
        if pipeline_total > 0:
            advanced = (
                out["applications_by_status"]["interviewing"]
                + out["applications_by_status"]["offer"]
            )
            out["interview_rate"] = round((advanced / pipeline_total) * 100, 1)
            out["offer_rate"] = round(
                (out["applications_by_status"]["offer"] / pipeline_total) * 100, 1
            )

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
            out["searches_over_time"].append(
                {
                    "date": d.isoformat()[:10] if hasattr(d, "isoformat") else str(d)[:10],
                    "count": c,
                }
            )
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
            AND u.is_admin = FALSE
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
    """Return most recent jobs across job boards + Vertex posted jobs."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT id, source, job_title, company, location, description, job_url, scraped_at
            FROM (
                SELECT
                    j.id,
                    j.source,
                    j.job_title,
                    j.company,
                    j.location,
                    j.description,
                    j.job_url,
                    j.scraped_at
                FROM jobs j
                WHERE j.is_active = TRUE

                UNION ALL

                SELECT
                    -pj.id AS id,
                    'company_posted' AS source,
                    pj.title AS job_title,
                    pj.company_name AS company,
                    pj.location,
                    pj.description,
                    COALESCE(pj.application_url, '') AS job_url,
                    pj.created_at AS scraped_at
                FROM posted_jobs pj
                WHERE pj.is_active = TRUE
                  AND (pj.expires_at IS NULL OR pj.expires_at > NOW())
            ) combined
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
    """Return new jobs since timestamp across boards + Vertex posted jobs."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT id, source, job_title, company, location, description, job_url, scraped_at
            FROM (
                SELECT
                    j.id,
                    j.source,
                    j.job_title,
                    j.company,
                    j.location,
                    j.description,
                    j.job_url,
                    j.scraped_at
                FROM jobs j
                WHERE j.scraped_at > %s AND j.is_active = TRUE

                UNION ALL

                SELECT
                    -pj.id AS id,
                    'company_posted' AS source,
                    pj.title AS job_title,
                    pj.company_name AS company,
                    pj.location,
                    pj.description,
                    COALESCE(pj.application_url, '') AS job_url,
                    pj.created_at AS scraped_at
                FROM posted_jobs pj
                WHERE pj.created_at > %s
                  AND pj.is_active = TRUE
                  AND (pj.expires_at IS NULL OR pj.expires_at > NOW())
            ) combined
            ORDER BY scraped_at DESC
            LIMIT 100
            """,
            (since_timestamp, since_timestamp),
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

def search_jobs_with_company_priority(
    q: Optional[str] = None,
    source: Optional[str] = None,
    location: Optional[str] = None,
    date_posted: Optional[str] = None,
    sort_by: str = "recent",
    limit: int = 20,
    offset: int = 0,
) -> Tuple[list, int]:
    """
    Search jobs combining POSTED JOBS and SCRAPED JOBS.
    - POSTED JOBS from registered companies appear first
    - SCRAPED JOBS from external sources appear second
    - Avoids showing same job twice if company is registered
    
    Returns: (list of combined jobs, total count)
    """
    conn = get_connection()
    cur = conn.cursor()
    try:
        # Step 1: Get all registered company names
        cur.execute("""
            SELECT LOWER(TRIM(company_name)) as company_lower
            FROM company_profiles
            WHERE company_name IS NOT NULL AND TRIM(company_name) != ''
        """)
        registered_companies = {row[0] for row in cur.fetchall()}
        
        # Step 2: Build WHERE clause for common filters
        where_scraped = ["is_active = TRUE"]
        where_posted = ["is_active = TRUE"]
        params_scraped = []
        params_posted = []
        
        if q and q.strip():
            t = f"%{q.strip()}%"
            where_scraped.append("(job_title ILIKE %s OR company ILIKE %s OR description ILIKE %s)")
            where_posted.append("(title ILIKE %s OR company_name ILIKE %s OR description ILIKE %s)")
            params_scraped.extend([t, t, t])
            params_posted.extend([t, t, t])
            
        if location and location.strip():
            t = f"%{location.strip()}%"
            where_scraped.append("location ILIKE %s")
            where_posted.append("location ILIKE %s")
            params_scraped.append(t)
            params_posted.append(t)
            
        if date_posted == "24h":
            where_scraped.append("scraped_at > NOW() - INTERVAL '24 hours'")
            where_posted.append("created_at > NOW() - INTERVAL '24 hours'")
        elif date_posted == "7d":
            where_scraped.append("scraped_at > NOW() - INTERVAL '7 days'")
            where_posted.append("created_at > NOW() - INTERVAL '7 days'")
        elif date_posted == "30d":
            where_scraped.append("scraped_at > NOW() - INTERVAL '30 days'")
            where_posted.append("created_at > NOW() - INTERVAL '30 days'")
        
        where_sql_scraped = " AND ".join(where_scraped)
        where_sql_posted = " AND ".join(where_posted)
        
        order_posted = "created_at DESC" if sort_by == "recent" else "title ASC"
        order_scraped = "scraped_at DESC" if sort_by == "recent" else "job_title ASC"
        
        # Step 3: Get POSTED JOBS (from registered companies)
        cur.execute(
            f"""
            SELECT 
                id, 
                'Posted' as source,
                title as job_title,
                company_name as company,
                location,
                description,
                application_url as job_url,
                created_at as scraped_at,
                created_at,
                TRUE as is_company_posted
            FROM posted_jobs
            WHERE {where_sql_posted}
            ORDER BY {order_posted}
            """,
            tuple(params_posted),
        )
        posted_rows = cur.fetchall()
        posted_companies = set()
        posted_jobs_list = []
        
        cols_posted = ["id", "source", "job_title", "company", "location", "description", "job_url", "scraped_at", "created_at", "is_company_posted"]
        
        for row in posted_rows:
            d = dict(zip(cols_posted, row))
            company_lower = d.get("company", "").lower().strip()
            posted_companies.add(company_lower)
            
            if d.get("scraped_at") and hasattr(d["scraped_at"], "isoformat"):
                d["scraped_at"] = d["scraped_at"].isoformat()
            d["source_type"] = "direct"
            d["id"] = f"posted_{d['id']}"  # Prefix to avoid ID conflicts
            posted_jobs_list.append(d)
        
        # Step 4: Get SCRAPED JOBS (but skip if company is registered)
        cur.execute(
            f"""
            SELECT 
                id, 
                source,
                job_title,
                company,
                location,
                description,
                job_url,
                scraped_at,
                created_at
            FROM jobs
            WHERE {where_sql_scraped}
            ORDER BY {order_scraped}
            """,
            tuple(params_scraped),
        )
        scraped_rows = cur.fetchall()
        scraped_jobs_list = []
        
        cols_scraped = ["id", "source", "job_title", "company", "location", "description", "job_url", "scraped_at", "created_at"]
        
        for row in scraped_rows:
            d = dict(zip(cols_scraped, row))
            company_lower = d.get("company", "").lower().strip()
            
            # SKIP if this company is registered (we already have their posted job)
            if company_lower in registered_companies:
                continue
            
            if d.get("scraped_at") and hasattr(d["scraped_at"], "isoformat"):
                d["scraped_at"] = d["scraped_at"].isoformat()
            d["is_company_posted"] = False
            d["source_type"] = "scraped"
            d["id"] = f"scraped_{d['id']}"  # Prefix to avoid ID conflicts
            scraped_jobs_list.append(d)
        
        # Step 5: Combine lists (Posted jobs first, then scraped)
        combined_jobs = posted_jobs_list + scraped_jobs_list
        total_count = len(combined_jobs)
        
        # Step 6: Apply pagination
        paginated_jobs = combined_jobs[offset:offset + limit]
        
        return paginated_jobs, total_count
        
    except Exception as e:
        print(f"Error in search_jobs_with_company_priority: {e}")
        return [], 0
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
    """Return a job by id.

    Positive ids come from the `jobs` table (scraped job boards). Negative
    ids represent company-posted jobs (the match pipeline encodes posted
    job `pj.id` as `pj.id * -1` so they can share a single id-space with
    scraped jobs). For negative ids, look up `posted_jobs` instead and
    return a dict shaped like a scraped job.
    """
    conn = get_connection()
    cur = conn.cursor()
    try:
        if job_id < 0:
            cur.execute(
                """
                SELECT id, title, company_name, location, description,
                       application_url, created_at
                FROM posted_jobs
                WHERE id = %s AND is_active = TRUE
                """,
                (-job_id,),
            )
            row = cur.fetchone()
            if row is None:
                return None
            posted_id, title, company, location, description, application_url, created_at = row
            out = {
                "id": -posted_id,
                "source": "company_posted",
                "job_title": title,
                "company": company,
                "location": location,
                "description": description,
                "job_url": application_url or f"/jobs/{posted_id}",
                "scraped_at": created_at,
            }
            if out.get("scraped_at") and hasattr(out["scraped_at"], "isoformat"):
                out["scraped_at"] = out["scraped_at"].isoformat()
            return out

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
                application_url, application_email, expires_at, is_featured
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
                bool(data.get("is_featured")),
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


def count_available_jobs() -> int:
    """Active scraped jobs plus active, non-expired company postings."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT
                (SELECT COUNT(*) FROM jobs WHERE is_active = TRUE)
                + (SELECT COUNT(*) FROM posted_jobs
                   WHERE is_active = TRUE
                     AND (expires_at IS NULL OR expires_at > NOW()))
            """
        )
        row = cur.fetchone()
        return int(row[0] or 0)
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


# ---------------------------------------------------------------------------
# Vertex posted job applications (company pipeline)
# ---------------------------------------------------------------------------

_VERTEX_APP_COLS = [
    "id", "posted_job_id", "jobseeker_user_id", "status", "cover_message",
    "applicant_name", "applicant_email", "headline", "location",
    "years_experience", "skills", "cv_filename", "profile_slug",
    "company_notes", "applied_at", "updated_at",
]


def _row_to_vertex_application(row) -> dict:
    d = dict(zip(_VERTEX_APP_COLS, row))
    if d.get("skills") is None:
        d["skills"] = []
    for k in ("applied_at", "updated_at"):
        if d.get(k) and hasattr(d[k], "isoformat"):
            d[k] = d[k].isoformat()
    return d


def _sync_posted_job_applications_count(cur, posted_job_id: int) -> None:
    cur.execute(
        """
        UPDATE posted_jobs
        SET applications_count = (
            SELECT COUNT(*)::int FROM posted_job_applications
            WHERE posted_job_id = %s AND status != 'withdrawn'
        ),
        updated_at = NOW()
        WHERE id = %s
        """,
        (posted_job_id, posted_job_id),
    )


def get_posted_job_company_owner(posted_job_id: int) -> Optional[int]:
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT company_user_id FROM posted_jobs WHERE id = %s",
            (posted_job_id,),
        )
        row = cur.fetchone()
        return row[0] if row else None
    finally:
        cur.close()
        conn.close()


def has_posted_job_application(posted_job_id: int, jobseeker_user_id: int) -> bool:
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT 1 FROM posted_job_applications
            WHERE posted_job_id = %s AND jobseeker_user_id = %s
            """,
            (posted_job_id, jobseeker_user_id),
        )
        return cur.fetchone() is not None
    finally:
        cur.close()
        conn.close()


def get_posted_job_application_for_user(
    posted_job_id: int, jobseeker_user_id: int
) -> Optional[dict]:
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            SELECT {", ".join(_VERTEX_APP_COLS)}
            FROM posted_job_applications
            WHERE posted_job_id = %s AND jobseeker_user_id = %s
            """,
            (posted_job_id, jobseeker_user_id),
        )
        row = cur.fetchone()
        return _row_to_vertex_application(row) if row else None
    finally:
        cur.close()
        conn.close()


def create_posted_job_application(
    posted_job_id: int,
    jobseeker_user_id: int,
    data: dict,
) -> int:
    conn = get_connection()
    cur = conn.cursor()
    try:
        # Fetch job_title and company_name to denormalize into the application row
        cur.execute(
            "SELECT title, company_name FROM posted_jobs WHERE id = %s",
            (posted_job_id,),
        )
        job_row = cur.fetchone()
        job_title = job_row[0] if job_row else None
        job_company = job_row[1] if job_row else None

        cur.execute(
            f"""
            INSERT INTO posted_job_applications (
                posted_job_id, jobseeker_user_id, status, cover_message,
                applicant_name, applicant_email, headline, location,
                years_experience, skills, cv_filename, profile_slug,
                job_title, company_name
            )
            VALUES (%s, %s, 'applied', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                posted_job_id,
                jobseeker_user_id,
                (data.get("cover_message") or "").strip() or None,
                (data.get("applicant_name") or "").strip()[:255],
                (data.get("applicant_email") or "").strip()[:255],
                (data.get("headline") or "").strip()[:255] or None,
                (data.get("location") or "").strip()[:255] or None,
                int(data.get("years_experience") or 0),
                list(data.get("skills") or []),
                (data.get("cv_filename") or "").strip()[:255] or None,
                (data.get("profile_slug") or "").strip()[:100] or None,
                job_title,
                job_company,
            ),
        )
        app_id = cur.fetchone()[0]
        _sync_posted_job_applications_count(cur, posted_job_id)
        conn.commit()
        return app_id
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def get_jobseeker_vertex_applications(jobseeker_user_id: int) -> list:
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            SELECT
                a.id, a.posted_job_id, a.jobseeker_user_id, a.status, a.cover_message,
                a.applicant_name, a.applicant_email, a.headline, a.location,
                a.years_experience, a.skills, a.cv_filename, a.profile_slug,
                a.company_notes, a.applied_at, a.updated_at,
                COALESCE(j.title,        a.job_title)    AS job_title,
                COALESCE(j.company_name, a.company_name) AS company_name,
                j.location AS job_location
            FROM posted_job_applications a
            LEFT JOIN posted_jobs j ON j.id = a.posted_job_id
            WHERE a.jobseeker_user_id = %s
            ORDER BY a.updated_at DESC
            """,
            (jobseeker_user_id,),
        )
        rows = cur.fetchall()
        out = []
        for row in rows:
            d = _row_to_vertex_application(row[:16])
            d["job_title"] = row[16]
            d["company_name"] = row[17]
            d["job_location"] = row[18]
            out.append(d)
        return out
    finally:
        cur.close()
        conn.close()


def get_company_posted_job_applications(
    company_user_id: int,
    posted_job_id: Optional[int] = None,
    status: Optional[str] = None,
) -> list:
    conn = get_connection()
    cur = conn.cursor()
    try:
        clauses = ["j.company_user_id = %s"]
        params: list = [company_user_id]
        if posted_job_id is not None:
            clauses.append("a.posted_job_id = %s")
            params.append(posted_job_id)
        if status:
            clauses.append("a.status = %s")
            params.append(status)
        where = " AND ".join(clauses)
        cur.execute(
            f"""
            SELECT
                a.id, a.posted_job_id, a.jobseeker_user_id, a.status, a.cover_message,
                a.applicant_name, a.applicant_email, a.headline, a.location,
                a.years_experience, a.skills, a.cv_filename, a.profile_slug,
                a.company_notes, a.applied_at, a.updated_at,
                j.title AS job_title, j.company_name
            FROM posted_job_applications a
            JOIN posted_jobs j ON j.id = a.posted_job_id
            WHERE {where}
            ORDER BY a.applied_at DESC
            """,
            tuple(params),
        )
        rows = cur.fetchall()
        out = []
        for row in rows:
            d = _row_to_vertex_application(row[:16])
            d["job_title"] = row[16]
            d["company_name"] = row[17]
            out.append(d)
        return out
    finally:
        cur.close()
        conn.close()


def get_posted_job_application_by_id(
    application_id: int,
    company_user_id: Optional[int] = None,
) -> Optional[dict]:
    conn = get_connection()
    cur = conn.cursor()
    try:
        clauses = ["a.id = %s"]
        params: list = [application_id]
        if company_user_id is not None:
            clauses.append("j.company_user_id = %s")
            params.append(company_user_id)
        cur.execute(
            f"""
            SELECT
                a.id, a.posted_job_id, a.jobseeker_user_id, a.status, a.cover_message,
                a.applicant_name, a.applicant_email, a.headline, a.location,
                a.years_experience, a.skills, a.cv_filename, a.profile_slug,
                a.company_notes, a.applied_at, a.updated_at,
                j.title AS job_title, j.company_name, j.company_user_id
            FROM posted_job_applications a
            JOIN posted_jobs j ON j.id = a.posted_job_id
            WHERE {" AND ".join(clauses)}
            """,
            tuple(params),
        )
        row = cur.fetchone()
        if not row:
            return None
        d = _row_to_vertex_application(row[:16])
        d["job_title"] = row[16]
        d["company_name"] = row[17]
        d["company_user_id"] = row[18]
        return d
    finally:
        cur.close()
        conn.close()


def update_posted_job_application_status(
    application_id: int,
    company_user_id: int,
    status: str,
    company_notes: Optional[str] = None,
) -> bool:
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT a.posted_job_id
            FROM posted_job_applications a
            JOIN posted_jobs j ON j.id = a.posted_job_id
            WHERE a.id = %s AND j.company_user_id = %s
            """,
            (application_id, company_user_id),
        )
        row = cur.fetchone()
        if not row:
            return False
        posted_job_id = row[0]
        if company_notes is not None:
            cur.execute(
                """
                UPDATE posted_job_applications
                SET status = %s,
                    company_notes = %s,
                    updated_at = NOW()
                WHERE id = %s
                  AND posted_job_id IN (
                      SELECT id FROM posted_jobs WHERE company_user_id = %s
                  )
                """,
                (
                    status,
                    (company_notes or "").strip() or None,
                    application_id,
                    company_user_id,
                ),
            )
        else:
            cur.execute(
                """
                UPDATE posted_job_applications
                SET status = %s, updated_at = NOW()
                WHERE id = %s
                  AND posted_job_id IN (
                      SELECT id FROM posted_jobs WHERE company_user_id = %s
                  )
                """,
                (status, application_id, company_user_id),
            )
        if cur.rowcount == 0:
            conn.rollback()
            return False
        _sync_posted_job_applications_count(cur, posted_job_id)
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


def withdraw_posted_job_application(
    application_id: int,
    jobseeker_user_id: int,
) -> bool:
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT posted_job_id FROM posted_job_applications
            WHERE id = %s AND jobseeker_user_id = %s
            """,
            (application_id, jobseeker_user_id),
        )
        row = cur.fetchone()
        if not row:
            return False
        posted_job_id = row[0]
        cur.execute(
            """
            UPDATE posted_job_applications
            SET status = 'withdrawn', updated_at = NOW()
            WHERE id = %s AND jobseeker_user_id = %s
            """,
            (application_id, jobseeker_user_id),
        )
        _sync_posted_job_applications_count(cur, posted_job_id)
        conn.commit()
        return cur.rowcount > 0
    except Exception:
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


# ---------------------------------------------------------------------------
# Admin platform management
# ---------------------------------------------------------------------------

def _admin_iso_dict(row, cols) -> Optional[dict]:
    if row is None:
        return None
    out = dict(zip(cols, row))
    for k, v in list(out.items()):
        if hasattr(v, "isoformat"):
            out[k] = v.isoformat()
    return out


def delete_user_account(user_id: int) -> bool:
    """Delete a non-admin user. Returns True if a row was deleted."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "DELETE FROM users WHERE id = %s AND is_admin = FALSE",
            (user_id,),
        )
        conn.commit()
        return cur.rowcount > 0
    except Exception:
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


def get_full_user_details(user_id: int) -> Optional[dict]:
    """Full user record for admin detail view."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT
                u.id, u.email, u.full_name, u.user_type,
                u.is_active, u.is_admin,
                COALESCE(NULLIF(TRIM(u.plan), ''), 'free') AS plan,
                u.created_at, u.updated_at,
                up.headline, up.bio, up.location,
                up.skills, up.cv_filename, up.cv_text,
                up.years_experience, up.linkedin_url,
                cp.company_name, cp.website,
                cp.industry, cp.company_size,
                cp.description AS company_description,
                s.stripe_subscription_id,
                s.status AS subscription_status,
                s.current_period_end,
                (SELECT COUNT(*) FROM job_applications WHERE user_id = u.id) AS applications_count,
                (SELECT COUNT(*) FROM saved_jobs WHERE user_id = u.id) AS saved_jobs_count,
                (SELECT COUNT(*) FROM contact_requests
                 WHERE candidate_user_id = u.id OR company_user_id = u.id) AS requests_count
            FROM users u
            LEFT JOIN user_profiles up ON up.email = u.email
            LEFT JOIN company_profiles cp ON cp.user_id = u.id
            LEFT JOIN subscriptions s ON s.user_id = u.id
            WHERE u.id = %s
            """,
            (user_id,),
        )
        row = cur.fetchone()
        if not row:
            return None
        cols = [d[0] for d in cur.description]
        return _admin_iso_dict(row, cols)
    finally:
        cur.close()
        conn.close()


def update_user_plan(user_id: int, plan: str) -> bool:
    """Set user plan and upsert subscription row."""
    if plan not in ("free", "pro", "business"):
        return False
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("UPDATE users SET plan = %s, updated_at = NOW() WHERE id = %s", (plan, user_id))
        cur.execute(
            """
            INSERT INTO subscriptions (user_id, plan, status, updated_at)
            VALUES (%s, %s, 'active', NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                plan = EXCLUDED.plan,
                status = 'active',
                updated_at = NOW()
            """,
            (user_id, plan),
        )
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


def admin_delete_job(job_id: int) -> bool:
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM job_embeddings WHERE job_id = %s", (job_id,))
        cur.execute("DELETE FROM jobs WHERE id = %s", (job_id,))
        conn.commit()
        return cur.rowcount > 0
    except Exception:
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


def admin_update_job(job_id: int, data: dict) -> bool:
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            UPDATE jobs SET
                job_title = %s,
                company = %s,
                location = %s,
                description = %s,
                is_active = %s
            WHERE id = %s
            """,
            (
                data.get("job_title"),
                data.get("company"),
                data.get("location"),
                data.get("description"),
                data.get("is_active", True),
                job_id,
            ),
        )
        conn.commit()
        return cur.rowcount > 0
    except Exception:
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


def _admin_scraped_jobs_where(
    search: Optional[str] = None,
    source: Optional[str] = None,
) -> tuple[str, list]:
    where = ["1=1"]
    params: list = []
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        where.append(
            "(job_title ILIKE %s OR company ILIKE %s OR COALESCE(description, '') ILIKE %s)"
        )
        params.extend([pattern, pattern, pattern])
    if source and source.strip():
        where.append("source = %s")
        params.append(source.strip())
    return " AND ".join(where), params


def _admin_posted_jobs_where(search: Optional[str] = None) -> tuple[str, list]:
    where = ["1=1"]
    params: list = []
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        where.append(
            "(title ILIKE %s OR company_name ILIKE %s OR COALESCE(description, '') ILIKE %s)"
        )
        params.extend([pattern, pattern, pattern])
    return " AND ".join(where), params


_ADMIN_JOB_SELECT_SCRAPED = """
    SELECT
        id,
        'job_board'::text AS listing_kind,
        source,
        job_title,
        company,
        location,
        description,
        is_active,
        scraped_at AS listed_at,
        job_url,
        NULL::varchar AS job_type,
        NULL::varchar AS experience_level
    FROM jobs
"""

_ADMIN_JOB_SELECT_POSTED = """
    SELECT
        id,
        'vertex'::text AS listing_kind,
        'vertex'::text AS source,
        title AS job_title,
        company_name AS company,
        location,
        description,
        is_active,
        created_at AS listed_at,
        COALESCE(application_url, '') AS job_url,
        job_type,
        experience_level
    FROM posted_jobs
"""


def admin_get_all_jobs(
    limit: int = 50,
    offset: int = 0,
    search: Optional[str] = None,
    source: Optional[str] = None,
    listing_type: Optional[str] = None,
) -> dict:
    """Admin job list: scraped job boards, Vertex posted jobs, or both."""
    lt = (listing_type or "all").strip().lower()
    if lt not in ("all", "job_boards", "vertex"):
        lt = "all"

    scraped_clause, scraped_params = _admin_scraped_jobs_where(search, source)
    posted_clause, posted_params = _admin_posted_jobs_where(search)

    cols = [
        "id",
        "listing_kind",
        "source",
        "job_title",
        "company",
        "location",
        "description",
        "is_active",
        "listed_at",
        "job_url",
        "job_type",
        "experience_level",
    ]

    conn = get_connection()
    cur = conn.cursor()
    try:
        if lt == "job_boards":
            cur.execute(
                f"SELECT COUNT(*) FROM jobs WHERE {scraped_clause}",
                tuple(scraped_params),
            )
            total = cur.fetchone()[0] or 0
            cur.execute(
                f"""
                {_ADMIN_JOB_SELECT_SCRAPED}
                WHERE {scraped_clause}
                ORDER BY scraped_at DESC NULLS LAST
                LIMIT %s OFFSET %s
                """,
                tuple(scraped_params + [limit, offset]),
            )
        elif lt == "vertex":
            cur.execute(
                f"SELECT COUNT(*) FROM posted_jobs WHERE {posted_clause}",
                tuple(posted_params),
            )
            total = cur.fetchone()[0] or 0
            cur.execute(
                f"""
                {_ADMIN_JOB_SELECT_POSTED}
                WHERE {posted_clause}
                ORDER BY created_at DESC NULLS LAST
                LIMIT %s OFFSET %s
                """,
                tuple(posted_params + [limit, offset]),
            )
        else:
            cur.execute(
                f"SELECT COUNT(*) FROM jobs WHERE {scraped_clause}",
                tuple(scraped_params),
            )
            scraped_total = cur.fetchone()[0] or 0
            cur.execute(
                f"SELECT COUNT(*) FROM posted_jobs WHERE {posted_clause}",
                tuple(posted_params),
            )
            posted_total = cur.fetchone()[0] or 0
            total = scraped_total + posted_total
            cur.execute(
                f"""
                SELECT * FROM (
                    ({_ADMIN_JOB_SELECT_SCRAPED} WHERE {scraped_clause})
                    UNION ALL
                    ({_ADMIN_JOB_SELECT_POSTED} WHERE {posted_clause})
                ) combined
                ORDER BY listed_at DESC NULLS LAST
                LIMIT %s OFFSET %s
                """,
                tuple(scraped_params + posted_params + [limit, offset]),
            )

        jobs = [_admin_iso_dict(r, cols) for r in cur.fetchall()]
        return {"jobs": jobs, "total": total, "listing_type": lt}
    finally:
        cur.close()
        conn.close()


def admin_delete_posted_job(job_id: int) -> bool:
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM posted_jobs WHERE id = %s", (job_id,))
        conn.commit()
        return cur.rowcount > 0
    except Exception:
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


def admin_update_posted_job(job_id: int, data: dict) -> bool:
    """Admin can update any posted job without company ownership check."""
    allowed = (
        "title", "company_name", "location", "description", "is_active",
        "job_type", "experience_level", "application_url", "application_email",
    )
    updates = []
    values = []
    for k in allowed:
        if k not in data:
            continue
        updates.append(f"{k} = %s")
        values.append(data[k])
    if not updates:
        return True
    updates.append("updated_at = NOW()")
    values.append(job_id)
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            f"UPDATE posted_jobs SET {', '.join(updates)} WHERE id = %s",
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


def create_platform_announcement(
    title: str,
    message: str,
    target: str,
    admin_id: int,
) -> int:
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO announcements (title, message, target, sent_by)
            VALUES (%s, %s, %s, %s)
            RETURNING id
            """,
            (title, message, target, admin_id),
        )
        ann_id = cur.fetchone()[0]
        conn.commit()
        return ann_id
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def update_announcement_recipients_count(announcement_id: int, count: int) -> None:
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "UPDATE announcements SET recipients_count = %s WHERE id = %s",
            (count, announcement_id),
        )
        conn.commit()
    finally:
        cur.close()
        conn.close()


def get_users_for_announcement(target: str) -> list:
    """Active non-admin users eligible for announcement notifications and email."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        base = (
            "SELECT id, email, full_name FROM users "
            "WHERE is_active = TRUE AND is_admin = FALSE"
        )
        if target == "jobseekers":
            cur.execute(base + " AND user_type = 'jobseeker'")
        elif target == "companies":
            cur.execute(base + " AND user_type = 'company'")
        else:
            cur.execute(base)
        cols = ["id", "email", "full_name"]
        return [dict(zip(cols, row)) for row in cur.fetchall()]
    finally:
        cur.close()
        conn.close()


def get_announcement_recipient_counts() -> dict:
    """Counts of active non-admin users per announcement target."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        base = "FROM users WHERE is_active = TRUE AND is_admin = FALSE"
        cur.execute(f"SELECT COUNT(*) {base}")
        all_count = cur.fetchone()[0] or 0
        cur.execute(f"SELECT COUNT(*) {base} AND user_type = 'jobseeker'")
        jobseekers = cur.fetchone()[0] or 0
        cur.execute(f"SELECT COUNT(*) {base} AND user_type = 'company'")
        companies = cur.fetchone()[0] or 0
        return {"all": all_count, "jobseekers": jobseekers, "companies": companies}
    finally:
        cur.close()
        conn.close()


def get_announcements(limit: int = 20) -> list:
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT id, title, message, target, sent_at, recipients_count
            FROM announcements
            ORDER BY sent_at DESC
            LIMIT %s
            """,
            (limit,),
        )
        cols = [d[0] for d in cur.description]
        return [_admin_iso_dict(r, cols) for r in cur.fetchall()]
    finally:
        cur.close()
        conn.close()


def delete_announcement(announcement_id: int) -> bool:
    """Delete announcement and linked in-app notifications (plus legacy matches)."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT title, message FROM announcements WHERE id = %s",
            (announcement_id,),
        )
        row = cur.fetchone()
        if not row:
            return False
        title, message = row
        snippet = (message or "")[:200]
        # Older rows sent before announcement_id was stored
        cur.execute(
            """
            DELETE FROM notifications
            WHERE announcement_id IS NULL
              AND type = 'system'
              AND title = %s
              AND message = %s
              AND COALESCE(link, '') = '/'
            """,
            (title, snippet),
        )
        cur.execute("DELETE FROM announcements WHERE id = %s", (announcement_id,))
        deleted = cur.rowcount > 0
        conn.commit()
        return deleted
    except Exception:
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


DEFAULT_PLAN_CONFIG = {
    "pro_monthly_price": 12,
    "pro_annual_price": 10,
    "business_monthly_price": 49,
    "business_annual_price": 39,
    "free_job_matches_limit": 3,
    "free_saved_jobs_limit": 5,
    "free_job_postings_limit": 1,
    "growth_job_postings_limit": 5,
    "growth_saved_candidates_limit": 25,
    "growth_monthly_price": 29,
    "growth_annual_price": 23,
}


def get_plan_config() -> dict:
    conn = get_connection()
    cur = conn.cursor()
    config = dict(DEFAULT_PLAN_CONFIG)
    try:
        cur.execute("SELECT key, value, updated_at FROM platform_settings")
        rows = cur.fetchall()
        latest = None
        for key, value, updated_at in rows:
            if key in config:
                try:
                    config[key] = int(value) if "." not in str(value) else float(value)
                except ValueError:
                    config[key] = value
            if updated_at and (latest is None or updated_at > latest):
                latest = updated_at
        if latest and hasattr(latest, "isoformat"):
            config["_updated_at"] = latest.isoformat()
        return config
    except Exception:
        return dict(DEFAULT_PLAN_CONFIG)
    finally:
        cur.close()
        conn.close()


def update_plan_config(config: dict) -> bool:
    conn = get_connection()
    cur = conn.cursor()
    try:
        for key, value in config.items():
            if key.startswith("_"):
                continue
            cur.execute(
                """
                INSERT INTO platform_settings (key, value)
                VALUES (%s, %s)
                ON CONFLICT (key) DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = NOW()
                """,
                (key, str(value)),
            )
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    init_database()
    
