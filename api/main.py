

"""
FastAPI backend for the job matching app.

Run from project root: uvicorn api.main:app --reload
Requires: pip install fastapi uvicorn python-multipart
"""

import logging
import math
import os
import sys
import subprocess
import json
from pathlib import Path
from io import BytesIO

from dotenv import load_dotenv

# Project root (parent of api/)
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

load_dotenv(PROJECT_ROOT / ".env")

import secrets
from contextlib import asynccontextmanager
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from urllib.parse import urlencode, quote

import httpx
import stripe
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from jose import JWTError, jwt
import bcrypt
#from fastapi import FastAPI

from app.routes.admin_scrapers import router as scraper_router
from api.chat_knowledge import (
    build_chat_system_prompt,
    normalize_chat_reply_links,
    vertex_fallback_reply,
)
from app.database.db import (
    get_user_by_email,
    get_user_by_id,
    get_effective_user_plan,
    create_user,
    get_connection,
    get_user_profile as db_get_user_profile,
    upsert_user_profile as db_upsert_user_profile,
    update_user_skills as db_update_user_skills,
    upsert_user_profile_cv as db_upsert_user_profile_cv,
    get_user_applications as db_get_user_applications,
    create_application as db_create_application,
    update_application as db_update_application,
    delete_application as db_delete_application,
    get_saved_jobs as db_get_saved_jobs,
    save_job as db_save_job,
    unsave_job as db_unsave_job,
    is_job_saved as db_is_job_saved,
    count_saved_jobs_for_user as db_count_saved_jobs_for_user,
    count_company_active_posted_jobs as db_count_company_active_posted_jobs,
    count_company_contact_requests_last_30_days as db_count_company_contact_requests_last_30_days,
    count_company_saved_candidates as db_count_company_saved_candidates,
    get_company_profile as db_get_company_profile,
    upsert_company_profile as db_upsert_company_profile,
    get_saved_candidates as db_get_saved_candidates,
    get_accepted_contact_candidate_ids as db_get_accepted_contact_candidate_ids,
    save_candidate as db_save_candidate,
    unsave_candidate as db_unsave_candidate,
    update_candidate_notes as db_update_candidate_notes,
    get_search_history as db_get_search_history,
    delete_search_history_item as db_delete_search_history_item,
    clear_search_history as db_clear_search_history,
    send_contact_request as db_send_contact_request,
    get_candidate_requests as db_get_candidate_requests,
    get_company_requests as db_get_company_requests,
    update_request_status as db_update_request_status,
    get_contact_request_by_id as db_get_contact_request_by_id,
    create_contact_message as db_create_contact_message,
    get_contact_messages as db_get_contact_messages,
    update_contact_message_status as db_update_contact_message_status,
    get_contact_message_by_id as db_get_contact_message_by_id,
    get_contact_message_thread as db_get_contact_message_thread,
    add_contact_message_reply as db_add_contact_message_reply,
    get_user_contact_messages as db_get_user_contact_messages,
    create_password_reset_token as db_create_password_reset_token,
    get_valid_password_reset_token as db_get_valid_password_reset_token,
    mark_password_reset_used as db_mark_password_reset_used,
    update_user_password as db_update_user_password,
    get_platform_stats as db_get_platform_stats,
    remove_duplicate_jobs as db_remove_duplicate_jobs,
    remove_inactive_or_expired_jobs as db_remove_inactive_or_expired_jobs,
    get_all_users as db_get_all_users,
    get_all_users_total as db_get_all_users_total,
    get_admin_user_counts as db_get_admin_user_counts,
    get_user_by_id as db_get_user_by_id,
    toggle_user_active as db_toggle_user_active,
    make_user_admin as db_make_user_admin,
    get_recent_activity as db_get_recent_activity,
    delete_user_account as db_delete_user_account,
    get_full_user_details as db_get_full_user_details,
    update_user_plan as db_update_user_plan,
    admin_delete_job as db_admin_delete_job,
    admin_get_all_jobs as db_admin_get_all_jobs,
    admin_delete_posted_job as db_admin_delete_posted_job,
    create_platform_announcement as db_create_platform_announcement,
    update_announcement_recipients_count as db_update_announcement_recipients_count,
    get_users_for_announcement as db_get_users_for_announcement,
    get_announcement_recipient_counts as db_get_announcement_recipient_counts,
    get_announcements as db_get_announcements,
    delete_announcement as db_delete_announcement,
    get_plan_config as db_get_plan_config,
    update_plan_config as db_update_plan_config,
    get_admin_analytics as db_get_admin_analytics,
    get_user_subscription as db_get_user_subscription,
    upsert_subscription as db_upsert_subscription,
    cancel_subscription as db_cancel_subscription,
    schedule_subscription_cancellation as db_schedule_subscription_cancellation,
    sync_subscription_from_stripe as db_sync_subscription_from_stripe,
    get_user_id_by_stripe_subscription_id as db_get_user_id_by_stripe_subscription_id,
    get_jobseeker_analytics as db_get_jobseeker_analytics,
    get_company_analytics as db_get_company_analytics,
    get_alert_settings as db_get_alert_settings,
    upsert_alert_settings as db_upsert_alert_settings,
    get_recent_jobs as db_get_recent_jobs,
    search_jobs as db_search_jobs,
    get_job_by_id as db_get_job_by_id,
    get_job_sources as db_get_job_sources,
    get_job_locations as db_get_job_locations,
    get_profile_by_slug as db_get_profile_by_slug,
    ensure_user_has_slug as db_ensure_user_has_slug,
    update_profile_visibility as db_update_profile_visibility,
    create_posted_job as db_create_posted_job,
    get_company_posted_jobs as db_get_company_posted_jobs,
    get_all_posted_jobs as db_get_all_posted_jobs,
    count_all_posted_jobs as db_count_all_posted_jobs,
    get_posted_job_by_id as db_get_posted_job_by_id,
    update_posted_job as db_update_posted_job,
    toggle_job_active as db_toggle_job_active,
    delete_posted_job as db_delete_posted_job,
    has_posted_job_application as db_has_posted_job_application,
    get_posted_job_application_for_user as db_get_posted_job_application_for_user,
    create_posted_job_application as db_create_posted_job_application,
    get_jobseeker_vertex_applications as db_get_jobseeker_vertex_applications,
    get_company_posted_job_applications as db_get_company_posted_job_applications,
    get_posted_job_application_by_id as db_get_posted_job_application_by_id,
    update_posted_job_application_status as db_update_posted_job_application_status,
    withdraw_posted_job_application as db_withdraw_posted_job_application,
    create_notification as db_create_notification,
    get_user_notifications as db_get_user_notifications,
    get_unread_count as db_get_unread_count,
    mark_notification_read as db_mark_notification_read,
    mark_all_notifications_read as db_mark_all_notifications_read,
    delete_notification as db_delete_notification,
    search_jobs_with_company_priority as db_search_jobs_with_company_priority,
    save_user_match_run as db_save_user_match_run,
    get_user_match_run as db_get_user_match_run,
)
from api.email_service import (
    send_welcome_email,
    send_password_reset_email,
    send_contact_request_email,
    send_acceptance_email,
    send_job_alert_email,
    send_support_reply_email,
    send_announcement_email,
    send_direct_email,
    send_new_job_application_email,
    send_application_status_email,
)
from api.job_alerts_scheduler import create_scheduler
from api.skills_gap_service import analyze_job_specific_gap

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# JWT Auth configuration
# ---------------------------------------------------------------------------
SECRET_KEY = os.getenv("SECRET_KEY", "vertex-dev-secret-change-in-prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

BCRYPT_ROUNDS = 12
security = HTTPBearer()
security_optional = HTTPBearer(auto_error=False)

# Google OAuth
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
APP_URL = (os.getenv("APP_URL") or "http://localhost:3000").rstrip("/")
FRONTEND_URL = (os.getenv("FRONTEND_URL") or APP_URL).rstrip("/")
_default_redirect = f"{APP_URL}/api/auth/google/callback"
GOOGLE_REDIRECT_URI = (os.getenv("GOOGLE_REDIRECT_URI") or _default_redirect).rstrip("/")


def _coerce_period_end(value) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.replace(tzinfo=None) if value.tzinfo else value
    if isinstance(value, (int, float)):
        try:
            return datetime.utcfromtimestamp(int(value))
        except (TypeError, ValueError, OSError):
            return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).replace(tzinfo=None)
    except (TypeError, ValueError):
        return None


def _stripe_subscription_period_end(sub) -> Optional[datetime]:
    """Read billing period end from Stripe Subscription (legacy or item-level fields)."""
    if sub is None:
        return None

    def _get(obj, key, default=None):
        try:
            if hasattr(obj, "get"):
                return obj.get(key, default)
            return getattr(obj, key, default)
        except Exception:
            return default

    for key in ("current_period_end", "cancel_at"):
        dt = _coerce_period_end(_get(sub, key))
        if dt is not None:
            return dt

    items = _get(sub, "items")
    data = _get(items, "data") if items is not None else None
    if data:
        for item in data:
            dt = _coerce_period_end(_get(item, "current_period_end"))
            if dt is not None:
                return dt

    return None


# ---------------------------------------------------------------------------
# App + Job alerts scheduler
# ---------------------------------------------------------------------------
scheduler = create_scheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.database.db import (
        init_database,
        ensure_admin_platform_tables,
        ensure_vertex_application_tables,
        ensure_notification_application_types,
        create_archive_tables,
        ensure_expired_application_support,
        ensure_saved_jobs_supports_posted_jobs,
        ensure_user_match_runs_table,
        ensure_subscription_cancel_at_period_end,
    )

    init_database()
    print("Core database tables ready")
    ensure_admin_platform_tables()
    ensure_vertex_application_tables()
    ensure_notification_application_types()
    create_archive_tables()
    ensure_expired_application_support()
    ensure_saved_jobs_supports_posted_jobs()
    ensure_user_match_runs_table()
    ensure_subscription_cancel_at_period_end()
    print("Vertex application tables ready")

    try:
        from app.models.scraper_source import seed_default_scraper_sources

        seeded = seed_default_scraper_sources()
        if seeded:
            print(f"Seeded {seeded} default job board source(s)")
    except Exception as e:
        print(f"Warning: job board source seed failed: {e}")

    # ── Initialize vector tables (creates posted_job_embeddings etc.) ────
    try:
        from app.services.vector_matching_service import VectorSkillMatcher
        _matcher = VectorSkillMatcher()
        _matcher.close()
        print("Vector tables and indexes created")
    except Exception as e:
        print(f"Warning: Vector service init failed: {e}")
    # ─────────────────────────────────────────────────────────────────────

    scheduler.start()
    print("Job alerts scheduler started")
    if GOOGLE_CLIENT_ID:
        print(f"Google OAuth redirect URI: {GOOGLE_REDIRECT_URI}")
    else:
        print("Google OAuth: not configured (GOOGLE_CLIENT_ID missing)")
    sh = os.getenv("SCRAPER_CRON_HOUR", "2")
    sm = os.getenv("SCRAPER_CRON_MINUTE", "0")
    stz = os.getenv("SCHEDULER_TIMEZONE", "Asia/Beirut")
    print(f"Nightly scraper: {sh}:{sm.zfill(2)} {stz} (full ingest to DB)")
    print("Daily alerts: 8:00 AM")
    print("Weekly alerts: Monday 9:00 AM")
    yield
    scheduler.shutdown()
    print("Scheduler stopped")


app = FastAPI(
    title="Vertex API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# include routers AFTER app is created
app.include_router(scraper_router)

# Debug: print registered routes to help troubleshoot 404s
import logging as _logging
_log = _logging.getLogger("uvicorn.error")
_log.info("Registered FastAPI routes:")
for _r in app.routes:
    try:
        _log.info(f"{_r.path}  {getattr(_r, 'methods', '')}")
    except Exception:
        _log.info(str(_r))


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class SkillsRequest(BaseModel):
    skills: List[str]


class JobMatchResponse(BaseModel):
    id: int
    title: str
    company: str
    location: str
    description: Optional[str]
    url: str
    match_score: float
    tags: List[str]
    source: Optional[str] = None


class MatchJobsResponse(BaseModel):
    jobs: List[JobMatchResponse]
    total_matched: int = 0
    upgrade_message: Optional[str] = None
    ran_at: Optional[str] = None


class JobsStatsResponse(BaseModel):
    total_jobs: int
    job_board_count: int = 0
    last_scraped: Optional[str]
    top_categories: List[str]


# ---------------------------------------------------------------------------
# Company Portal & Job Seeker schemas
# ---------------------------------------------------------------------------
class SearchCandidatesRequest(BaseModel):
    required_skills: List[str] = []
    company_name: Optional[str] = None
    top_k: int = 15
    min_keyword_matches: int = 1
    location_filter: Optional[str] = None
    min_experience: Optional[int] = None
    max_experience: Optional[int] = None


class CandidateResponse(BaseModel):
    rank: int
    full_name: str
    email: Optional[str] = None
    email_revealed: bool = False
    skills: List[str]
    matched_skills: List[str]
    keyword_score: float
    profile_boosted: bool = False
    cv_filename: Optional[str] = None
    created_at: Optional[str] = None
    user_id: Optional[int] = None
    profile_slug: Optional[str] = None
    location: Optional[str] = None
    years_experience: Optional[int] = None


class SaveCandidateRequest(BaseModel):
    candidate_user_id: int


class CandidateNotesRequest(BaseModel):
    candidate_user_id: int
    notes: str


class ContactRequestCreate(BaseModel):
    candidate_user_id: int
    message: str


class ContactRequestResponse(BaseModel):
    request_id: int
    status: str


class ContactRequestStatusUpdate(BaseModel):
    status: str  # "accepted" | "declined"


class ContactMessageCreate(BaseModel):
    full_name: str
    email: str
    company: Optional[str] = None
    subject: str
    message: str


class ContactMessageStatusUpdate(BaseModel):
    status: str  # "new" | "in_progress" | "resolved"


class ContactMessageReplyCreate(BaseModel):
    message: str


class SaveProfileRequest(BaseModel):
    email: str
    full_name: Optional[str] = None
    skills: List[str]
    cv_text: Optional[str] = None
    cv_filename: Optional[str] = None


class SaveProfileResponse(BaseModel):
    success: bool
    profile_id: int


# ---------------------------------------------------------------------------
# Auth schemas
# ---------------------------------------------------------------------------
class RegisterRequest(BaseModel):
    email: str
    full_name: str
    password: str
    user_type: str
    company_name: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_type: str
    full_name: str
    user_id: int
    email: str
    is_admin: bool = False
    plan: str = "free"


class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    headline: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    linkedin_url: Optional[str] = None
    years_experience: Optional[int] = None


class ProfileSkillsRequest(BaseModel):
    skills: List[str]


class ApplicationCreate(BaseModel):
    job_title: str
    company: str
    job_url: Optional[str] = None
    location: Optional[str] = None
    status: str = "applied"
    notes: Optional[str] = None


class ApplicationUpdate(BaseModel):
    job_title: Optional[str] = None
    company: Optional[str] = None
    job_url: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


VERTEX_APPLICATION_STATUSES = (
    "applied", "reviewing", "interviewing", "offer", "rejected", "withdrawn"
)


class VertexApplyCreate(BaseModel):
    cover_message: Optional[str] = None


class VertexApplicationStatusUpdate(BaseModel):
    status: str
    company_notes: Optional[str] = None


class CompanyProfileUpdate(BaseModel):
    company_name: str
    website: Optional[str] = None
    industry: Optional[str] = None
    company_size: Optional[str] = None
    description: Optional[str] = None
    contact_name: Optional[str] = None


class CreateCheckoutRequest(BaseModel):
    plan: str  # "pro" or "business"
    billing_cycle: str = "monthly"  # "monthly" or "annually"


class AlertSettingsUpdate(BaseModel):
    is_enabled: bool = True
    frequency: str = "daily"
    min_match_score: int = 70


class ProfileVisibilityUpdate(BaseModel):
    is_public: bool


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]


