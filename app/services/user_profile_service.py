"""
User Profile Service

Handles saving job-seeker profiles (email + extracted skills + CV embedding)
to the database so companies can later search and match against them.
"""

from typing import List, Optional, Dict
import numpy as np
from app.database.db import get_connection

# Pro/Business jobseekers are listed above Free jobseekers in candidate search.


def _has_profile_boost(plan: Optional[str]) -> bool:
    return (plan or "free").strip().lower() in ("pro", "business")


# ---------------------------------------------------------------------------
# Save / Upsert a user profile
# ---------------------------------------------------------------------------

def save_user_profile(
    email: str,
    skills: List[str],
    cv_text: str = "",
    full_name: str = "",
    cv_filename: str = "",
    skills_embedding: Optional[np.ndarray] = None,
) -> int:
    """
    Insert or update a user profile.
    Returns the profile id.
    """
    conn = get_connection()
    cur = conn.cursor()

    embedding_value = skills_embedding.tolist() if skills_embedding is not None else None

    try:
        cur.execute(
            """
            INSERT INTO user_profiles
                (email, full_name, cv_text, skills, skills_embedding, cv_filename, updated_at)
            VALUES (%s, %s, %s, %s, %s::vector, %s, NOW())
            ON CONFLICT (email) DO UPDATE SET
                full_name         = EXCLUDED.full_name,
                cv_text           = EXCLUDED.cv_text,
                skills            = EXCLUDED.skills,
                skills_embedding  = EXCLUDED.skills_embedding,
                cv_filename       = EXCLUDED.cv_filename,
                updated_at        = NOW()
            RETURNING id
            """,
            (
                email,
                full_name or "",
                cv_text or "",
                skills,
                embedding_value,
                cv_filename or "",
            ),
        )
        profile_id = cur.fetchone()[0]
        conn.commit()
        return profile_id

    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        conn.close()


# ---------------------------------------------------------------------------
# Find matching candidates for a company's required skills
# ---------------------------------------------------------------------------

def find_matching_candidates(
    required_skills: List[str],
    top_k: int = 20,
    min_keyword_matches: int = 1,
) -> List[Dict]:
    """
    Return user profiles ranked by keyword skill overlap with required skills.
    """
    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute(
            """
            SELECT
                up.id,
                up.email,
                up.full_name,
                up.skills,
                up.cv_filename,
                up.created_at,
                u.id AS user_id,
                u.plan AS user_plan,
                up.profile_slug,
                up.location,
                up.years_experience
            FROM user_profiles up
            LEFT JOIN users u ON u.email = up.email AND u.user_type = 'jobseeker'
            ORDER BY up.created_at DESC
            LIMIT %s
            """,
            (top_k * 10,),
        )
        rows = cur.fetchall()
    finally:
        cur.close()
        conn.close()

    required_lower = [s.lower().strip() for s in required_skills]
    candidates = []

    for row in rows:
        (
            pid,
            email,
            full_name,
            skills,
            cv_filename,
            created_at,
            user_id,
            user_plan,
            profile_slug,
            location,
            years_experience,
        ) = row
        candidate_skills = [s.lower().strip() for s in (skills or [])]

        matched = [r for r in required_lower if any(r in c or c in r for c in candidate_skills)]
        keyword_score = len(matched) / len(required_lower) if required_lower else 0

        if len(matched) < min_keyword_matches:
            continue

        score_pct = round(keyword_score * 100, 1)
        candidates.append(
            {
                "id": pid,
                "email": email,
                "full_name": full_name or "—",
                "skills": skills or [],
                "cv_filename": cv_filename,
                "created_at": created_at,
                "matched_skills": matched,
                "keyword_score": score_pct,
                "profile_boosted": _has_profile_boost(user_plan),
                "user_id": user_id,
                "profile_slug": profile_slug,
                "location": location,
                "years_experience": years_experience,
            }
        )

    candidates.sort(key=lambda x: (x["profile_boosted"], x["keyword_score"]), reverse=True)
    return candidates[:top_k]


# ---------------------------------------------------------------------------
# Log a company search (optional audit)
# ---------------------------------------------------------------------------

def log_company_search(
    company_name: str,
    required_skills: List[str],
    user_id: Optional[int] = None,
    results_count: int = 0,
) -> None:
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO company_searches
                (company_name, required_skills, user_id, results_count)
            VALUES (%s, %s, %s, %s)
            """,
            (company_name, required_skills, user_id, results_count),
        )
        conn.commit()
    except Exception:
        conn.rollback()
    finally:
        cur.close()
        conn.close()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_all_profiles(limit: int = 100) -> List[Dict]:
    """Return all saved profiles (for admin / debugging)."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT id, email, full_name, skills, cv_filename, created_at
            FROM user_profiles
            ORDER BY created_at DESC
            LIMIT %s
            """,
            (limit,),
        )
        rows = cur.fetchall()
        return [
            {
                "id": r[0],
                "email": r[1],
                "full_name": r[2] or "—",
                "skills": r[3] or [],
                "cv_filename": r[4] or "",
                "created_at": r[5],
            }
            for r in rows
        ]
    finally:
        cur.close()
        conn.close()


def get_profile_count() -> int:
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT COUNT(*) FROM user_profiles")
        return cur.fetchone()[0]
    except Exception:
        return 0
    finally:
        cur.close()
        conn.close()
