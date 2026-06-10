from typing import List, Optional, Dict
from app.database.db import get_connection

# Boards wired into ScraperService.phase1_ingest_from_sources (nightly scraper).
DEFAULT_SCRAPER_SOURCES: List[Dict] = [
    {
        "source_name": "WeWorkRemotely",
        "source_key": "weworkremotely",
        "base_url": "https://weworkremotely.com",
        "scraper_type": "html",
        "api_endpoint": None,
    },
    {
        "source_name": "Indeed",
        "source_key": "indeed",
        "base_url": "https://www.indeed.com",
        "scraper_type": "html",
        "api_endpoint": None,
    },
    {
        "source_name": "LinkedIn",
        "source_key": "linkedin",
        "base_url": "https://www.linkedin.com/jobs",
        "scraper_type": "html",
        "api_endpoint": None,
    },
    {
        "source_name": "RemoteOK",
        "source_key": "remoteok",
        "base_url": "https://remoteok.com",
        "scraper_type": "html",
        "api_endpoint": None,
    },
    {
        "source_name": "Remotive",
        "source_key": "remotive",
        "base_url": "https://remotive.com",
        "scraper_type": "html",
        "api_endpoint": None,
    },
    {
        "source_name": "Arbeitnow",
        "source_key": "arbeitnow",
        "base_url": "https://www.arbeitnow.com",
        "scraper_type": "api",
        "api_endpoint": "https://www.arbeitnow.com/api/job-board-api",
    },
    {
        "source_name": "Himalayas",
        "source_key": "himalayas",
        "base_url": "https://himalayas.app",
        "scraper_type": "html",
        "api_endpoint": None,
    },
    {
        "source_name": "Bayt",
        "source_key": "bayt",
        "base_url": "https://www.bayt.com",
        "scraper_type": "html",
        "api_endpoint": None,
    },
    {
        "source_name": "HireLebanese",
        "source_key": "hirelebanese",
        "base_url": "https://www.hirelebanese.com",
        "scraper_type": "html",
        "api_endpoint": None,
    },
    {
        "source_name": "CareersAndJobsInLebanon",
        "source_key": "careersandjobsinlebanon",
        "base_url": "https://careersandjobsinlebanon.com",
        "scraper_type": "html",
        "api_endpoint": None,
    },
]


# -----------------------------
# CREATE TABLE (run once or at startup)
# -----------------------------
def init_scraper_sources_table():
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS scraper_sources (
                id SERIAL PRIMARY KEY,
                source_name VARCHAR(100) NOT NULL,
                source_key VARCHAR(100) UNIQUE NOT NULL,
                base_url TEXT NOT NULL,
                scraper_type VARCHAR(50) NOT NULL,
                api_endpoint TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                scrape_interval_hours INTEGER DEFAULT 24,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        conn.commit()
    finally:
        cur.close()
        conn.close()


def seed_default_scraper_sources() -> int:
    """Insert built-in job boards when missing (idempotent). Returns rows inserted."""
    init_scraper_sources_table()
    conn = get_connection()
    cur = conn.cursor()
    inserted = 0
    try:
        for src in DEFAULT_SCRAPER_SOURCES:
            cur.execute(
                """
                INSERT INTO scraper_sources (
                    source_name, source_key, base_url, scraper_type,
                    api_endpoint, is_active, scrape_interval_hours
                )
                VALUES (%s, %s, %s, %s, %s, TRUE, 24)
                ON CONFLICT (source_key) DO NOTHING;
                """,
                (
                    src["source_name"],
                    src["source_key"],
                    src["base_url"],
                    src["scraper_type"],
                    src.get("api_endpoint"),
                ),
            )
            inserted += cur.rowcount
        conn.commit()
        return inserted
    finally:
        cur.close()
        conn.close()


# -----------------------------
# CREATE (INSERT)
# -----------------------------
def create_scraper_source(data: Dict) -> int:
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO scraper_sources (
                source_name,
                source_key,
                base_url,
                scraper_type,
                api_endpoint,
                is_active,
                scrape_interval_hours
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id;
        """, (
            data["source_name"],
            data["source_key"],
            data["base_url"],
            data["scraper_type"],
            data.get("api_endpoint"),
            data.get("is_active", True),
            data.get("scrape_interval_hours", 24),
        ))

        source_id = cur.fetchone()[0]
        conn.commit()
        return source_id

    finally:
        cur.close()
        conn.close()


# -----------------------------
# READ ALL
# -----------------------------
def count_scraper_sources(*, active_only: bool = True) -> int:
    """Count configured job boards in scraper_sources."""
    init_scraper_sources_table()
    conn = get_connection()
    cur = conn.cursor()
    try:
        if active_only:
            cur.execute(
                "SELECT COUNT(*) FROM scraper_sources WHERE is_active = TRUE"
            )
        else:
            cur.execute("SELECT COUNT(*) FROM scraper_sources")
        row = cur.fetchone()
        return int(row[0] or 0)
    finally:
        cur.close()
        conn.close()


def get_all_scraper_sources() -> List[Dict]:
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT id, source_name, source_key, base_url,
                   scraper_type, api_endpoint, is_active,
                   scrape_interval_hours, created_at
            FROM scraper_sources
            ORDER BY id DESC;
        """)

        rows = cur.fetchall()
        cols = [desc[0] for desc in cur.description]

        return [dict(zip(cols, row)) for row in rows]

    finally:
        cur.close()
        conn.close()


# -----------------------------
# READ ONE
# -----------------------------
def get_scraper_source_by_key(source_key: str) -> Optional[Dict]:
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT id, source_name, source_key, base_url,
                   scraper_type, api_endpoint, is_active,
                   scrape_interval_hours, created_at
            FROM scraper_sources
            WHERE source_key = %s;
        """, (source_key,))

        row = cur.fetchone()
        if not row:
            return None

        cols = [desc[0] for desc in cur.description]
        return dict(zip(cols, row))

    finally:
        cur.close()
        conn.close()


# -----------------------------
# UPDATE
# -----------------------------
def update_scraper_source(source_id: int, data: Dict) -> bool:
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            UPDATE scraper_sources
            SET source_name = %s,
                base_url = %s,
                scraper_type = %s,
                api_endpoint = %s,
                is_active = %s,
                scrape_interval_hours = %s
            WHERE id = %s;
        """, (
            data["source_name"],
            data["base_url"],
            data["scraper_type"],
            data.get("api_endpoint"),
            data.get("is_active", True),
            data.get("scrape_interval_hours", 24),
            source_id
        ))

        conn.commit()
        return cur.rowcount > 0

    finally:
        cur.close()
        conn.close()


# -----------------------------
# DELETE
# -----------------------------
def delete_scraper_source(source_id: int) -> bool:
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            DELETE FROM scraper_sources
            WHERE id = %s;
        """, (source_id,))

        conn.commit()
        return cur.rowcount > 0

    finally:
        cur.close()
        conn.close()