class PostedJobCreate(BaseModel):
    title: str
    company_name: str
    location: Optional[str] = None
    job_type: str = "full-time"
    experience_level: str = "mid"
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    salary_currency: str = "USD"
    description: str
    requirements: Optional[str] = None
    benefits: Optional[str] = None
    skills_required: Optional[List[str]] = []
    application_url: Optional[str] = None
    application_email: Optional[str] = None
    expires_at: Optional[str] = None


class PostedJobUpdate(BaseModel):
    title: Optional[str] = None
    location: Optional[str] = None
    job_type: Optional[str] = None
    experience_level: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    description: Optional[str] = None
    requirements: Optional[str] = None
    benefits: Optional[str] = None
    skills_required: Optional[List[str]] = None
    application_url: Optional[str] = None
    application_email: Optional[str] = None
    is_active: Optional[bool] = None


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    # bcrypt has a 72 byte limit; pass bytes so length is explicit
    try:
        pwd_bytes = (password if isinstance(password, str) else str(password)).encode("utf-8")[:72]
        hashed = bcrypt.hashpw(pwd_bytes, bcrypt.gensalt(rounds=BCRYPT_ROUNDS))
        return hashed.decode("ascii")
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Password hashing failed: {str(e)}",
        )


def verify_password(plain: str, hashed: str) -> bool:
    pwd_bytes = (plain if isinstance(plain, str) else str(plain)).encode("utf-8")[:72]
    try:
        return bcrypt.checkpw(pwd_bytes, hashed.encode("ascii"))
    except Exception:
        return False


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = get_user_by_id(user_id)
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        user["plan"] = get_effective_user_plan(user_id, user.get("plan"))
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_optional),
) -> Optional[dict]:
    if credentials is None or not getattr(credentials, "credentials", None):
        return None
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        if user_id is None:
            return None
        user = get_user_by_id(int(user_id))
        if user is None:
            return None
        user["plan"] = get_effective_user_plan(user["id"], user.get("plan"))
        return user
    except (JWTError, TypeError, ValueError):
        return None


from api.plan_limits import (
    check_plan_access,
    company_plan_label,
    company_usage_summary,
    max_active_jobs,
    max_contact_requests_30d,
    max_saved_candidates,
    allowed_pipeline_statuses,
    has_job_boost,
    plan_required_for_feature,
    can_company_analytics,
)


def require_plan(current_user: dict, feature: str, upgrade_to: str = "pro") -> None:
    if not check_plan_access(current_user, feature):
        plan = (current_user.get("plan") or "free").strip().lower()
        user_type = (current_user.get("user_type") or "").strip().lower()
        required = upgrade_to
        if user_type == "company" and upgrade_to == "pro":
            required = "growth"
        elif user_type == "company" and upgrade_to == "business":
            required = "business"
        raise HTTPException(
            status_code=403,
            detail={
                "error": "plan_required",
                "message": f"This feature requires a {required.title()} plan",
                "current_plan": plan,
                "required_plan": required,
                "upgrade_url": "/pricing",
            },
        )


async def get_admin_user(
    current_user: dict = Depends(get_current_user),
) -> dict:
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def _maybe_create_welcome_notification(user: dict) -> None:
    """After successful auth: welcome notification for new users (≤10 min) with no unreads."""
    try:
        from datetime import datetime, timedelta

        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            "SELECT created_at FROM users WHERE id = %s",
            (user["id"],),
        )
        row = cur.fetchone()
        cur.close()
        conn.close()

        if not row or row[0] is None:
            return
        created_at = row[0]
        if hasattr(created_at, "tzinfo") and created_at.tzinfo is not None:
            created_at = created_at.replace(tzinfo=None)
        is_new_user = datetime.now() - created_at < timedelta(minutes=10)
        unread = db_get_unread_count(user["id"])

        if unread == 0 and is_new_user:
            profile_link = (
                "/profile" if user["user_type"] == "jobseeker" else "/company/profile"
            )
            db_create_notification(
                user_id=user["id"],
                type="system",
                title="Welcome to Vertex! 🎉",
                message="Your account is ready. Complete your profile to get better matches.",
                link=profile_link,
            )
    except Exception as e:
        print(f"Notification creation error: {e}")


def _generate_fallback_chat_reply(
    messages: List[ChatMessage], user: Optional[dict] = None
) -> str:
    latest_user = ""
    for msg in reversed(messages):
        if (msg.role or "").lower() == "user":
            latest_user = (msg.content or "").strip()
            break

    vertex_reply = vertex_fallback_reply(latest_user, user)
    if vertex_reply:
        return vertex_reply

    if not latest_user:
        return (
            "Tell me your target role for CV tips, or ask how to use Vertex "
            "(try [Pricing](/pricing) or [About](/about))."
        )

    q = latest_user.lower()
    if "cv" in q or "resume" in q:
        return (
            "Great question. Here are practical CV tips:\n"
            "- Tailor your CV to one target role and match key skills from the job post.\n"
            "- Use impact bullets with numbers (e.g., reduced load time by 35%).\n"
            "- Keep sections clear: summary, skills, experience, projects, education.\n"
            "- Upload your CV on [Profile](/profile) to improve Vertex job matches."
        )
    if "interview" in q:
        return (
            "For interviews: prepare 5 STAR stories, review role fundamentals, and "
            "practice concise answers for common behavioral and technical questions."
        )
    if "job" in q or "search" in q:
        return (
            "For job search on Vertex: browse [Vertex Jobs](/jobs) and [Job Boards](/find-jobs), "
            "then use [Matches](/match) (Pro) for AI recommendations. "
            "Track applications on [Tracker](/tracker) (Pro)."
        )
    return (
        "I can help with CV improvement, interview prep, job search strategy, "
        "and how to use Vertex (plans, pages, features). "
        "Ask a specific question or visit [Pricing](/pricing) and [Contact](/contact)."
    )


def _generate_chat_reply(
    messages: List[ChatMessage], user: Optional[dict] = None
) -> str:
    """
    Generate chatbot reply using Hugging Face router first.
    Falls back to local canned logic if API is unavailable.
    """
    hf_token = os.getenv("HF_TOKEN")
    hf_model = os.getenv("HF_CHAT_MODEL") or os.getenv("HF_MODEL") or "openai/gpt-oss-120b:groq"

    if hf_token:
        try:
            from openai import OpenAI

            client = OpenAI(
                base_url="https://router.huggingface.co/v1",
                api_key=hf_token,
            )

            system_prompt = build_chat_system_prompt(user)

            conversation = [{"role": "system", "content": system_prompt}]
            for msg in messages[-12:]:
                role = (msg.role or "user").lower()
                if role not in ("user", "assistant"):
                    role = "user"
                conversation.append({"role": role, "content": msg.content or ""})

            completion = client.chat.completions.create(
                model=hf_model,
                messages=conversation,
                max_tokens=700,
                temperature=0.5,
            )

            if completion.choices and completion.choices[0].message and completion.choices[0].message.content:
                return completion.choices[0].message.content.strip()
        except Exception as e:
            # Keep chat available even when HF is down/misconfigured.
            print(f"[chat] Hugging Face chat fallback: {e}")

    return _generate_fallback_chat_reply(messages, user)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/chat")
