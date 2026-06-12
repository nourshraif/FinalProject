"""
Plan limits for Vertex subscriptions (job seekers + companies).

Company tiers (recommended pricing model):
  - Free: 1 job, 3 contact requests/mo, basic pipeline, receive applicants
  - Growth (plan=pro): 5 jobs, 20 contacts/mo, full pipeline, 25 saves, job boost, analytics
  - Business: unlimited jobs/contacts/saves, candidate search, search history
"""

from __future__ import annotations

from typing import Any, Dict, Optional, Set

FREE_PIPELINE_STATUSES: Set[str] = {"applied", "rejected"}
FULL_PIPELINE_STATUSES: Set[str] = {
    "applied",
    "reviewing",
    "interviewing",
    "offer",
    "rejected",
}


def _normalize_plan(user: Optional[dict]) -> str:
    if not user:
        return "free"
    plan = (user.get("plan") or "free").strip().lower()
    if plan not in ("free", "pro", "business"):
        return "free"
    return plan


def get_plan_config() -> dict:
    try:
        from app.database.db import get_plan_config as db_get_plan_config

        return db_get_plan_config()
    except Exception:
        return {}


def company_plan_label(plan: str) -> str:
    if plan == "business":
        return "Business"
    if plan == "pro":
        return "Growth"
    return "Free"


def max_active_jobs(user: dict) -> Optional[int]:
    """None means unlimited."""
    if (user.get("user_type") or "").strip().lower() != "company":
        return None
    plan = _normalize_plan(user)
    cfg = get_plan_config()
    if plan == "business":
        return None
    if plan == "pro":
        return int(cfg.get("growth_job_postings_limit", 5))
    return int(cfg.get("free_job_postings_limit", 1))


def max_contact_requests_30d(user: dict) -> Optional[int]:
    """None means unlimited."""
    if (user.get("user_type") or "").strip().lower() != "company":
        return None
    plan = _normalize_plan(user)
    cfg = get_plan_config()
    if plan == "business":
        return None
    if plan == "pro":
        return int(cfg.get("growth_contact_requests_limit", 20))
    return int(cfg.get("free_contact_requests_limit", 3))


def max_saved_candidates(user: dict) -> Optional[int]:
    """0 = not allowed. None = unlimited."""
    if (user.get("user_type") or "").strip().lower() != "company":
        return None
    plan = _normalize_plan(user)
    cfg = get_plan_config()
    if plan == "business":
        return None
    if plan == "pro":
        return int(cfg.get("growth_saved_candidates_limit", 25))
    return 0


def can_search_candidates(user: dict) -> bool:
    return (
        (user.get("user_type") or "").strip().lower() == "company"
        and _normalize_plan(user) == "business"
    )


def can_search_history(user: dict) -> bool:
    return can_search_candidates(user)


def can_company_analytics(user: dict) -> bool:
    return (
        (user.get("user_type") or "").strip().lower() == "company"
        and _normalize_plan(user) in ("pro", "business")
    )


def can_full_pipeline(user: dict) -> bool:
    return (
        (user.get("user_type") or "").strip().lower() == "company"
        and _normalize_plan(user) in ("pro", "business")
    )


def has_job_boost(user: dict) -> bool:
    return can_full_pipeline(user)


def allowed_pipeline_statuses(user: dict) -> Set[str]:
    if can_full_pipeline(user):
        return FULL_PIPELINE_STATUSES
    return FREE_PIPELINE_STATUSES


def check_plan_access(user: Optional[dict], feature: str) -> bool:
    """Feature gate used across the API."""
    if not user:
        return False
    if user.get("is_admin"):
        return True

    plan = _normalize_plan(user)
    user_type = (user.get("user_type") or "").strip().lower()

    JOBSEEKER_FREE_FEATURES = [
        "apply_jobs",
        "view_profile",
        "upload_cv",
        "browse_jobs",
        "save_jobs",
    ]
    JOBSEEKER_PRO_FEATURES = [
        "view_matches",
        "skills_gap",
        "priority_matching",
        "profile_boost",
        "application_tracker",
        "job_alerts",
    ]
    COMPANY_GROWTH_FEATURES = [
        "save_candidates",
        "full_pipeline",
        "job_boost",
        "company_analytics",
        "growth_jobs",
        "growth_contact_requests",
    ]
    COMPANY_BUSINESS_FEATURES = [
        "search_candidates",
        "save_candidates",
        "unlimited_contact_requests",
        "search_history",
        "analytics",
        "unlimited_jobs",
        "unlimited_saved_candidates",
    ]

    if user_type == "jobseeker":
        if feature in JOBSEEKER_FREE_FEATURES:
            return True
        if feature in JOBSEEKER_PRO_FEATURES:
            return plan in ("pro", "business")
        return False

    if user_type == "company":
        if feature in ("post_job_1", "contact_requests_3", "receive_applicants"):
            return True
        if feature in COMPANY_GROWTH_FEATURES:
            return plan in ("pro", "business")
        if feature in COMPANY_BUSINESS_FEATURES:
            if feature == "save_candidates" and plan == "pro":
                return True
            return plan == "business"
        return False

    return False


def plan_required_for_feature(user: dict, feature: str) -> str:
    user_type = (user.get("user_type") or "").strip().lower()
    if user_type == "company":
        if feature in ("search_candidates", "search_history", "unlimited_jobs", "unlimited_contact_requests"):
            return "business"
        if feature in ("save_candidates", "full_pipeline", "company_analytics", "growth_jobs", "growth_contact_requests"):
            return "pro"
    return "pro"


def company_usage_summary(
    user: dict,
    *,
    active_jobs: int = 0,
    contact_requests_30d: int = 0,
    saved_candidates: int = 0,
) -> Dict[str, Any]:
    plan = _normalize_plan(user)
    max_jobs = max_active_jobs(user)
    max_contacts = max_contact_requests_30d(user)
    max_saves = max_saved_candidates(user)
    return {
        "plan": plan,
        "plan_label": company_plan_label(plan),
        "active_jobs": active_jobs,
        "max_active_jobs": max_jobs,
        "contact_requests_30d": contact_requests_30d,
        "max_contact_requests_30d": max_contacts,
        "saved_candidates": saved_candidates,
        "max_saved_candidates": max_saves,
        "can_search_candidates": can_search_candidates(user),
        "can_search_history": can_search_history(user),
        "can_company_analytics": can_company_analytics(user),
        "can_full_pipeline": can_full_pipeline(user),
        "has_job_boost": has_job_boost(user),
        "allowed_pipeline_statuses": sorted(allowed_pipeline_statuses(user)),
    }
