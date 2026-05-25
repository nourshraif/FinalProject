from typing import List, Optional, Dict
from app.database.db import get_connection


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