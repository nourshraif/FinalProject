"""
Plan limits for Vertex subscriptions (job seekers + companies).

Company tiers (recommended pricing model):
  - Free: 1 job, basic pipeline, receive applicants — no outbound contact requests
  - Growth (plan=pro): 5 jobs, full pipeline, job boost, hiring funnel analytics
  - Business: search, save, unlimited contact requests, unlimited jobs
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
    """None = unlimited (Business). 0 = not allowed (Free, Growth)."""
    if (user.get("user_type") or "").strip().lower() != "company":
        return None
    plan = _normalize_plan(user)
    if plan == "business":
        return None
    return 0


def can_send_contact_requests(user: dict) -> bool:
    """Outbound contact requests — Business only."""
    if (user.get("user_type") or "").strip().lower() != "company":
        return False
    return _normalize_plan(user) == "business"


def max_saved_candidates(user: dict) -> Optional[int]:
    """0 = not allowed. None = unlimited."""
    if (user.get("user_type") or "").strip().lower() != "company":
        return None
    plan = _normalize_plan(user)
    cfg = get_plan_config()
    if plan == "business":
        return None
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
        "full_pipeline",
        "job_boost",
        "company_analytics",
        "growth_jobs",
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
        if feature in ("post_job_1", "receive_applicants"):
            return True
        if feature in ("contact_requests", "send_contact_requests"):
            return plan == "business"
        if feature in COMPANY_GROWTH_FEATURES:
            return plan in ("pro", "business")
        if feature in COMPANY_BUSINESS_FEATURES:
            return plan == "business"
        return False

    return False


def plan_required_for_feature(user: dict, feature: str) -> str:
    user_type = (user.get("user_type") or "").strip().lower()
    if user_type == "company":
        if feature in ("search_candidates", "search_history", "unlimited_jobs", "unlimited_contact_requests", "save_candidates", "send_contact_requests"):
            return "business"
        if feature in ("full_pipeline", "company_analytics", "growth_jobs"):
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
        "can_send_contact_requests": can_send_contact_requests(user),
        "allowed_pipeline_statuses": sorted(allowed_pipeline_statuses(user)),
        "cancel_at_period_end": False,
        "current_period_end": None,
    }
