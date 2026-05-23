"""
One-time migration: generate profile_slug for existing job seeker users
who don't have one. Run from project root: python scripts/generate_slugs.py
"""
import sys
from pathlib import Path

project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

from app.database.db import get_connection
import re


def generate_slug(full_name: str, user_id: int) -> str:
    slug = (full_name or "").lower()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"\s+", "-", slug.strip())
    return f"{slug or 'user'}-{user_id}"


def run():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT u.id, u.full_name, u.email
        FROM users u
        LEFT JOIN user_profiles p ON p.email = u.email
        WHERE u.user_type = 'jobseeker'
        AND (p.profile_slug IS NULL OR TRIM(p.profile_slug) = '')
        """
    )
    users = cur.fetchall()

    print(f"Generating slugs for {len(users)} users")

    for user_id, full_name, email in users:
        slug = generate_slug(full_name or "", user_id)
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
            (email, full_name or "", slug),
        )
        print(f"  {full_name or email} -> /u/{slug}")

    conn.commit()
    cur.close()
    conn.close()
    print("Done!")


if __name__ == "__main__":
    run()