def chat_assistant(
    body: ChatRequest,
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    try:
        messages = body.messages or []
        if not messages:
            return {
                "reply": normalize_chat_reply_links(
                    "Ask me about CVs, interviews, job search, or how to use Vertex. "
                    "Try [Pricing](/pricing) or [About](/about) for platform info."
                )
            }
        return {
            "reply": normalize_chat_reply_links(
                _generate_chat_reply(messages, current_user)
            )
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# POST /api/auth/register
# ---------------------------------------------------------------------------
@app.post("/api/auth/register", response_model=TokenResponse)
def auth_register(request: RegisterRequest):
    try:
        if get_user_by_email(request.email) is not None:
            raise HTTPException(status_code=400, detail="Email already registered")
        hashed = hash_password(request.password)
        user_id = create_user(
            request.email,
            request.full_name,
            hashed,
            request.user_type,
        )
        if request.user_type == "jobseeker":
            conn = get_connection()
            cur = conn.cursor()
            try:
                cur.execute(
                    """
                    INSERT INTO job_alert_settings (user_id, is_enabled, frequency, min_match_score)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (user_id) DO NOTHING
                    """,
                    (user_id, True, "daily", 70),
                )
                conn.commit()
            finally:
                cur.close()
                conn.close()
        if request.user_type == "company" and request.company_name:
            conn = get_connection()
            cur = conn.cursor()
            try:
                cur.execute(
                    "INSERT INTO company_profiles (user_id, company_name) VALUES (%s, %s)",
                    (user_id, request.company_name),
                )
                conn.commit()
            finally:
                cur.close()
                conn.close()
        token = create_access_token(
            {"user_id": user_id, "email": request.email, "user_type": request.user_type}
        )
        send_welcome_email(
            request.email,
            request.full_name,
            request.user_type,
        )
        user_row = get_user_by_id(user_id)
        return TokenResponse(
            access_token=token,
            user_type=request.user_type,
            full_name=request.full_name,
            user_id=user_id,
            email=request.email,
            is_admin=bool(user_row.get("is_admin") if user_row else False),
            plan=str((user_row or {}).get("plan") or "free"),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")


# ---------------------------------------------------------------------------
# POST /api/auth/login
# ---------------------------------------------------------------------------
@app.post("/api/auth/login", response_model=TokenResponse)
def auth_login(request: LoginRequest):
    user = get_user_by_email(request.email)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(request.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(
        {
            "user_id": user["id"],
            "email": user["email"],
            "user_type": user["user_type"],
        }
    )
    _maybe_create_welcome_notification(user)
    return TokenResponse(
        access_token=token,
        user_type=user["user_type"],
        full_name=user["full_name"],
        user_id=user["id"],
        email=user["email"],
        is_admin=bool(user.get("is_admin")),
        plan=str(user.get("plan") or "free"),
    )


# ---------------------------------------------------------------------------
# GET /api/auth/google
# ---------------------------------------------------------------------------
@app.get("/api/auth/google")
def auth_google(user_type: str = "jobseeker"):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=503,
            detail="Google OAuth is not configured (GOOGLE_CLIENT_ID missing)",
        )
    scope = [
        "openid",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
    ]
    state = user_type
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(scope),
        "access_type": "offline",
        "prompt": "select_account",
        "state": state,
    }
    url = "https://accounts.google.com/o/oauth2/auth?" + urlencode(params)
    return {"url": url}


# ---------------------------------------------------------------------------
# GET /api/auth/google/callback
# ---------------------------------------------------------------------------
@app.get("/api/auth/google/callback")
async def auth_google_callback(code: Optional[str] = None, state: Optional[str] = None):
    error_redirect = f"{FRONTEND_URL}/auth/login?error=google_failed"
    if not code:
        return RedirectResponse(url=error_redirect)
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        return RedirectResponse(url=error_redirect)
    try:
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": GOOGLE_REDIRECT_URI,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        if token_response.status_code != 200:
            return RedirectResponse(url=error_redirect)
        token_data = token_response.json()
        access_token = token_data.get("access_token")
        if not access_token:
            return RedirectResponse(url=error_redirect)

        async with httpx.AsyncClient() as client:
            user_response = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
        if user_response.status_code != 200:
            return RedirectResponse(url=error_redirect)
        google_user = user_response.json()
        email = google_user.get("email")
        if not email:
            return RedirectResponse(url=error_redirect)
        full_name = google_user.get("name") or email
        user_type = (state or "jobseeker").strip().lower()
        if user_type not in ("jobseeker", "company"):
            user_type = "jobseeker"

        existing = get_user_by_email(email)
        if existing:
            _maybe_create_welcome_notification(existing)
            jwt_token = create_access_token(
                {
                    "user_id": existing["id"],
                    "email": existing["email"],
                    "user_type": existing["user_type"],
                }
            )
            redirect_url = (
                f"{FRONTEND_URL}/auth/callback"
                f"?token={jwt_token}"
                f"&user_type={quote(str(existing['user_type']), safe='')}"
                f"&full_name={quote(str(existing['full_name'] or ''), safe='')}"
                f"&user_id={existing['id']}"
                f"&email={quote(str(existing['email']), safe='')}"
                f"&is_admin={str(bool(existing.get('is_admin', False))).lower()}"
                f"&plan={quote(str(existing.get('plan') or 'free'), safe='')}"
            )
            return RedirectResponse(url=redirect_url)

        random_password = secrets.token_hex(32)
        hashed = hash_password(random_password)
        user_id = create_user(email, full_name, hashed, user_type)
        created_user = get_user_by_id(user_id)
        if created_user:
            _maybe_create_welcome_notification(created_user)
        if user_type == "jobseeker":
            conn = get_connection()
            cur = conn.cursor()
            try:
                cur.execute(
                    """
                    INSERT INTO job_alert_settings (user_id, is_enabled, frequency, min_match_score)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (user_id) DO NOTHING
                    """,
                    (user_id, True, "daily", 70),
                )
                conn.commit()
            finally:
                cur.close()
                conn.close()
        send_welcome_email(email, full_name, user_type)
        jwt_token = create_access_token(
            {"user_id": user_id, "email": email, "user_type": user_type}
        )
        redirect_url = (
            f"{FRONTEND_URL}/auth/callback"
            f"?token={jwt_token}"
            f"&user_type={quote(user_type, safe='')}"
            f"&full_name={quote(full_name, safe='')}"
            f"&user_id={user_id}"
            f"&email={quote(email, safe='')}"
            f"&is_admin={str(bool(created_user.get('is_admin', False)) if created_user else False).lower()}"
            f"&plan={quote(str((created_user or {}).get('plan') or 'free'), safe='')}"
            f"&new_user=true"
        )
        return RedirectResponse(url=redirect_url)
    except Exception:
        return RedirectResponse(url=error_redirect)


# ---------------------------------------------------------------------------
# POST /api/auth/forgot-password
# ---------------------------------------------------------------------------
@app.post("/api/auth/forgot-password")
def auth_forgot_password(request: ForgotPasswordRequest):
    email = request.email.strip()
    user = get_user_by_email(email)
    if user is not None:
        reset_token = secrets.token_urlsafe(32)
        db_create_password_reset_token(user["id"], reset_token)
        sent = send_password_reset_email(
            user["email"],
            user.get("full_name") or "User",
            reset_token,
        )
        if not sent:
            logger.error(
                "Password reset email failed (check RESEND_API_KEY and Resend dashboard). "
                "user_id=%s",
                user["id"],
            )
    return {
        "message": "If this email exists you will receive a reset link shortly",
    }


# ---------------------------------------------------------------------------
# POST /api/auth/reset-password
# ---------------------------------------------------------------------------
@app.post("/api/auth/reset-password")
def auth_reset_password(request: ResetPasswordRequest):
    row = db_get_valid_password_reset_token(request.token)
    if row is None:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired token",
        )
    hashed = hash_password(request.new_password)
    db_update_user_password(row["user_id"], hashed)
    db_mark_password_reset_used(request.token)
    return {
        "success": True,
        "message": "Password reset successfully",
    }


# ---------------------------------------------------------------------------
# GET /api/auth/me
# ---------------------------------------------------------------------------
@app.get("/api/auth/me")
def auth_me(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "full_name": current_user["full_name"],
        "user_type": current_user["user_type"],
        "is_admin": bool(current_user.get("is_admin")),
        "plan": (current_user.get("plan") or "free"),
        "created_at": (
            current_user["created_at"].isoformat()
            if current_user.get("created_at") and hasattr(current_user["created_at"], "isoformat")
            else str(current_user.get("created_at", ""))
        ),
    }


class AdminPlanUpdate(BaseModel):
    plan: str


class AnnouncementRequest(BaseModel):
    title: str
    message: str
    target: str = "all"
    send_email: bool = True
    send_notification: bool = True


class DirectEmailRequest(BaseModel):
    user_id: int
    subject: str
    message: str


class PlatformSettingsUpdate(BaseModel):
    pro_monthly_price: Optional[int] = None
    pro_annual_price: Optional[int] = None
    business_monthly_price: Optional[int] = None
    business_annual_price: Optional[int] = None
    free_job_matches_limit: Optional[int] = None
    free_saved_jobs_limit: Optional[int] = None
    free_job_postings_limit: Optional[int] = None
    growth_job_postings_limit: Optional[int] = None
    growth_saved_candidates_limit: Optional[int] = None
    growth_monthly_price: Optional[int] = None
    growth_annual_price: Optional[int] = None


# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------
@app.get("/api/admin/stats")
def admin_stats(admin_user: dict = Depends(get_admin_user)):
    return db_get_platform_stats()


@app.get("/api/admin/analytics")
def admin_analytics(
    days: int = 30,
    admin_user: dict = Depends(get_admin_user),
):
    clamped = max(7, min(days, 90))
    return db_get_admin_analytics(days=clamped)


@app.get("/api/admin/users")
def admin_users(
    limit: int = 50,
    offset: int = 0,
    search: str = "",
    user_type: str = "",
    status: str = "",
    joined_from: str = "",
    joined_to: str = "",
    admin_user: dict = Depends(get_admin_user),
):
    search_q = search.strip() if search else None
    type_q = user_type.strip().lower() if user_type else None
    if type_q and type_q not in ("jobseeker", "company", "admin"):
        raise HTTPException(status_code=400, detail="Invalid user_type")
    status_q = status.strip().lower() if status else None
    if status_q and status_q not in ("active", "inactive"):
        raise HTTPException(status_code=400, detail="Invalid status")
    from_q = joined_from.strip() if joined_from else None
    to_q = joined_to.strip() if joined_to else None
    users = db_get_all_users(
        limit=limit,
        offset=offset,
        search=search_q,
        user_type=type_q,
        status=status_q,
        joined_from=from_q,
        joined_to=to_q,
    )
    total = db_get_all_users_total(
        search=search_q,
        user_type=type_q,
        status=status_q,
        joined_from=from_q,
        joined_to=to_q,
    )
    return {
        "users": users,
        "total": total,
        "counts": db_get_admin_user_counts(),
    }


@app.put("/api/admin/users/{user_id}/toggle-active")
def admin_toggle_user_active(
    user_id: int,
    admin_user: dict = Depends(get_admin_user),
):
    db_toggle_user_active(user_id)
    return {"success": True}


@app.put("/api/admin/users/{user_id}/make-admin")
def admin_make_user_admin(
    user_id: int,
    admin_user: dict = Depends(get_admin_user),
):
    db_make_user_admin(user_id)
    return {"success": True}


@app.get("/api/admin/users/{user_id}")
def admin_get_user_detail(
    user_id: int,
    admin_user: dict = Depends(get_admin_user),
):
    details = db_get_full_user_details(user_id)
    if not details:
        raise HTTPException(status_code=404, detail="User not found")
    return details


@app.delete("/api/admin/users/{user_id}")
def admin_delete_user(
    user_id: int,
    admin_user: dict = Depends(get_admin_user),
):
    if user_id == admin_user.get("id"):
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    target = db_get_full_user_details(user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.get("is_admin"):
        raise HTTPException(status_code=400, detail="Cannot delete admin accounts")
    if not db_delete_user_account(user_id):
        raise HTTPException(status_code=400, detail="User could not be deleted")
    return {"success": True, "message": "User deleted"}


@app.put("/api/admin/users/{user_id}/plan")
def admin_update_user_plan(
    user_id: int,
    body: AdminPlanUpdate,
    admin_user: dict = Depends(get_admin_user),
):
    plan = (body.plan or "").strip().lower()
    if plan not in ("free", "pro", "business"):
        raise HTTPException(status_code=400, detail="Invalid plan")
    if not db_get_user_by_id(user_id):
        raise HTTPException(status_code=404, detail="User not found")
    if not db_update_user_plan(user_id, plan):
        raise HTTPException(status_code=500, detail="Failed to update plan")
    db_create_notification(
        user_id=user_id,
        type="system",
        title="Your plan has been updated",
        message=f"Your plan has been changed to {plan}",
        link="/settings/billing",
    )
    return {"success": True}


@app.get("/api/admin/jobs")
def admin_list_jobs(
    limit: int = 50,
    offset: int = 0,
    search: str = "",
    source: str = "",
    listing_type: str = "all",
    admin_user: dict = Depends(get_admin_user),
):
    lt = (listing_type or "all").strip().lower()
    if lt not in ("all", "job_boards", "vertex"):
        raise HTTPException(status_code=400, detail="Invalid listing_type")
    return db_admin_get_all_jobs(
        limit=limit,
        offset=offset,
        search=search if search else None,
        source=source if source else None,
        listing_type=lt,
    )


@app.delete("/api/admin/jobs/{job_id}")
def admin_remove_job(
    job_id: int,
    admin_user: dict = Depends(get_admin_user),
):
    if not db_admin_delete_job(job_id):
        raise HTTPException(status_code=404, detail="Job not found")
    return {"success": True}


@app.delete("/api/admin/jobs/posted/{job_id}")
def admin_remove_posted_job(
    job_id: int,
    admin_user: dict = Depends(get_admin_user),
):
    if not db_admin_delete_posted_job(job_id):
        raise HTTPException(status_code=404, detail="Posted job not found")
    return {"success": True}


def _send_announcement_emails(recipients: list, title: str, message: str) -> None:
    for r in recipients:
        try:
            send_announcement_email(
                r["email"],
                r.get("full_name") or r["email"],
                title,
                message,
            )
        except Exception:
            logger.exception("announcement email failed for %s", r.get("email"))


@app.post("/api/admin/announcements")
def admin_create_announcement(
    body: AnnouncementRequest,
    background_tasks: BackgroundTasks,
    admin_user: dict = Depends(get_admin_user),
):
    title = (body.title or "").strip()
    message = (body.message or "").strip()
    target = (body.target or "all").strip().lower()
    if not title:
        raise HTTPException(status_code=400, detail="Title is required")
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")
    if target not in ("all", "jobseekers", "companies"):
        raise HTTPException(status_code=400, detail="Invalid target")
    recipients = db_get_users_for_announcement(target)
    ann_id = db_create_platform_announcement(
        title, message, target, admin_user["id"]
    )
    if body.send_notification:
        snippet = message[:200]
        for r in recipients:
            try:
                db_create_notification(
                    user_id=r["id"],
                    type="system",
                    title=title,
                    message=snippet,
                    link="/",
                    announcement_id=ann_id,
                )
            except Exception:
                logger.exception("announcement notification failed")
    if body.send_email and recipients:
        background_tasks.add_task(
            _send_announcement_emails, recipients, title, message
        )
    db_update_announcement_recipients_count(ann_id, len(recipients))
    return {
        "success": True,
        "recipients_count": len(recipients),
        "message": f"Announcement sent to {len(recipients)} users",
    }


@app.get("/api/admin/announcements/recipient-counts")
def admin_announcement_recipient_counts(
    admin_user: dict = Depends(get_admin_user),
):
    return db_get_announcement_recipient_counts()


@app.get("/api/admin/announcements")
def admin_list_announcements(admin_user: dict = Depends(get_admin_user)):
    return db_get_announcements(limit=20)


@app.delete("/api/admin/announcements/{announcement_id}")
def admin_delete_announcement(
    announcement_id: int,
    admin_user: dict = Depends(get_admin_user),
):
    if not db_delete_announcement(announcement_id):
        raise HTTPException(status_code=404, detail="Announcement not found")
    return {"success": True}


@app.post("/api/admin/send-email")
def admin_send_direct_email(
    body: DirectEmailRequest,
    admin_user: dict = Depends(get_admin_user),
):
    user = db_get_user_by_id(body.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    subject = (body.subject or "").strip()
    message = (body.message or "").strip()
    if not subject or not message:
        raise HTTPException(status_code=400, detail="Subject and message are required")
    ok = send_direct_email(
        user["email"],
        user.get("full_name") or user["email"],
        subject,
        message,
    )
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to send email")
    return {"success": True}


@app.get("/api/admin/settings")
def admin_get_settings(admin_user: dict = Depends(get_admin_user)):
    return db_get_plan_config()


@app.put("/api/admin/settings")
def admin_put_settings(
    body: PlatformSettingsUpdate,
    admin_user: dict = Depends(get_admin_user),
):
    data = body.model_dump(exclude_unset=True)
    for key, val in data.items():
        if val is None or (isinstance(val, (int, float)) and val < 0):
            raise HTTPException(status_code=400, detail=f"Invalid value for {key}")
    if not db_update_plan_config(data):
        raise HTTPException(status_code=500, detail="Failed to save settings")
    return {"success": True}


@app.get("/api/admin/activity")
def admin_activity(
    limit: int = 10,
    admin_user: dict = Depends(get_admin_user),
):
    clamped = max(5, min(limit, 10))
    return db_get_recent_activity(limit=clamped)


@app.post("/api/admin/scraper/run")
def admin_scraper_run(
    background_tasks: BackgroundTasks,
    admin_user: dict = Depends(get_admin_user),
):
    status_file = PROJECT_ROOT / "logs" / "scraper_status.json"
    if status_file.exists():
        try:
            with status_file.open("r", encoding="utf-8") as f:
                current = json.load(f)
            if bool(current.get("running")):
                return {"message": "Scraper is already running", "status": "running"}
        except Exception:
            pass
    background_tasks.add_task(_run_scraper)
    return {"message": "Scraper started", "status": "started"}


@app.post("/api/admin/cleanup-duplicates")
def admin_cleanup_duplicates(admin_user: dict = Depends(get_admin_user)):
    deleted = db_remove_duplicate_jobs()
    return {"deleted": deleted, "success": True}


@app.post("/api/admin/cleanup-inactive-jobs")
def admin_cleanup_inactive_jobs(admin_user: dict = Depends(get_admin_user)):
    result = db_remove_inactive_or_expired_jobs()
    return {"success": True, **result}


@app.get("/api/admin/scraper/last-run")
def admin_scraper_last_run(admin_user: dict = Depends(get_admin_user)):
    """Return best-known scraper run timestamp (DB or runner status file)."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT MAX(scraped_at) FROM jobs")
        row = cur.fetchone()
        db_ts = row[0] if row else None
        db_iso = db_ts.isoformat() if db_ts and hasattr(db_ts, "isoformat") else (str(db_ts) if db_ts else None)

        status_file = PROJECT_ROOT / "logs" / "scraper_status.json"
        status = {}
        if status_file.exists():
            try:
                with status_file.open("r", encoding="utf-8") as f:
                    status = json.load(f)
            except Exception:
                status = {}

        status_iso = status.get("last_finished_at") or status.get("last_started_at")
        return {
            "last_run": status_iso or db_iso,
            "job_data_last_run": db_iso,
            "running": bool(status.get("running", False)),
            "last_exit_code": status.get("last_exit_code"),
            "last_error": status.get("last_error"),
        }
    finally:
        cur.close()
        conn.close()


@app.get("/api/admin/health")
def admin_health(admin_user: dict = Depends(get_admin_user)):
    """Return admin health summary for dashboard indicators."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT MAX(scraped_at), COUNT(*) FROM jobs")
        row = cur.fetchone() or (None, 0)
        last_run = row[0]
        total_jobs = int(row[1] or 0)
        db_iso = (
            last_run.isoformat() if last_run and hasattr(last_run, "isoformat") else (str(last_run) if last_run else None)
        )

        status_file = PROJECT_ROOT / "logs" / "scraper_status.json"
        status = {}
        if status_file.exists():
            try:
                with status_file.open("r", encoding="utf-8") as f:
                    status = json.load(f)
            except Exception:
                status = {}
        status_iso = status.get("last_finished_at") or status.get("last_started_at")
        return {
            "database": True,
            "email_configured": bool(os.getenv("RESEND_API_KEY")),
            "last_scraper_run": status_iso or db_iso,
            "last_scraper_db_update": db_iso,
            "scraper_running": bool(status.get("running", False)),
            "scraper_last_exit_code": status.get("last_exit_code"),
            "scraper_last_error": status.get("last_error"),
            "total_jobs": total_jobs,
        }
    finally:
        cur.close()
        conn.close()


def _extract_skills_from_cv_bytes(content: bytes, filename: str = "") -> Tuple[List[str], bool]:
    """
    Extract skills from raw CV bytes (same pipeline as /api/upload-cv).
    Returns (skills, used_fallback).
    """
    from app.utils.cv_utils import ALLOWED_CV_LABEL, extract_text_from_cv_bytes, is_allowed_cv_filename
    from app.services.skill_extraction_service import (
        call_huggingface_api,
        parse_skills_from_response,
        merge_skills_from_api_and_fallback,
    )

    if filename and not is_allowed_cv_filename(filename):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported CV format. Allowed: {ALLOWED_CV_LABEL}.",
        )

    cv_text = extract_text_from_cv_bytes(content, filename)
    if not cv_text or not cv_text.strip():
        raise HTTPException(
            status_code=422,
            detail=(
                f"Could not extract text from this CV. "
                f"Use {ALLOWED_CV_LABEL} with selectable text (not a scan-only image)."
            ),
        )
    model_name = os.getenv("HF_MODEL")
    skills: List[str] = []
    used_fallback = False
    try:
        api_response = call_huggingface_api(cv_text=cv_text, model_name=model_name)
        if api_response:
            skills = parse_skills_from_response(api_response)
    except Exception:
        used_fallback = True
    pre_merge = len(skills)
    skills = merge_skills_from_api_and_fallback(cv_text, skills)
    if pre_merge == 0 and skills:
        used_fallback = True
    if not skills:
        raise HTTPException(
            status_code=502,
            detail=(
                "Could not extract any skills from this CV. "
                "Use a file with selectable text, set HF_TOKEN for AI extraction, "
                "or add skills manually."
            ),
        )
    return skills, used_fallback


def _normalize_match_score(raw_percentage: float) -> float:
    """Rescale raw hybrid similarity to the same display score used on the match page."""
    r = max(0.0, min(1.0, float(raw_percentage) / 100.0))
    return round(45.0 + math.sqrt(r) * 50.0, 1)


def _normalize_matching_job(j: dict) -> JobMatchResponse:
    raw = j.get("match_percentage") or (j.get("similarity_score", 0) * 100)
    score = _normalize_match_score(raw)
    tags = []
    st = j.get("skills_text") or ""
    if st:
        tags = [t.strip() for t in st.split(",") if t.strip()][:15]
    return JobMatchResponse(
        id=j.get("job_id", 0),
        title=j.get("title") or "",
        company=j.get("company") or "",
        location=j.get("location") or "Remote",
        description=(j.get("description") or "")[:2000] or None,
        url=j.get("url") or "",
        match_score=score,
        tags=tags,
        source=j.get("source"),
    )

def _match_jobs_from_skills(skills: List[str]) -> List[JobMatchResponse]:
    skills = [s for s in (skills or []) if s and str(s).strip()]
    if not skills:
        return []
    from app.services.vector_matching_service import VectorSkillMatcher

    matcher = VectorSkillMatcher()
    try:
        jobs = matcher.find_matching_jobs_hybrid(
            cv_skills=skills,
            top_k=50,
            vector_weight=0.6,
            keyword_weight=0.4,
        )
    finally:
        matcher.close()
    normalized = [_normalize_matching_job(j) for j in jobs]
    return normalized


def _apply_match_plan_gating(
    full: List[JobMatchResponse],
    current_user: Optional[dict],
) -> MatchJobsResponse:
    total = len(full)
    if current_user is not None and check_plan_access(current_user, "view_matches"):
        return MatchJobsResponse(jobs=full, total_matched=total, upgrade_message=None)
    if current_user is None:
        upgrade_message = (
            "Sign up free to preview your top 3 matches"
            if total > 0
            else None
        )
        return MatchJobsResponse(jobs=[], total_matched=total, upgrade_message=upgrade_message)
    upgrade_message = "Upgrade to Pro to see all matches" if total > 3 else None
    return MatchJobsResponse(jobs=full[:3], total_matched=total, upgrade_message=upgrade_message)


def _jobs_from_stored(stored: list) -> List[JobMatchResponse]:
    jobs: List[JobMatchResponse] = []
    for item in stored or []:
        if not isinstance(item, dict):
            continue
        try:
            jobs.append(JobMatchResponse(**item))
        except Exception:
            continue
    return jobs


# ---------------------------------------------------------------------------
# POST /api/upload-cv
# ---------------------------------------------------------------------------
@app.post("/api/upload-cv")
async def upload_cv(file: UploadFile = File(...)):
    from app.utils.cv_utils import ALLOWED_CV_LABEL, is_allowed_cv_filename

    if not file.filename or not is_allowed_cv_filename(file.filename):
        raise HTTPException(status_code=400, detail=f"CV file required ({ALLOWED_CV_LABEL})")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")
    try:
        skills, used_fallback = _extract_skills_from_cv_bytes(content, file.filename)
        return {"skills": skills, "fallback": used_fallback}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# POST /api/match-jobs
# ---------------------------------------------------------------------------
@app.post("/api/match-jobs", response_model=MatchJobsResponse)
async def match_jobs(
    request: Request,
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    """
    Match jobs from skills or from a CV file.
    - JSON body: { \"skills\": [\"Python\", \"React\"] } — skips extraction, runs matching only.
    - multipart/form-data: field \"cv\" — extracts skills then matches.
    Guests receive match count only (no job cards). Free jobseekers see up to 3 matches;
    Pro/Business see all (within top_k).
    """
    ct = (request.headers.get("content-type") or "").lower()
    skills: List[str] = []

    if "multipart/form-data" in ct:
        form = await request.form()
        file_item = form.get("cv")
        if file_item is None:
            file_item = form.get("file")
        if file_item is None or not hasattr(file_item, "read"):
            raise HTTPException(
                status_code=400,
                detail='Multipart requests must include a CV field named "cv" (or "file").',
            )
        uf = file_item
        filename = getattr(uf, "filename", None) or ""
        from app.utils.cv_utils import ALLOWED_CV_LABEL, is_allowed_cv_filename

        if not is_allowed_cv_filename(str(filename)):
            raise HTTPException(status_code=400, detail=f"CV file required ({ALLOWED_CV_LABEL})")
        content = await uf.read()
        if not content:
            raise HTTPException(status_code=400, detail="Empty file")
        try:
            skills, _ = _extract_skills_from_cv_bytes(content, str(filename))
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    else:
        try:
            body = await request.json()
        except Exception:
            raise HTTPException(status_code=400, detail="Expected JSON body with a \"skills\" array or multipart CV file.")
        if not isinstance(body, dict):
            raise HTTPException(status_code=400, detail="Invalid JSON body")
        raw = body.get("skills")
        if raw is None:
            raise HTTPException(status_code=400, detail='JSON body must include a "skills" array.')
        if not isinstance(raw, list):
            raise HTTPException(status_code=400, detail='"skills" must be an array of strings.')
        skills = [str(s).strip() for s in raw if s is not None and str(s).strip()]

    try:
        full = _match_jobs_from_skills(skills)
        if current_user is not None:
            db_save_user_match_run(
                user_id=current_user["id"],
                skills=skills,
                total_matched=len(full),
                jobs=[job.model_dump() for job in full],
            )
            stored = db_get_user_match_run(current_user["id"])
            response = _apply_match_plan_gating(full, current_user)
            if stored:
                response.ran_at = stored.get("ran_at")
            return response
        return _apply_match_plan_gating(full, current_user)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/match-jobs/last", response_model=MatchJobsResponse)
def get_last_match_jobs(current_user: dict = Depends(get_current_user)):
    """Return the user's most recent match run, with plan gating applied."""
    stored = db_get_user_match_run(current_user["id"])
    if not stored:
        return MatchJobsResponse(jobs=[], total_matched=0, upgrade_message=None, ran_at=None)
    full = _jobs_from_stored(stored.get("jobs") or [])
    response = _apply_match_plan_gating(full, current_user)
    response.ran_at = stored.get("ran_at")
    return response


# ---------------------------------------------------------------------------
# POST /api/skills-gap/analyze
# ---------------------------------------------------------------------------
@app.post("/api/skills-gap/analyze")
def skills_gap_analyze(current_user: dict = Depends(get_current_user)):
    """Pro/Business jobseeker: skills gap analysis (placeholder until ML pipeline is wired)."""
    if current_user.get("user_type") != "jobseeker":
        raise HTTPException(status_code=403, detail="Job seeker access only")
    require_plan(current_user, "skills_gap")
    return {
        "skills_to_learn": [],
        "matched_roles": [],
        "message": "Skills gap analysis is available on your plan. Detailed breakdowns will appear here.",
    }


@app.post("/api/skills-gap/analyze-job/{job_id}")
def skills_gap_analyze_job(job_id: int, current_user: dict = Depends(get_current_user)):
    """Analyze skill gap for a specific scraped job using profile skills."""
    if current_user.get("user_type") != "jobseeker":
        raise HTTPException(status_code=403, detail="Job seeker access only")
    require_plan(current_user, "skills_gap")

    job = db_get_job_by_id(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    profile = db_get_user_profile(current_user["id"])
    user_skills = profile.get("skills") if profile else []
    user_skills = [str(s).strip() for s in (user_skills or []) if str(s).strip()]
    if not user_skills:
        raise HTTPException(status_code=400, detail="Please add skills to your profile first")

    try:
        from app.services.vector_matching_service import VectorSkillMatcher

        matcher = VectorSkillMatcher()
        try:
            raw_match_pct = matcher.score_job_hybrid(
                cv_skills=user_skills,
                job_id=job_id,
                vector_weight=0.6,
                keyword_weight=0.4,
            )
        finally:
            matcher.close()

        analysis = analyze_job_specific_gap(
            user_skills=user_skills,
            job_title=job.get("job_title") or "",
            job_description=job.get("description") or "",
            job_requirements="",
        )
        if raw_match_pct is not None:
            analysis["match_percentage"] = _normalize_match_score(raw_match_pct)
        return analysis
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Skills gap analysis failed: {str(e)}")


# ---------------------------------------------------------------------------
# GET /api/jobs/stats
# ---------------------------------------------------------------------------
@app.get("/api/jobs/stats", response_model=JobsStatsResponse)
def jobs_stats():
    try:
        from app.database.db import count_available_jobs, get_connection
        from app.models.scraper_source import (
            count_scraper_sources,
            seed_default_scraper_sources,
        )

        if count_scraper_sources(active_only=False) == 0:
            seed_default_scraper_sources()
        job_board_count = count_scraper_sources(active_only=True)

        total = count_available_jobs()
        conn = get_connection()
        cur = conn.cursor()
        try:
            cur.execute("SELECT MAX(scraped_at) FROM jobs")
            row = cur.fetchone()
            last_scraped = None
            if row and row[0]:
                last_scraped = row[0].isoformat() if hasattr(row[0], "isoformat") else str(row[0])
            cur.execute(
                """
                SELECT source FROM jobs WHERE is_active = TRUE
                GROUP BY source ORDER BY COUNT(*) DESC LIMIT 5
                """
            )
            top_categories = [r[0] for r in cur.fetchall()]
        finally:
            cur.close()
            conn.close()
        return JobsStatsResponse(
            total_jobs=total,
            job_board_count=job_board_count,
            last_scraped=last_scraped,
            top_categories=top_categories,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# GET /api/jobs/search
# ---------------------------------------------------------------------------

@app.get("/api/jobs/search")
def jobs_search(
    q: Optional[str] = None,
    source: Optional[str] = None,
    location: Optional[str] = None,
    job_type: Optional[str] = None,
    date_posted: Optional[str] = None,
    sort_by: str = "recent",
    limit: int = 20,
    offset: int = 0,
):
    """
    Search external job-board listings only (scraped jobs table).
    Vertex-posted jobs are served by /api/jobs/posted.
    """
    import math
    try:
        jobs_list, total = db_search_jobs(
            q=q,
            source=source,
            location=location,
            date_posted=date_posted,
            sort_by=sort_by if sort_by in ("recent", "relevant") else "recent",
            limit=min(limit, 100),
            offset=offset,
        )
        page = (offset // limit) + 1 if limit else 1
        total_pages = math.ceil(total / limit) if limit else 0
        return {
            "jobs": jobs_list,
            "total": total,
            "page": page,
            "total_pages": total_pages,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
# ---------------------------------------------------------------------------
# GET /api/jobs/sources
# ---------------------------------------------------------------------------
@app.get("/api/jobs/sources")
def jobs_sources():
    """Distinct job board sources. No auth required."""
    try:
        return db_get_job_sources()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# GET /api/jobs/locations
# ---------------------------------------------------------------------------
@app.get("/api/jobs/locations")
def jobs_locations():
    """Distinct job locations (limit 50). No auth required."""
    try:
        return db_get_job_locations(50)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# GET /api/jobs/posted
# ---------------------------------------------------------------------------
@app.get("/api/jobs/posted")
def get_posted_jobs(
    limit: int = 20,
    offset: int = 0,
    job_type: Optional[str] = None,
    experience_level: Optional[str] = None,
    search: Optional[str] = None,
):
    """List active, non-expired posted jobs with total count for pagination. No auth required."""
    import math

    try:
        limit = min(max(limit, 1), 100)
        offset = max(offset, 0)
        jobs_list = db_get_all_posted_jobs(
            limit=limit,
            offset=offset,
            job_type=job_type,
            experience_level=experience_level,
            search=search,
        )
        total = db_count_all_posted_jobs(
            job_type=job_type,
            experience_level=experience_level,
            search=search,
        )
        page = (offset // limit) + 1 if limit else 1
        total_pages = math.ceil(total / limit) if limit else 0
        return {
            "jobs": jobs_list,
            "total": total,
            "page": page,
            "total_pages": total_pages,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# GET /api/jobs/posted/{job_id}
# ---------------------------------------------------------------------------
@app.get("/api/jobs/posted/{job_id}")
def get_posted_job(job_id: int):
    """Get single posted job by id; increments view count. No auth required."""
    job = db_get_posted_job_by_id(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


# ---------------------------------------------------------------------------
# Vertex job applications (posted jobs only)
# ---------------------------------------------------------------------------
@app.get("/api/jobs/posted/{job_id}/apply-status")
def get_vertex_apply_status(
    job_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Whether the current job seeker has applied to this Vertex job."""
    if current_user.get("user_type") != "jobseeker":
        return {"applied": False, "application": None}
    app = db_get_posted_job_application_for_user(job_id, current_user["id"])
    if not app:
        return {"applied": False, "application": None}
    return {"applied": app.get("status") != "withdrawn", "application": app}


@app.post("/api/jobs/posted/{job_id}/apply")
def apply_to_vertex_job(
    job_id: int,
    body: VertexApplyCreate,
    current_user: dict = Depends(get_current_user),
):
    """Apply to a Vertex posted job with profile snapshot."""
    if current_user.get("user_type") != "jobseeker":
        raise HTTPException(status_code=403, detail="Job seeker access only")
    job = db_get_posted_job_by_id(job_id)
    if not job or not job.get("is_active"):
        raise HTTPException(status_code=404, detail="Job not found or not accepting applications")
    if job.get("expires_at"):
        try:
            from datetime import datetime

            exp = job["expires_at"]
            if isinstance(exp, str):
                exp = datetime.fromisoformat(exp.replace("Z", "+00:00"))
            if exp and exp < datetime.utcnow():
                raise HTTPException(status_code=400, detail="This job posting has expired")
        except HTTPException:
            raise
        except Exception:
            pass
    if db_has_posted_job_application(job_id, current_user["id"]):
        existing = db_get_posted_job_application_for_user(job_id, current_user["id"])
        if existing and existing.get("status") == "withdrawn":
            raise HTTPException(
                status_code=400,
                detail="You previously withdrew this application. Contact the company to re-apply.",
            )
        raise HTTPException(status_code=409, detail="You have already applied to this job")
    profile = db_get_user_profile(current_user["id"]) or {}
    if not profile.get("cv_filename"):
        raise HTTPException(
            status_code=400,
            detail="Upload your CV on your profile before applying on Vertex",
        )
    app_data = {
        "cover_message": body.cover_message,
        "applicant_name": profile.get("full_name") or current_user.get("full_name") or "",
        "applicant_email": current_user.get("email") or profile.get("email") or "",
        "headline": profile.get("headline"),
        "location": profile.get("location"),
        "years_experience": profile.get("years_experience") or 0,
        "skills": profile.get("skills") or [],
        "cv_filename": profile.get("cv_filename"),
        "profile_slug": profile.get("profile_slug"),
    }
    if not app_data["applicant_name"] or not app_data["applicant_email"]:
        raise HTTPException(status_code=400, detail="Complete your profile before applying")
    new_id = db_create_posted_job_application(job_id, current_user["id"], app_data)
    job_title = job.get("title") or "the role"
    company_name = job.get("company_name") or "the company"
    try:
        db_create_notification(
            user_id=current_user["id"],
            type="application_status",
            title="Application submitted",
            message=f"You applied to {job_title} at {company_name}. Track updates in your Application Tracker.",
            link="/tracker",
        )
    except Exception:
        pass
    company_user = db_get_user_by_id(job["company_user_id"])
    if company_user:
        try:
            db_create_notification(
                user_id=company_user["id"],
                type="job_application",
                title="New job application",
                message=f'{app_data["applicant_name"]} applied to {job_title}',
                link=f"/company/jobs/{job_id}/applicants",
            )
        except Exception:
            pass
        try:
            send_new_job_application_email(
                to_email=company_user["email"],
                company_name=company_name,
                job_title=job_title,
                candidate_name=app_data["applicant_name"],
                applicants_url=f'{os.getenv("APP_URL", "http://localhost:3000")}/company/jobs/{job_id}/applicants',
            )
        except Exception:
            pass
    # Also add to personal tracker if Pro (best-effort)
    try:
        if check_plan_access(current_user, "application_tracker"):
            db_create_application(
                current_user["id"],
                {
                    "job_title": job.get("title") or "",
                    "company": job.get("company_name") or "",
                    "job_url": f'/jobs/{job_id}',
                    "location": job.get("location"),
                    "status": "applied",
                    "notes": "Applied on Vertex",
                },
            )
    except Exception:
        pass
    return {"id": new_id, "success": True, "status": "applied"}


@app.get("/api/my-vertex-applications")
def get_my_vertex_applications(current_user: dict = Depends(get_current_user)):
    """Job seeker's applications to Vertex posted jobs."""
    if current_user.get("user_type") != "jobseeker":
        raise HTTPException(status_code=403, detail="Job seeker access only")
    return db_get_jobseeker_vertex_applications(current_user["id"])


@app.post("/api/my-vertex-applications/{application_id}/withdraw")
def withdraw_vertex_application(
    application_id: int,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("user_type") != "jobseeker":
        raise HTTPException(status_code=403, detail="Job seeker access only")
    app_before = db_get_posted_job_application_by_id(application_id)
    if (
        not app_before
        or app_before.get("jobseeker_user_id") != current_user["id"]
        or app_before.get("status") == "withdrawn"
    ):
        raise HTTPException(status_code=404, detail="Application not found")
    if not db_withdraw_posted_job_application(application_id, current_user["id"]):
        raise HTTPException(status_code=404, detail="Application not found")
    company_user = db_get_user_by_id(app_before.get("company_user_id"))
    if company_user:
        job_title = app_before.get("job_title") or "the role"
        applicant = app_before.get("applicant_name") or current_user.get("full_name") or "A candidate"
        posted_job_id = app_before.get("posted_job_id")
        try:
            db_create_notification(
                user_id=company_user["id"],
                type="job_application",
                title="Application withdrawn",
                message=f"{applicant} withdrew their application for {job_title}.",
                link=f"/company/jobs/{posted_job_id}/applicants",
            )
        except Exception:
            pass
    return {"success": True}


@app.get("/api/company/applications")
def company_list_applications(
    posted_job_id: Optional[int] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("user_type") != "company":
        raise HTTPException(status_code=403, detail="Company access only")
    if status and status not in VERTEX_APPLICATION_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status filter")
    return db_get_company_posted_job_applications(
        current_user["id"], posted_job_id=posted_job_id, status=status
    )


@app.get("/api/company/applications/{application_id}")
def company_get_application(
    application_id: int,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("user_type") != "company":
        raise HTTPException(status_code=403, detail="Company access only")
    app = db_get_posted_job_application_by_id(application_id, current_user["id"])
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return app


@app.patch("/api/company/applications/{application_id}")
def company_update_application(
    application_id: int,
    body: VertexApplicationStatusUpdate,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("user_type") != "company":
        raise HTTPException(status_code=403, detail="Company access only")
    status = (body.status or "").strip().lower()
    if status not in VERTEX_APPLICATION_STATUSES or status == "withdrawn":
        raise HTTPException(status_code=400, detail="Invalid status")
    allowed = allowed_pipeline_statuses(current_user)
    if status not in allowed:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "plan_required",
                "message": "Upgrade to Growth for the full hiring pipeline (Reviewing, Interview, Offer).",
                "current_plan": (current_user.get("plan") or "free"),
                "required_plan": "growth",
                "upgrade_url": "/pricing",
            },
        )
    app_before = db_get_posted_job_application_by_id(application_id, current_user["id"])
    if not app_before:
        raise HTTPException(status_code=404, detail="Application not found")
    prev_status = (app_before.get("status") or "").strip().lower()
    notes_value = body.company_notes
    if notes_value is not None:
        notes_value = (notes_value or "").strip() or None

    if not db_update_posted_job_application_status(
        application_id,
        current_user["id"],
        status,
        company_notes=notes_value,
    ):
        raise HTTPException(status_code=404, detail="Application not found")

    status_changed = prev_status != status
    seeker = db_get_user_by_id(app_before["jobseeker_user_id"])
    notify_statuses = ("reviewing", "interviewing", "offer", "rejected")
    if seeker and status_changed and status in notify_statuses:
        labels = {
            "reviewing": "Under review",
            "interviewing": "Interviewing",
            "offer": "Offer received",
            "rejected": "Not selected",
        }
        status_label = labels.get(status, status)
        job_title = app_before.get("job_title") or "the role"
        company_name = app_before.get("company_name") or "the company"
        tracker_url = f'{os.getenv("APP_URL", "http://localhost:3000")}/tracker'
        message = (
            f"Your application for {job_title} at {company_name} "
            f"is now: {status_label}."
        )
        if notes_value:
            preview = notes_value if len(notes_value) <= 120 else notes_value[:117] + "..."
            message += f" {preview}"
        try:
            db_create_notification(
                user_id=seeker["id"],
                type="application_status",
                title="Application status updated",
                message=message,
                link="/tracker",
            )
        except Exception:
            pass
        try:
            send_application_status_email(
                to_email=seeker["email"],
                candidate_name=app_before.get("applicant_name") or seeker.get("full_name") or "",
                job_title=job_title,
                company_name=company_name,
                status_label=status_label,
                applications_url=tracker_url,
                details=notes_value,
            )
        except Exception:
            pass
    return {"success": True, "status": status}


# ---------------------------------------------------------------------------
# GET /api/jobs/{job_id}
# ---------------------------------------------------------------------------
@app.get("/api/jobs/{job_id}")
def get_job(job_id: int):
    """Get single scraped job by id. No auth required."""
    job = db_get_job_by_id(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


# ---------------------------------------------------------------------------
# POST /api/jobs/posted
# ---------------------------------------------------------------------------
@app.post("/api/jobs/posted")
def post_posted_job(
    body: PostedJobCreate,
    current_user: dict = Depends(get_current_user),
):
    """Create a posted job. Company only."""
    if current_user.get("user_type") != "company":
        raise HTTPException(status_code=403, detail="Company access only")
    title = (body.title or "").strip()
    description = (body.description or "").strip()
    if not title or not description:
        raise HTTPException(status_code=400, detail="Title and description are required")
    profile = db_get_company_profile(current_user["id"])
    company_name = (profile.get("company_name") or "").strip() if profile else ""
    if not company_name:
        company_name = (body.company_name or "").strip()
    if not company_name:
        raise HTTPException(status_code=400, detail="Company name is required")
    active_ct = db_count_company_active_posted_jobs(current_user["id"])
    job_limit = max_active_jobs(current_user)
    if job_limit is not None and active_ct >= job_limit:
        plan = (current_user.get("plan") or "free").strip().lower()
        required = "growth" if plan == "free" else "business"
        limit_label = job_limit
        raise HTTPException(
            status_code=403,
            detail={
                "error": "plan_required",
                "message": (
                    f"Your plan allows {limit_label} active job posting(s). "
                    f"Upgrade to {required.title()} for more."
                ),
                "current_plan": plan,
                "required_plan": required,
                "upgrade_url": "/pricing",
            },
        )
    data = body.model_dump()
    data["company_name"] = company_name
    if has_job_boost(current_user):
        data["is_featured"] = True
    try:
        new_job_id = db_create_posted_job(current_user["id"], data)

        # ── Auto-generate embedding so this job appears in CV matching ──────
        try:
            from app.services.vector_matching_service import VectorSkillMatcher
            matcher = VectorSkillMatcher()
            try:
                matcher.embed_posted_job(
                    posted_job_id=new_job_id,
                    title=title,
                    company=company_name,
                    location=(body.location or ""),
                    description=description,
                    skills=list(body.skills_required or []),
                )
            finally:
                matcher.close()
        except Exception as emb_err:
            print(f"Warning: Could not generate embedding for posted job {new_job_id}: {emb_err}")
        # ─────────────────────────────────────────────────────────────────────

        try:
            from app.database.db import (
                create_notification,
                get_connection,
            )

            # Get skills from the posted job
            job_skills = body.skills_required or []

            if job_skills:
                conn = get_connection()
                cur = conn.cursor()

                # Find job seekers whose skills overlap with job requirements
                cur.execute(
                    """
                    SELECT DISTINCT u.id
                    FROM users u
                    JOIN user_profiles up ON up.id = u.id
                    WHERE u.user_type = 'jobseeker'
                    AND u.is_admin = FALSE
                    AND u.is_active = TRUE
                    AND up.skills IS NOT NULL
                    AND array_length(up.skills, 1) > 0
                    AND EXISTS (
                      SELECT 1 FROM unnest(up.skills) s
                      WHERE s ILIKE ANY(
                        SELECT unnest(%s::text[])
                      )
                    )
                    LIMIT 50
                    """,
                    (job_skills,),
                )

                matching_users = cur.fetchall()
                cur.close()
                conn.close()

                # Get company name
                company_display = body.company_name

                # Create notification for each match
                for (user_id,) in matching_users:
                    create_notification(
                        user_id=user_id,
                        type="new_job_match",
                        title="New job matches your skills",
                        message=f"{body.title} at "
                                f"{company_display}",
                        link=f"/jobs/{new_job_id}",
                    )

                print(f"Sent job notifications to "
                      f"{len(matching_users)} users")

        except Exception as e:
            print(f"Job notification error: {e}")
            # Don't fail the job posting if notifications fail

        return {"success": True, "job_id": new_job_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# PUT /api/jobs/posted/{job_id}
# ---------------------------------------------------------------------------
@app.put("/api/jobs/posted/{job_id}")
def put_posted_job(
    job_id: int,
    body: PostedJobUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update a posted job. Company only."""
    if current_user.get("user_type") != "company":
        raise HTTPException(status_code=403, detail="Company access only")
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    if not data:
        return {"success": True}
    ok = db_update_posted_job(job_id, current_user["id"], data)
    if not ok:
        raise HTTPException(status_code=404, detail="Job not found or access denied")

    # ── Re-generate embedding so updated content reflects in CV matching ─────
    try:
        updated = db_get_posted_job_by_id(job_id)
        if updated:
            from app.services.vector_matching_service import VectorSkillMatcher
            matcher = VectorSkillMatcher()
            try:
                matcher.embed_posted_job(
                    posted_job_id=job_id,
                    title=updated.get("title", ""),
                    company=updated.get("company_name", ""),
                    location=updated.get("location", ""),
                    description=updated.get("description", ""),
                    skills=list(updated.get("skills_required") or []),
                )
            finally:
                matcher.close()
    except Exception as emb_err:
        print(f"Warning: Could not re-generate embedding for posted job {job_id}: {emb_err}")
    # ─────────────────────────────────────────────────────────────────────────

    return {"success": True}


# ---------------------------------------------------------------------------
# DELETE /api/jobs/posted/{job_id}
# ---------------------------------------------------------------------------
@app.delete("/api/jobs/posted/{job_id}")
def delete_posted_job_route(
    job_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Delete a posted job. Company only."""
    if current_user.get("user_type") != "company":
        raise HTTPException(status_code=403, detail="Company access only")
    ok = db_delete_posted_job(job_id, current_user["id"])
    if not ok:
        raise HTTPException(status_code=404, detail="Job not found or access denied")
    return {"success": True}


# ---------------------------------------------------------------------------
# PUT /api/jobs/posted/{job_id}/toggle
# ---------------------------------------------------------------------------
@app.put("/api/jobs/posted/{job_id}/toggle")
def toggle_posted_job(
    job_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Toggle is_active for a posted job. Company only."""
    if current_user.get("user_type") != "company":
        raise HTTPException(status_code=403, detail="Company access only")
    ok = db_toggle_job_active(job_id, current_user["id"])
    if not ok:
        raise HTTPException(status_code=404, detail="Job not found or access denied")
    return {"success": True}


def _run_scraper():
    status_file = PROJECT_ROOT / "logs" / "scraper_status.json"
    status_file.parent.mkdir(parents=True, exist_ok=True)

    def _write_status(payload: Dict) -> None:
        with status_file.open("w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=True, indent=2)

    started_at = datetime.utcnow().isoformat()
    _write_status(
        {
            "running": True,
            "last_started_at": started_at,
            "last_finished_at": None,
            "last_exit_code": None,
            "last_error": None,
        }
    )

    try:
        proc = subprocess.run(
            [sys.executable, "-m", "scripts.scheduled_scraper"],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            timeout=3600,
        )
        _write_status(
            {
                "running": False,
                "last_started_at": started_at,
                "last_finished_at": datetime.utcnow().isoformat(),
                "last_exit_code": proc.returncode,
                "last_error": None if proc.returncode == 0 else (proc.stderr or proc.stdout or "Scraper failed"),
            }
        )
    except Exception as e:
        _write_status(
            {
                "running": False,
                "last_started_at": started_at,
                "last_finished_at": datetime.utcnow().isoformat(),
                "last_exit_code": -1,
                "last_error": str(e),
            }
        )
        raise


# ---------------------------------------------------------------------------
# POST /api/scraper/run
# ---------------------------------------------------------------------------
@app.post("/api/scraper/run")
def scraper_run(background_tasks: BackgroundTasks):
    background_tasks.add_task(_run_scraper)
    return {"status": "started", "message": "Scraper job started in background."}


# ---------------------------------------------------------------------------
# POST /api/company/search-candidates
# ---------------------------------------------------------------------------
@app.post("/api/company/search-candidates", response_model=List[CandidateResponse])
def search_candidates(
    body: SearchCandidatesRequest,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("user_type") != "company":
        raise HTTPException(status_code=403, detail="Company access only")
    require_plan(current_user, "search_candidates", upgrade_to="business")
    try:
        from app.services.user_profile_service import (
            find_matching_candidates,
            log_company_search,
        )

        required_skills = body.required_skills or []
        if not required_skills:
            return []

        candidates = find_matching_candidates(
            required_skills=required_skills,
            top_k=min(body.top_k, 50),
            min_keyword_matches=body.min_keyword_matches,
        )

        if body.location_filter and body.location_filter.strip():
            loc = body.location_filter.strip().lower()
            candidates = [c for c in candidates if c.get("location") and loc in (c.get("location") or "").lower()]
        if body.min_experience is not None:
            candidates = [c for c in candidates if (c.get("years_experience") or 0) >= body.min_experience]
        if body.max_experience is not None:
            candidates = [c for c in candidates if (c.get("years_experience") is None or c.get("years_experience") <= body.max_experience)]

        accepted_ids = db_get_accepted_contact_candidate_ids(current_user["id"])
        result = []
        for i, c in enumerate(candidates, start=1):
            created_at = c.get("created_at")
            candidate_user_id = c.get("user_id")
            revealed = candidate_user_id in accepted_ids if candidate_user_id else False
            result.append(
                CandidateResponse(
                    rank=i,
                    full_name=c.get("full_name") or "—",
                    email=c.get("email") if revealed else None,
                    email_revealed=revealed,
                    skills=c.get("skills") or [],
                    matched_skills=c.get("matched_skills") or [],
                    keyword_score=float(c.get("keyword_score", 0)),
                    profile_boosted=bool(c.get("profile_boosted")),
                    cv_filename=c.get("cv_filename"),
                    created_at=created_at.isoformat() if created_at and hasattr(created_at, "isoformat") else (str(created_at) if created_at else None),
                    user_id=c.get("user_id"),
                    profile_slug=c.get("profile_slug"),
                    location=c.get("location"),
                    years_experience=c.get("years_experience"),
                )
            )
        log_company_search(
            company_name=body.company_name or "Unknown",
            required_skills=required_skills,
            user_id=current_user["id"],
            results_count=len(result),
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# GET /api/company/candidate-count
# ---------------------------------------------------------------------------
@app.get("/api/company/candidate-count")
def candidate_count():
    try:
        from app.services.user_profile_service import get_profile_count
        count = get_profile_count()
        return {"count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# GET /api/company/all-candidates
# ---------------------------------------------------------------------------
@app.get("/api/company/all-candidates")
def all_candidates(
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("user_type") != "company":
        raise HTTPException(status_code=403, detail="Company access only")
    require_plan(current_user, "search_candidates", upgrade_to="business")
    try:
        from app.services.user_profile_service import get_all_profiles
        profiles = get_all_profiles(limit=min(limit, 100))
        return [
            {
                "id": p["id"],
                "email": None,
                "email_revealed": False,
                "full_name": p["full_name"],
                "skills": p["skills"],
                "skills_count": len(p.get("skills") or []),
                "cv_filename": p.get("cv_filename") or "",
                "created_at": p["created_at"].isoformat() if p.get("created_at") and hasattr(p["created_at"], "isoformat") else str(p.get("created_at", "")),
            }
            for p in profiles
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# POST /api/jobseeker/save-profile
# ---------------------------------------------------------------------------
@app.post("/api/jobseeker/save-profile", response_model=SaveProfileResponse)
def save_jobseeker_profile(body: SaveProfileRequest):
    try:
        from app.services.user_profile_service import save_user_profile

        skills_embedding = None
        if body.skills:
            from app.services.vector_matching_service import VectorSkillMatcher
            matcher = VectorSkillMatcher()
            try:
                skills_embedding = matcher.embed_skills(body.skills)
            finally:
                matcher.close()

        profile_id = save_user_profile(
            email=body.email,
            skills=body.skills,
            cv_text=body.cv_text or "",
            full_name=body.full_name or "",
            cv_filename=body.cv_filename or "",
            skills_embedding=skills_embedding,
        )
        return SaveProfileResponse(success=True, profile_id=profile_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# GET /api/profile
# ---------------------------------------------------------------------------
@app.get("/api/profile")
def get_profile(current_user: dict = Depends(get_current_user)):
    """Return current user's profile. Default empty profile if no row in user_profiles."""
    user_id = current_user["id"]
    profile = db_get_user_profile(user_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="User not found")
    if profile.get("id") is None:
        return {
            "full_name": current_user.get("full_name") or "",
            "email": current_user.get("email") or "",
            "headline": "",
            "bio": "",
            "location": "",
            "linkedin_url": "",
            "years_experience": 0,
            "skills": [],
            "cv_filename": None,
        }
    return profile


# ---------------------------------------------------------------------------
# PUT /api/profile
# ---------------------------------------------------------------------------
@app.put("/api/profile")
def update_profile(body: ProfileUpdateRequest, current_user: dict = Depends(get_current_user)):
    """Update current user's profile (full_name, headline, bio, location, linkedin_url, years_experience)."""
    user_id = current_user["id"]
    data = {
        "full_name": body.full_name,
        "headline": body.headline,
        "bio": body.bio,
        "location": body.location,
        "linkedin_url": body.linkedin_url,
        "years_experience": body.years_experience,
    }
    if not db_upsert_user_profile(user_id, data):
        raise HTTPException(status_code=400, detail="Failed to update profile")
    profile = db_get_user_profile(user_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="User not found")
    if profile.get("id") is None:
        return {
            "full_name": current_user.get("full_name") or "",
            "email": current_user.get("email") or "",
            "headline": "",
            "bio": "",
            "location": "",
            "linkedin_url": "",
            "years_experience": 0,
            "skills": [],
            "cv_filename": None,
        }
    return profile


# ---------------------------------------------------------------------------
# PUT /api/profile/skills
# ---------------------------------------------------------------------------
@app.put("/api/profile/skills")
def update_profile_skills(body: ProfileSkillsRequest, current_user: dict = Depends(get_current_user)):
    """Update current user's skills array."""
    user_id = current_user["id"]
    skills = body.skills or []
    if not db_update_user_skills(user_id, skills):
        raise HTTPException(status_code=400, detail="Failed to update skills")
    return {"success": True, "skills": skills}


# ---------------------------------------------------------------------------
# POST /api/profile/upload-cv
# ---------------------------------------------------------------------------
@app.post("/api/profile/upload-cv")
async def upload_profile_cv(
    cv: UploadFile = File(..., alias="cv"),
    current_user: dict = Depends(get_current_user),
):
    """Protected: upload CV, extract text and skills, update user profile (job seeker only)."""
    from app.utils.cv_utils import ALLOWED_CV_LABEL, extract_text_from_cv_bytes, is_allowed_cv_filename

    if current_user.get("user_type") != "jobseeker":
        raise HTTPException(status_code=403, detail="Job seeker access only")
    if not cv.filename or not is_allowed_cv_filename(cv.filename):
        raise HTTPException(status_code=400, detail=f"Unsupported format. Allowed: {ALLOWED_CV_LABEL}.")
    content = await cv.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")
    import os
    import shutil
    from io import BytesIO

    os.makedirs("uploads", exist_ok=True)
    safe_name = cv.filename.replace(" ", "_").strip()
    filename = f"cv_{current_user['id']}_{safe_name}"
    file_path = os.path.join("uploads", filename)
    with open(file_path, "wb") as f:
        f.write(content)
    try:
        from app.services.skill_extraction_service import (
            call_huggingface_api,
            parse_skills_from_response,
            merge_skills_from_api_and_fallback,
        )
        extracted_text = extract_text_from_cv_bytes(content, cv.filename)
        if not extracted_text or not extracted_text.strip():
            raise HTTPException(status_code=422, detail="Could not extract text from CV")
        model_name = os.getenv("HF_MODEL")
        skills = []
        try:
            api_response = call_huggingface_api(cv_text=extracted_text, model_name=model_name)
            if api_response:
                skills = parse_skills_from_response(api_response)
        except Exception:
            pass
        skills = merge_skills_from_api_and_fallback(extracted_text, skills)
        if not db_upsert_user_profile_cv(
            current_user["id"],
            filename,
            extracted_text,
            skills,
        ):
            raise HTTPException(status_code=500, detail="Failed to save profile")
        db_ensure_user_has_slug(
            current_user["id"],
            current_user.get("full_name") or current_user.get("email", ""),
        )
        return {
            "success": True,
            "cv_filename": filename,
            "skills_extracted": skills,
            "skills_count": len(skills),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# GET /api/applications
# ---------------------------------------------------------------------------
@app.get("/api/applications")
def get_applications(current_user: dict = Depends(get_current_user)):
    """Return current user's job applications."""
    if current_user.get("user_type") == "jobseeker":
        require_plan(current_user, "application_tracker")
    apps = db_get_user_applications(current_user["id"])
    return apps


# ---------------------------------------------------------------------------
# POST /api/applications
# ---------------------------------------------------------------------------
@app.post("/api/applications")
def post_application(body: ApplicationCreate, current_user: dict = Depends(get_current_user)):
    """Create a new job application."""
    user_id = current_user["id"]
    data = {
        "job_title": body.job_title,
        "company": body.company,
        "job_url": body.job_url,
        "location": body.location,
        "status": body.status or "applied",
        "notes": body.notes,
    }
    new_id = db_create_application(user_id, data)
    return {"id": new_id, "success": True}


# ---------------------------------------------------------------------------
# PUT /api/applications/{app_id}
# ---------------------------------------------------------------------------
@app.put("/api/applications/{app_id}")
def put_application(
    app_id: int,
    body: ApplicationUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update a job application."""
    user_id = current_user["id"]
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    if not db_update_application(app_id, user_id, data):
        raise HTTPException(status_code=404, detail="Application not found")
    return {"success": True}


# ---------------------------------------------------------------------------
# DELETE /api/applications/{app_id}
# ---------------------------------------------------------------------------
@app.delete("/api/applications/{app_id}")
def delete_app(app_id: int, current_user: dict = Depends(get_current_user)):
    """Delete a job application."""
    if not db_delete_application(app_id, current_user["id"]):
        raise HTTPException(status_code=404, detail="Application not found")
    return {"success": True}


# ---------------------------------------------------------------------------
# GET /api/saved-jobs
# ---------------------------------------------------------------------------
@app.get("/api/saved-jobs")
def get_saved_jobs_route(current_user: dict = Depends(get_current_user)):
    """Return current user's saved jobs."""
    jobs = db_get_saved_jobs(current_user["id"])
    return jobs


# ---------------------------------------------------------------------------
# POST /api/saved-jobs/{job_id}
# ---------------------------------------------------------------------------
@app.post("/api/saved-jobs/{job_id}")
def post_save_job(job_id: int, current_user: dict = Depends(get_current_user)):
    """Save a job for the current user."""
    if current_user.get("user_type") != "jobseeker":
        raise HTTPException(status_code=403, detail="Job seeker access only")
    if job_id == 0 or not db_get_job_by_id(job_id):
        raise HTTPException(status_code=404, detail="Job not found")
    if not db_save_job(current_user["id"], job_id):
        raise HTTPException(status_code=500, detail="Could not save job")
    return {"success": True, "saved": True}


# ---------------------------------------------------------------------------
# DELETE /api/saved-jobs/{job_id}
# ---------------------------------------------------------------------------
@app.delete("/api/saved-jobs/{job_id}")
def delete_saved_job(job_id: int, current_user: dict = Depends(get_current_user)):
    """Unsave a job for the current user."""
    db_unsave_job(current_user["id"], job_id)
    return {"success": True, "saved": False}


# ---------------------------------------------------------------------------
# GET /api/saved-jobs/check/{job_id}
# ---------------------------------------------------------------------------
@app.get("/api/saved-jobs/check/{job_id}")
def check_saved_job(job_id: int, current_user: dict = Depends(get_current_user)):
    """Check if a job is saved by the current user."""
    return {"saved": db_is_job_saved(current_user["id"], job_id)}


# ---------------------------------------------------------------------------
# GET /api/company/profile
# ---------------------------------------------------------------------------
@app.get("/api/company/profile")
def get_company_profile_route(current_user: dict = Depends(get_current_user)):
    """Return current company's profile. Empty defaults if none."""
    if current_user.get("user_type") != "company":
        raise HTTPException(status_code=403, detail="Company access only")
    profile = db_get_company_profile(current_user["id"])
    if profile is None:
        return {
            "user_id": current_user["id"],
            "email": current_user.get("email") or "",
            "full_name": current_user.get("full_name") or "",
            "company_name": "",
            "website": None,
            "industry": None,
            "company_size": None,
            "description": None,
            "logo_url": None,
            "created_at": None,
        }
    return profile


# ---------------------------------------------------------------------------
# GET /api/company/posted-jobs
# ---------------------------------------------------------------------------
@app.get("/api/company/posted-jobs")
def get_company_posted_jobs_route(current_user: dict = Depends(get_current_user)):
    """Return current company's posted jobs. Company only."""
    if current_user.get("user_type") != "company":
        raise HTTPException(status_code=403, detail="Company access only")
    return db_get_company_posted_jobs(current_user["id"])


# ---------------------------------------------------------------------------
# PUT /api/company/profile
# ---------------------------------------------------------------------------
@app.put("/api/company/profile")
def put_company_profile(
    body: CompanyProfileUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update company profile."""
    if current_user.get("user_type") != "company":
        raise HTTPException(status_code=403, detail="Company access only")
    user_id = current_user["id"]
    data = {
        "company_name": body.company_name,
        "website": body.website,
        "industry": body.industry,
        "company_size": body.company_size,
        "description": body.description,
        "contact_name": body.contact_name,
    }
    if not db_upsert_company_profile(user_id, data):
        raise HTTPException(status_code=400, detail="Failed to update profile")
    profile = db_get_company_profile(user_id)
    if profile is None:
        raise HTTPException(status_code=500, detail="Profile not found after update")
    return profile


@app.get("/api/company/plan-usage")
def get_company_plan_usage(current_user: dict = Depends(get_current_user)):
    if current_user.get("user_type") != "company":
        raise HTTPException(status_code=403, detail="Company access only")
    sub = db_get_user_subscription(current_user["id"])
    usage = company_usage_summary(
        current_user,
        active_jobs=db_count_company_active_posted_jobs(current_user["id"]),
        contact_requests_30d=db_count_company_contact_requests_last_30_days(current_user["id"]),
        saved_candidates=db_count_company_saved_candidates(current_user["id"]),
    )
    if sub:
        usage["cancel_at_period_end"] = bool(sub.get("cancel_at_period_end"))
        usage["current_period_end"] = sub.get("current_period_end")
    return usage


# ---------------------------------------------------------------------------
# GET /api/company/saved-candidates
# ---------------------------------------------------------------------------
@app.get("/api/company/saved-candidates")
def get_saved_candidates_route(current_user: dict = Depends(get_current_user)):
    if current_user.get("user_type") != "company":
        raise HTTPException(status_code=403, detail="Company access only")
    require_plan(current_user, "save_candidates", upgrade_to="business")
    return db_get_saved_candidates(current_user["id"])


# ---------------------------------------------------------------------------
# POST /api/company/saved-candidates
# ---------------------------------------------------------------------------
@app.post("/api/company/saved-candidates")
def post_save_candidate(
    body: SaveCandidateRequest,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("user_type") != "company":
        raise HTTPException(status_code=403, detail="Company access only")
    require_plan(current_user, "save_candidates", upgrade_to="business")
    save_limit = max_saved_candidates(current_user)
    if save_limit is not None:
        current_count = db_count_company_saved_candidates(current_user["id"])
        if current_count >= save_limit:
            plan = (current_user.get("plan") or "free").strip().lower()
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "plan_required",
                    "message": (
                        f"Your plan allows saving up to {save_limit} candidates. "
                        "Upgrade to Business for unlimited saves."
                    ),
                    "current_plan": plan,
                    "required_plan": "business",
                    "upgrade_url": "/pricing",
                },
            )
    db_save_candidate(current_user["id"], body.candidate_user_id)
    return {"success": True, "saved": True}


# ---------------------------------------------------------------------------
# DELETE /api/company/saved-candidates/{candidate_user_id}
# ---------------------------------------------------------------------------
@app.delete("/api/company/saved-candidates/{candidate_user_id}")
def delete_saved_candidate(
    candidate_user_id: int,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("user_type") != "company":
        raise HTTPException(status_code=403, detail="Company access only")
    db_unsave_candidate(current_user["id"], candidate_user_id)
    return {"success": True, "saved": False}


# ---------------------------------------------------------------------------
# PUT /api/company/saved-candidates/notes
# ---------------------------------------------------------------------------
@app.put("/api/company/saved-candidates/notes")
def put_candidate_notes(
    body: CandidateNotesRequest,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("user_type") != "company":
        raise HTTPException(status_code=403, detail="Company access only")
    db_update_candidate_notes(
        current_user["id"],
        body.candidate_user_id,
        body.notes,
    )
    return {"success": True}


# ---------------------------------------------------------------------------
# GET /api/company/search-history
# ---------------------------------------------------------------------------
@app.get("/api/company/search-history")
def get_search_history_route(current_user: dict = Depends(get_current_user)):
    if current_user.get("user_type") != "company":
        raise HTTPException(status_code=403, detail="Company access only")
    require_plan(current_user, "search_history", upgrade_to="business")
    return db_get_search_history(current_user["id"])


# ---------------------------------------------------------------------------
# DELETE /api/company/search-history/{search_id}
# ---------------------------------------------------------------------------
@app.delete("/api/company/search-history/{search_id}")
def delete_search_history_item_route(
    search_id: int,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("user_type") != "company":
        raise HTTPException(status_code=403, detail="Company access only")
    db_delete_search_history_item(search_id, current_user["id"])
    return {"success": True}


# ---------------------------------------------------------------------------
# DELETE /api/company/search-history
# ---------------------------------------------------------------------------
@app.delete("/api/company/search-history")
def clear_search_history_route(current_user: dict = Depends(get_current_user)):
    if current_user.get("user_type") != "company":
        raise HTTPException(status_code=403, detail="Company access only")
    db_clear_search_history(current_user["id"])
    return {"success": True}


# ---------------------------------------------------------------------------
# Contact requests
# ---------------------------------------------------------------------------
@app.post("/api/contact-requests")
def post_contact_request(
    body: ContactRequestCreate,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("user_type") != "company":
        raise HTTPException(status_code=403, detail="Company access only")
    sent_30d = db_count_company_contact_requests_last_30_days(current_user["id"])
    contact_limit = max_contact_requests_30d(current_user)
    plan = (current_user.get("plan") or "free").strip().lower()
    if contact_limit is not None and contact_limit == 0:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "plan_required",
                "message": (
                    "Contact requests are a Business feature. Search candidates and send outreach, "
                    "or on Free and Growth manage applicants who apply to your job postings."
                ),
                "current_plan": plan,
                "required_plan": "business",
                "upgrade_url": "/pricing",
            },
        )
    if contact_limit is not None and sent_30d >= contact_limit:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "plan_required",
                "message": (
                    f"Your plan allows {contact_limit} contact requests per 30 days. "
                    "Upgrade to Business for unlimited outreach."
                ),
                "current_plan": plan,
                "required_plan": "business",
                "upgrade_url": "/pricing",
            },
        )
    message = (body.message or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    if len(message) > 500:
        raise HTTPException(status_code=400, detail="Message must be 500 characters or less")
    request_id = db_send_contact_request(
        current_user["id"],
        body.candidate_user_id,
        message,
    )
    candidate = get_user_by_id(body.candidate_user_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    company_profile = db_get_company_profile(current_user["id"])
    company_name = (company_profile or {}).get("company_name") or current_user.get("full_name") or "A company"
    send_contact_request_email(
        candidate["email"],
        candidate.get("full_name") or "Candidate",
        company_name,
        message,
    )
    try:
        db_create_notification(
            user_id=body.candidate_user_id,
            type="contact_request",
            title="New contact request",
            message=f"{company_name} wants to connect with you",
            link="/requests",
        )
    except Exception:
        pass
    return {
        "success": True,
        "request_id": request_id,
        "message": "Request sent successfully",
    }


# ---------------------------------------------------------------------------
# Public contact messages
# ---------------------------------------------------------------------------
@app.post("/api/contact")
def create_public_contact_message(
    body: ContactMessageCreate,
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    user_id = current_user["id"] if current_user else None
    full_name = (body.full_name or "").strip()
    email = (body.email or "").strip()
    subject = (body.subject or "").strip()
    message = (body.message or "").strip()
    company = (body.company or "").strip()

    if current_user:
        full_name = current_user.get("full_name") or full_name
        email = current_user.get("email") or email

    if not full_name:
        raise HTTPException(status_code=400, detail="Full name is required")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="Please provide a valid email")
    if not subject:
        raise HTTPException(status_code=400, detail="Subject is required")
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")
    if len(full_name) > 255 or len(email) > 255 or len(subject) > 255:
        raise HTTPException(status_code=400, detail="Name, email, and subject must be 255 characters or less")
    if len(message) > 5000:
        raise HTTPException(status_code=400, detail="Message must be 5000 characters or less")

    msg_id = db_create_contact_message(
        user_id=user_id,
        full_name=full_name,
        email=email,
        company=company or None,
        subject=subject,
        message=message,
    )
    return {"success": True, "message_id": msg_id, "message": "Thanks, we received your message."}


@app.get("/api/admin/contact-messages")
def get_admin_contact_messages(
    limit: int = 50,
    offset: int = 0,
    status: Optional[str] = None,
    admin_user: dict = Depends(get_admin_user),
):
    _ = admin_user
    if limit < 1 or limit > 200:
        raise HTTPException(status_code=400, detail="limit must be between 1 and 200")
    if offset < 0:
        raise HTTPException(status_code=400, detail="offset must be 0 or greater")
    if status and status not in ("new", "in_progress", "resolved"):
        raise HTTPException(status_code=400, detail="status must be new, in_progress, or resolved")
    return db_get_contact_messages(limit=limit, offset=offset, status=status)


@app.get("/api/admin/contact-messages/{message_id}")
def get_admin_contact_message_thread(
    message_id: int,
    admin_user: dict = Depends(get_admin_user),
):
    _ = admin_user
    thread = db_get_contact_message_thread(message_id)
    if thread is None:
        raise HTTPException(status_code=404, detail="Contact message not found")
    return thread


@app.put("/api/admin/contact-messages/{message_id}/status")
def update_admin_contact_message_status(
    message_id: int,
    body: ContactMessageStatusUpdate,
    admin_user: dict = Depends(get_admin_user),
):
    _ = admin_user
    status = (body.status or "").strip()
    if status not in ("new", "in_progress", "resolved"):
        raise HTTPException(status_code=400, detail="status must be new, in_progress, or resolved")
    ok = db_update_contact_message_status(message_id, status)
    if not ok:
        raise HTTPException(status_code=404, detail="Contact message not found")
    return {"success": True}


@app.post("/api/admin/contact-messages/{message_id}/reply")
def post_admin_contact_message_reply(
    message_id: int,
    body: ContactMessageReplyCreate,
    admin_user: dict = Depends(get_admin_user),
):
    reply_message = (body.message or "").strip()
    if not reply_message:
        raise HTTPException(status_code=400, detail="Reply message is required")
    if len(reply_message) > 5000:
        raise HTTPException(status_code=400, detail="Reply message must be 5000 characters or less")

    contact_msg = db_get_contact_message_by_id(message_id)
    if contact_msg is None:
        raise HTTPException(status_code=404, detail="Contact message not found")

    sent_via = "backend"
    if contact_msg.get("user_id"):
        # Logged-in user: keep communication inside the app.
        db_create_notification(
            user_id=contact_msg["user_id"],
            type="system",
            title="New support reply",
            message=f"Support replied to: {contact_msg.get('subject') or 'your message'}",
            link="/contact",
        )
    else:
        # Guest user: reply through email.
        sent_ok = send_support_reply_email(
            to_email=contact_msg["email"],
            full_name=contact_msg.get("full_name") or "",
            subject=contact_msg.get("subject") or "Support reply",
            reply_message=reply_message,
        )
        if not sent_ok:
            raise HTTPException(status_code=500, detail="Failed to send email reply")
        sent_via = "email"

    reply_id = db_add_contact_message_reply(
        message_id=message_id,
        sender_type="admin",
        message=reply_message,
        sender_user_id=admin_user["id"],
        sent_via=sent_via,
    )
    db_update_contact_message_status(message_id, "in_progress")
    return {"success": True, "reply_id": reply_id, "sent_via": sent_via}


@app.get("/api/contact/my-messages")
def get_my_contact_messages(
    current_user: dict = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0,
):
    if limit < 1 or limit > 200:
        raise HTTPException(status_code=400, detail="limit must be between 1 and 200")
    if offset < 0:
        raise HTTPException(status_code=400, detail="offset must be 0 or greater")
    return db_get_user_contact_messages(current_user["id"], limit=limit, offset=offset)


@app.get("/api/contact/my-messages/{message_id}")
def get_my_contact_message_thread(
    message_id: int,
    current_user: dict = Depends(get_current_user),
):
    thread = db_get_contact_message_thread(message_id)
    if thread is None or thread.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=404, detail="Message not found")
    return thread


@app.post("/api/contact/my-messages/{message_id}/reply")
def post_my_contact_message_reply(
    message_id: int,
    body: ContactMessageReplyCreate,
    current_user: dict = Depends(get_current_user),
):
    thread = db_get_contact_message_thread(message_id)
    if thread is None or thread.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=404, detail="Message not found")
    reply_message = (body.message or "").strip()
    if not reply_message:
        raise HTTPException(status_code=400, detail="Reply message is required")
    if len(reply_message) > 5000:
        raise HTTPException(status_code=400, detail="Reply message must be 5000 characters or less")

    reply_id = db_add_contact_message_reply(
        message_id=message_id,
        sender_type="user",
        message=reply_message,
        sender_user_id=current_user["id"],
        sent_via="backend",
    )
    db_update_contact_message_status(message_id, "in_progress")
    return {"success": True, "reply_id": reply_id}


@app.get("/api/contact-requests/received")
def get_received_contact_requests(current_user: dict = Depends(get_current_user)):
    if current_user.get("user_type") != "jobseeker":
        raise HTTPException(status_code=403, detail="Job seeker access only")
    requests_list = db_get_candidate_requests(current_user["id"])
    return requests_list


@app.get("/api/contact-requests/sent")
def get_sent_contact_requests(current_user: dict = Depends(get_current_user)):
    if current_user.get("user_type") != "company":
        raise HTTPException(status_code=403, detail="Company access only")
    requests_list = db_get_company_requests(current_user["id"])
    return requests_list


@app.put("/api/contact-requests/{request_id}")
def update_contact_request(
    request_id: int,
    body: ContactRequestStatusUpdate,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("user_type") != "jobseeker":
        raise HTTPException(status_code=403, detail="Job seeker access only")
    status = body.status
    if status not in ("accepted", "declined"):
        raise HTTPException(status_code=400, detail="status must be 'accepted' or 'declined'")
    ok = db_update_request_status(request_id, current_user["id"], status)
    if not ok:
        raise HTTPException(status_code=404, detail="Request not found or not authorized")
    if status == "accepted":
        req = db_get_contact_request_by_id(request_id)
        if req:
            candidate = get_user_by_id(req["candidate_user_id"])
            company_name = (db_get_company_profile(req["company_user_id"]) or {}).get("company_name") or req.get("company_contact_name") or "Your company"
            send_acceptance_email(
                req["company_email"],
                company_name,
                candidate.get("full_name") or candidate.get("email", ""),
                candidate.get("email", ""),
            )
            try:
                db_create_notification(
                    user_id=req["company_user_id"],
                    type="request_accepted",
                    title="Contact request accepted!",
                    message=f"{candidate.get('full_name') or 'Candidate'} accepted your contact request",
                    link="/company/requests",
                )
            except Exception:
                pass
    if status == "declined":
        req = db_get_contact_request_by_id(request_id)
        if req:
            candidate = get_user_by_id(req["candidate_user_id"])
            try:
                db_create_notification(
                    user_id=req["company_user_id"],
                    type="request_declined",
                    title="Contact request declined",
                    message=f"{candidate.get('full_name') or 'Candidate'} declined your contact request",
                    link="/company/requests",
                )
            except Exception:
                pass
    return {"success": True}


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------
@app.get("/api/notifications")
def get_notifications(
    limit: int = 20,
    unread_only: bool = False,
    current_user: dict = Depends(get_current_user),
):
    safe_limit = max(1, min(limit, 100))
    return db_get_user_notifications(current_user["id"], safe_limit, unread_only)


@app.get("/api/notifications/unread-count")
def get_notifications_unread_count(current_user: dict = Depends(get_current_user)):
    count = db_get_unread_count(current_user["id"])
    return {"count": count}


@app.put("/api/notifications/{notification_id}/read")
def put_notification_read(
    notification_id: int,
    current_user: dict = Depends(get_current_user),
):
    db_mark_notification_read(notification_id, current_user["id"])
    return {"success": True}


@app.put("/api/notifications/read-all")
def put_notifications_read_all(current_user: dict = Depends(get_current_user)):
    db_mark_all_notifications_read(current_user["id"])
    return {"success": True}


@app.delete("/api/notifications/{notification_id}")
def delete_notification_route(
    notification_id: int,
    current_user: dict = Depends(get_current_user),
):
    db_delete_notification(notification_id, current_user["id"])
    return {"success": True}


# ---------------------------------------------------------------------------
# Payments (Stripe)
# ---------------------------------------------------------------------------

@app.post("/api/payments/create-checkout")
def create_checkout(
    body: CreateCheckoutRequest,
    current_user: dict = Depends(get_current_user),
):
    plan = (body.plan or "").strip().lower()
    if plan not in ("pro", "business"):
        raise HTTPException(status_code=400, detail="plan must be 'pro' or 'business'")
    if plan == "business" and current_user.get("user_type") != "company":
        raise HTTPException(status_code=403, detail="Business plan is only available for company accounts")
    billing_cycle = (body.billing_cycle or "monthly").strip().lower()
    if billing_cycle not in ("monthly", "annually"):
        raise HTTPException(status_code=400, detail="billing_cycle must be 'monthly' or 'annually'")

    existing_sub = db_get_user_subscription(current_user["id"])
    if existing_sub and existing_sub.get("stripe_customer_id"):
        customer_id = existing_sub["stripe_customer_id"]
    else:
        customer = stripe.Customer.create(
            email=current_user["email"],
            name=current_user.get("full_name") or current_user.get("email", ""),
            metadata={"user_id": str(current_user["id"])},
        )
        customer_id = customer.id

    prices = {
        "pro": {"monthly": 1200, "annually": 12000},
        "business": {"monthly": 4900, "annually": 46800},
    }
    if plan == "pro" and current_user.get("user_type") == "company":
        from app.database.db import get_plan_config

        cfg = get_plan_config()
        growth_monthly = int(cfg.get("growth_monthly_price", 29))
        growth_annual_monthly = int(cfg.get("growth_annual_price", 23))
        prices["pro"] = {
            "monthly": growth_monthly * 100,
            "annually": growth_annual_monthly * 12 * 100,
        }
    elif plan == "business":
        from app.database.db import get_plan_config

        cfg = get_plan_config()
        biz_monthly = int(cfg.get("business_monthly_price", 49))
        biz_annual_monthly = int(cfg.get("business_annual_price", 39))
        prices["business"] = {
            "monthly": biz_monthly * 100,
            "annually": biz_annual_monthly * 12 * 100,
        }
    elif plan == "pro":
        from app.database.db import get_plan_config

        cfg = get_plan_config()
        pro_monthly = int(cfg.get("pro_monthly_price", 12))
        pro_annual_monthly = int(cfg.get("pro_annual_price", 10))
        prices["pro"] = {
            "monthly": pro_monthly * 100,
            "annually": pro_annual_monthly * 12 * 100,
        }

    amount = prices[plan][billing_cycle]
    interval = "month" if billing_cycle == "monthly" else "year"

    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=["card"],
        line_items=[
            {
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": (
                            f"Vertex Growth"
                            if plan == "pro" and current_user.get("user_type") == "company"
                            else f"Vertex {plan.title()}"
                        ),
                        "description": (
                            "Vertex Growth Plan for hiring teams"
                            if plan == "pro" and current_user.get("user_type") == "company"
                            else f"Vertex {plan.title()} Plan"
                        ),
                    },
                    "unit_amount": amount,
                    "recurring": {"interval": interval},
                },
                "quantity": 1,
            }
        ],
        mode="subscription",
        success_url=(
            f"{APP_URL}/payment/success"
            f"?session_id={{CHECKOUT_SESSION_ID}}"
            f"&plan={plan}"
        ),
        cancel_url=f"{APP_URL}/pricing",
        metadata={
            "user_id": str(current_user["id"]),
            "plan": plan,
            "billing_cycle": billing_cycle,
        },
    )
    return {"checkout_url": session.url}


@app.get("/api/payments/subscription")
def get_subscription(current_user: dict = Depends(get_current_user)):
    sub = db_get_user_subscription(current_user["id"])
    if sub is None:
        return {"plan": "free", "status": "active"}
    return sub


@app.post("/api/payments/verify-session")
def verify_checkout_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Confirm a Stripe Checkout session server-side and upsert the subscription.

    This exists so the success page can activate a subscription without
    relying on the Stripe webhook, which is not always configured in
    local dev.
    """
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")

    try:
        session = stripe.checkout.Session.retrieve(session_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Invalid checkout session")

    def _safe(obj, key, default=None):
        """Stripe objects allow subscript access but not dict.get()."""
        try:
            val = obj[key]
            return default if val is None else val
        except Exception:
            return default

    metadata = _safe(session, "metadata", {}) or {}
    session_user_id = _safe(metadata, "user_id")
    if not session_user_id or int(session_user_id) != int(current_user["id"]):
        raise HTTPException(status_code=403, detail="Session does not belong to this user")

    if _safe(session, "payment_status") != "paid":
        raise HTTPException(status_code=402, detail="Payment not completed")

    plan = (_safe(metadata, "plan", "") or "").strip().lower()
    if plan not in ("pro", "business"):
        raise HTTPException(status_code=400, detail="Invalid plan in session metadata")
    if plan == "business" and current_user.get("user_type") != "company":
        raise HTTPException(status_code=403, detail="Business plan is only available for company accounts")

    subscription_id = _safe(session, "subscription")
    customer_id = _safe(session, "customer")
    if not subscription_id or not customer_id:
        raise HTTPException(status_code=400, detail="Session is missing subscription data")

    try:
        sub = stripe.Subscription.retrieve(subscription_id, expand=["items.data"])
        period_end = _stripe_subscription_period_end(sub)
    except Exception:
        period_end = None

    db_upsert_subscription(
        current_user["id"], customer_id, subscription_id, plan, "active", period_end
    )

    return {"success": True, "plan": plan, "status": "active"}


@app.post("/api/payments/cancel")
def cancel_subscription_route(current_user: dict = Depends(get_current_user)):
    sub = db_get_user_subscription(current_user["id"])
    if not sub or (sub.get("plan") or "free") == "free":
        raise HTTPException(status_code=400, detail="No active paid subscription to cancel")

    if sub.get("cancel_at_period_end"):
        return {
            "success": True,
            "plan": sub.get("plan"),
            "status": sub.get("status") or "active",
            "cancel_at_period_end": True,
            "current_period_end": sub.get("current_period_end"),
        }

    period_end = _coerce_period_end(sub.get("current_period_end"))
    stripe_sub_id = sub.get("stripe_subscription_id")

    if stripe_sub_id:
        try:
            updated = stripe.Subscription.modify(
                stripe_sub_id,
                cancel_at_period_end=True,
                expand=["items.data"],
            )
            period_end = _stripe_subscription_period_end(updated) or period_end
        except stripe.error.StripeError as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Could not cancel subscription with Stripe: {exc.user_message or str(exc)}",
            ) from exc
    elif period_end is None:
        period_end = datetime.utcnow() + timedelta(days=30)

    if not db_schedule_subscription_cancellation(current_user["id"], period_end):
        raise HTTPException(status_code=500, detail="Failed to schedule cancellation")

    end_iso = period_end.isoformat() if hasattr(period_end, "isoformat") else period_end
    return {
        "success": True,
        "plan": sub.get("plan"),
        "status": "active",
        "cancel_at_period_end": True,
        "current_period_end": end_iso,
    }


@app.post("/api/payments/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    if not STRIPE_WEBHOOK_SECRET:
        return {"received": True}
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid signature")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = int(session["metadata"]["user_id"])
        plan = session["metadata"]["plan"]
        user = db_get_user_by_id(user_id)
        if plan == "business" and (not user or user.get("user_type") != "company"):
            return {"received": True}
        subscription_id = session["subscription"]
        customer_id = session["customer"]
        sub = stripe.Subscription.retrieve(subscription_id, expand=["items.data"])
        period_end = _stripe_subscription_period_end(sub)
        db_upsert_subscription(
            user_id, customer_id, subscription_id, plan, "active", period_end
        )

    if event["type"] == "customer.subscription.updated":
        sub_obj = event["data"]["object"]
        subscription_id = sub_obj["id"]
        user_id = db_get_user_id_by_stripe_subscription_id(subscription_id)
        if user_id is not None:
            status = (sub_obj.get("status") or "active").strip().lower()
            cancel_at_end = bool(sub_obj.get("cancel_at_period_end"))
            period_end = _stripe_subscription_period_end(sub_obj)
            if status in ("canceled", "unpaid", "incomplete_expired"):
                db_cancel_subscription(user_id)
            else:
                metadata = sub_obj.get("metadata") or {}
                plan = (metadata.get("plan") or "").strip().lower() or None
                db_sync_subscription_from_stripe(
                    user_id,
                    status="active" if status in ("active", "trialing") else status,
                    current_period_end=period_end,
                    cancel_at_period_end=cancel_at_end,
                    plan=plan if plan in ("pro", "business") else None,
                )

    if event["type"] == "customer.subscription.deleted":
        subscription_id = event["data"]["object"]["id"]
        user_id = db_get_user_id_by_stripe_subscription_id(subscription_id)
        if user_id is not None:
            db_cancel_subscription(user_id)

    return {"received": True}


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------

@app.get("/api/analytics/jobseeker")
def get_analytics_jobseeker(current_user: dict = Depends(get_current_user)):
    if current_user.get("user_type") != "jobseeker":
        raise HTTPException(status_code=403, detail="Jobseeker access only")
    return db_get_jobseeker_analytics(current_user["id"])


@app.get("/api/analytics/company")
def get_analytics_company(current_user: dict = Depends(get_current_user)):
    if current_user.get("user_type") != "company":
        raise HTTPException(status_code=403, detail="Company access only")
    require_plan(current_user, "company_analytics", upgrade_to="pro")
    from api.plan_limits import can_search_candidates

    data = db_get_company_analytics(current_user["id"])
    data["includes_outreach_analytics"] = can_search_candidates(current_user)
    return data


# ---------------------------------------------------------------------------
# Job alerts (jobseeker only)
# ---------------------------------------------------------------------------

@app.get("/api/alerts/settings")
def get_alerts_settings(current_user: dict = Depends(get_current_user)):
    if current_user.get("user_type") != "jobseeker":
        raise HTTPException(status_code=403, detail="Jobseeker access only")
    require_plan(current_user, "job_alerts")
    return db_get_alert_settings(current_user["id"])


@app.put("/api/alerts/settings")
def update_alerts_settings(
    body: AlertSettingsUpdate,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("user_type") != "jobseeker":
        raise HTTPException(status_code=403, detail="Jobseeker access only")
    require_plan(current_user, "job_alerts")
    frequency = (body.frequency or "daily").strip().lower()
    if frequency not in ("immediate", "daily", "weekly"):
        raise HTTPException(status_code=400, detail="frequency must be immediate, daily, or weekly")
    min_score = body.min_match_score
    if not isinstance(min_score, int) or min_score < 0 or min_score > 100:
        raise HTTPException(status_code=400, detail="min_match_score must be between 0 and 100")
    db_upsert_alert_settings(
        current_user["id"],
        body.is_enabled,
        frequency,
        min_score,
    )
    return db_get_alert_settings(current_user["id"])


@app.post("/api/alerts/test")
def send_test_alert(current_user: dict = Depends(get_current_user)):
    if current_user.get("user_type") != "jobseeker":
        raise HTTPException(status_code=403, detail="Jobseeker access only")
    require_plan(current_user, "job_alerts")
    from api.job_alerts_scheduler import calculate_match_score

    profile = db_get_user_profile(current_user["id"])
    skills = (profile or {}).get("skills") or []
    if not skills:
        raise HTTPException(status_code=400, detail="Add skills to your profile first")
    jobs = db_get_recent_jobs(10)
    if not jobs:
        raise HTTPException(status_code=400, detail="No jobs in the database yet")
    settings = db_get_alert_settings(current_user["id"])
    min_score = settings.get("min_match_score", 70)
    scored = []
    for job in jobs:
        score = calculate_match_score(skills, job)
        if score >= min_score:
            scored.append({**job, "match_score": score})
    scored.sort(key=lambda x: x["match_score"], reverse=True)
    top = scored[:5]
    if not top:
        top = [{**jobs[0], "match_score": calculate_match_score(skills, jobs[0])}]
    sent = send_job_alert_email(
        current_user["email"],
        current_user.get("full_name") or current_user["email"],
        top,
    )
    return {"sent": sent, "jobs_count": len(top)}


# ---------------------------------------------------------------------------
# Public profile (no auth)
# ---------------------------------------------------------------------------

@app.get("/api/public/profile/{slug}")
def get_public_profile(slug: str):
    """Return public profile by slug. No auth required."""
    profile = db_get_profile_by_slug(slug)
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found or is private")
    return profile


# ---------------------------------------------------------------------------
# Profile slug & visibility (jobseeker, protected)
# ---------------------------------------------------------------------------

@app.put("/api/profile/visibility")
def update_profile_visibility_route(
    body: ProfileVisibilityUpdate,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("user_type") != "jobseeker":
        raise HTTPException(status_code=403, detail="Jobseeker access only")
    db_update_profile_visibility(current_user["id"], body.is_public)
    return {"success": True, "is_public": body.is_public}


def _public_site_base(request: Optional[Request] = None) -> str:
    """Public site origin for shareable links (respects nginx Host / X-Forwarded-*)."""
    if request is not None:
        host = request.headers.get("x-forwarded-host") or request.headers.get("host")
        if host:
            proto = request.headers.get("x-forwarded-proto", "http").split(",")[0].strip()
            return f"{proto}://{host}".rstrip("/")
    return (FRONTEND_URL or APP_URL or "http://localhost:3000").rstrip("/")


@app.get("/api/profile/slug")
def get_profile_slug(
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("user_type") != "jobseeker":
        raise HTTPException(status_code=403, detail="Jobseeker access only")
    slug = db_ensure_user_has_slug(
        current_user["id"],
        current_user.get("full_name") or current_user.get("email", ""),
    )
    return {"slug": slug, "profile_url": f"{_public_site_base(request)}/u/{slug}"}
