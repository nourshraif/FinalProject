"""
FastAPI backend for the job matching app.

Run from project root: uvicorn api.main:app --reload
Requires: pip install fastapi uvicorn python-multipart
"""

import os
import sys
import subprocess
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
from typing import List, Optional
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

from app.database.db import (
    get_user_by_email,
    get_user_by_id,
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
    get_company_profile as db_get_company_profile,
    upsert_company_profile as db_upsert_company_profile,
    get_saved_candidates as db_get_saved_candidates,
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
    create_password_reset_token as db_create_password_reset_token,
    get_valid_password_reset_token as db_get_valid_password_reset_token,
    mark_password_reset_used as db_mark_password_reset_used,
    update_user_password as db_update_user_password,
    get_platform_stats as db_get_platform_stats,
    get_all_users as db_get_all_users,
    get_all_users_total as db_get_all_users_total,
    toggle_user_active as db_toggle_user_active,
    make_user_admin as db_make_user_admin,
    get_recent_activity as db_get_recent_activity,
    get_user_subscription as db_get_user_subscription,
    upsert_subscription as db_upsert_subscription,
    cancel_subscription as db_cancel_subscription,
    get_user_id_by_stripe_subscription_id as db_get_user_id_by_stripe_subscription_id,
    get_jobseeker_analytics as db_get_jobseeker_analytics,
    get_company_analytics as db_get_company_analytics,
    get_alert_settings as db_get_alert_settings,
    upsert_alert_settings as db_upsert_alert_settings,
    get_recent_jobs as db_get_recent_jobs,
    search_jobs as db_search_jobs,
    get_job_sources as db_get_job_sources,
    get_job_locations as db_get_job_locations,
    get_profile_by_slug as db_get_profile_by_slug,
    ensure_user_has_slug as db_ensure_user_has_slug,
    update_profile_visibility as db_update_profile_visibility,
    create_posted_job as db_create_posted_job,
    get_company_posted_jobs as db_get_company_posted_jobs,
    get_all_posted_jobs as db_get_all_posted_jobs,
    get_posted_job_by_id as db_get_posted_job_by_id,
    update_posted_job as db_update_posted_job,
    toggle_job_active as db_toggle_job_active,
    delete_posted_job as db_delete_posted_job,
    create_notification as db_create_notification,
    get_user_notifications as db_get_user_notifications,
    get_unread_count as db_get_unread_count,
    mark_notification_read as db_mark_notification_read,
    mark_all_notifications_read as db_mark_all_notifications_read,
    delete_notification as db_delete_notification,
)
from api.email_service import (
    send_welcome_email,
    send_password_reset_email,
    send_contact_request_email,
    send_acceptance_email,
    send_job_alert_email,
)
from api.job_alerts_scheduler import create_scheduler

# ---------------------------------------------------------------------------
# JWT Auth configuration
# ---------------------------------------------------------------------------
SECRET_KEY = os.getenv("SECRET_KEY", "vertex-dev-secret-change-in-prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

BCRYPT_ROUNDS = 12
security = HTTPBearer()

# Google OAuth
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv(
    "GOOGLE_REDIRECT_URI",
    "http://localhost:8000/api/auth/google/callback",
)
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# Stripe (test mode)
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PRO_PRICE_ID = os.getenv("STRIPE_PRO_PRICE_ID", "")
STRIPE_BUSINESS_PRICE_ID = os.getenv("STRIPE_BUSINESS_PRICE_ID", "")
APP_URL = os.getenv("APP_URL", "http://localhost:3000")

# ---------------------------------------------------------------------------
# App + Job alerts scheduler
# ---------------------------------------------------------------------------
scheduler = create_scheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.start()
    print("✅ Job alerts scheduler started")
    print("📅 Daily alerts: 8:00 AM")
    print("📅 Weekly alerts: Monday 9:00 AM")
    yield
    scheduler.shutdown()
    print("🛑 Scheduler stopped")


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


class JobsStatsResponse(BaseModel):
    total_jobs: int
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
    use_semantic: bool = True
    location_filter: Optional[str] = None
    min_experience: Optional[int] = None
    max_experience: Optional[int] = None
    min_match_score: Optional[float] = None
    sort_by: str = "score"  # "score", "experience", "recent"


class CandidateResponse(BaseModel):
    rank: int
    full_name: str
    email: str
    skills: List[str]
    matched_skills: List[str]
    keyword_score: float
    vector_score: float
    combined_score: float
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
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


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


def _generate_chat_reply(messages: List[ChatMessage]) -> str:
    latest_user = ""
    for msg in reversed(messages):
        if (msg.role or "").lower() == "user":
            latest_user = (msg.content or "").strip()
            break

    if not latest_user:
        return "Tell me your target role and I can suggest CV improvements."

    q = latest_user.lower()
    if "cv" in q or "resume" in q:
        return (
            "Great question. Here are practical CV tips:\n"
            "- Tailor your CV to one target role and match key skills from the job post.\n"
            "- Use impact bullets with numbers (e.g., reduced load time by 35%).\n"
            "- Keep sections clear: summary, skills, experience, projects, education.\n"
            "- Prioritize recent/relevant work and remove low-value filler.\n"
            "- Keep it concise (usually 1 page for junior, up to 2 for experienced)."
        )
    if "interview" in q:
        return (
            "For interviews: prepare 5 STAR stories, review role fundamentals, and "
            "practice concise answers for common behavioral and technical questions."
        )
    if "job" in q or "search" in q:
        return (
            "For job search: define a narrow role target, tailor each application, "
            "track applications weekly, and follow up on strong-fit roles in 5-7 days."
        )
    return (
        "I can help with CV improvement, interview prep, and job search strategy. "
        "Share your target role and experience level for tailored advice."
    )


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/chat")
def chat_assistant(body: ChatRequest):
    try:
        messages = body.messages or []
        if not messages:
            return {"reply": "Ask me anything about CVs, interviews, or job search."}
        return {"reply": _generate_chat_reply(messages)}
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
    user = get_user_by_email(request.email)
    if user is not None:
        reset_token = secrets.token_urlsafe(32)
        db_create_password_reset_token(user["id"], reset_token)
        send_password_reset_email(
            request.email,
            user.get("full_name") or "User",
            reset_token,
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
        "created_at": (
            current_user["created_at"].isoformat()
            if current_user.get("created_at") and hasattr(current_user["created_at"], "isoformat")
            else str(current_user.get("created_at", ""))
        ),
    }


# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------
@app.get("/api/admin/stats")
def admin_stats(admin_user: dict = Depends(get_admin_user)):
    return db_get_platform_stats()


@app.get("/api/admin/users")
def admin_users(
    limit: int = 50,
    offset: int = 0,
    search: str = "",
    admin_user: dict = Depends(get_admin_user),
):
    users = db_get_all_users(limit=limit, offset=offset, search=search if search else None)
    total = db_get_all_users_total(search=search if search else None)
    return {"users": users, "total": total}


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


@app.get("/api/admin/activity")
def admin_activity(admin_user: dict = Depends(get_admin_user)):
    return db_get_recent_activity()


@app.post("/api/admin/scraper/run")
def admin_scraper_run(
    background_tasks: BackgroundTasks,
    admin_user: dict = Depends(get_admin_user),
):
    background_tasks.add_task(_run_scraper)
    return {"message": "Scraper started"}


# ---------------------------------------------------------------------------
# POST /api/upload-cv
# ---------------------------------------------------------------------------
@app.post("/api/upload-cv")
async def upload_cv(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="PDF file required")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")
    try:
        from app.utils.pdf_utils import extract_text_from_pdf
        from app.services.skill_extraction_service import (
            call_huggingface_api,
            parse_skills_from_response,
            fallback_extract_skills,
        )

        pdf_file = BytesIO(content)
        cv_text = extract_text_from_pdf(pdf_file)
        if not cv_text or not cv_text.strip():
            raise HTTPException(status_code=422, detail="Could not extract text from PDF")
        model_name = os.getenv("HF_MODEL")
        skills = []
        used_fallback = False
        try:
            api_response = call_huggingface_api(cv_text=cv_text, model_name=model_name)
            if api_response:
                skills = parse_skills_from_response(api_response)
        except Exception:
            skills = fallback_extract_skills(cv_text)
            used_fallback = True
        if not skills:
            raise HTTPException(
                status_code=502,
                detail="Could not extract skills (API unavailable and fallback found none). Try again or add skills manually.",
            )
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
@app.post("/api/match-jobs", response_model=List[JobMatchResponse])
def match_jobs(body: SkillsRequest):
    skills = body.skills or []
    if not skills:
        return []
    try:
        from app.services.vector_matching_service import VectorSkillMatcher

        matcher = VectorSkillMatcher()
        try:
            jobs = matcher.find_matching_jobs_hybrid(
                cv_skills=skills,
                top_k=20,
                vector_weight=0.7,
                keyword_weight=0.3,
            )
        finally:
            matcher.close()
        result = []
        for j in jobs:
            score = j.get("match_percentage") or (j.get("similarity_score", 0) * 100)
            tags = []
            st = j.get("skills_text") or ""
            if st:
                tags = [t.strip() for t in st.split(",") if t.strip()][:15]
            result.append(
                JobMatchResponse(
                    id=j.get("job_id", 0),
                    title=j.get("title") or "",
                    company=j.get("company") or "",
                    location=j.get("location") or "Remote",
                    description=(j.get("description") or "")[:2000] or None,
                    url=j.get("url") or "",
                    match_score=round(float(score), 1),
                    tags=tags,
                )
            )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# GET /api/jobs/stats
# ---------------------------------------------------------------------------
@app.get("/api/jobs/stats", response_model=JobsStatsResponse)
def jobs_stats():
    try:
        from app.database.db import get_connection

        conn = get_connection()
        cur = conn.cursor()
        try:
            cur.execute("SELECT COUNT(*) FROM jobs WHERE is_active = TRUE")
            total = cur.fetchone()[0]
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
    """Search scraped jobs. No auth required. Returns jobs, total, page, total_pages."""
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
    """List active, non-expired posted jobs. No auth required."""
    try:
        return db_get_all_posted_jobs(
            limit=limit,
            offset=offset,
            job_type=job_type,
            experience_level=experience_level,
            search=search,
        )
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
    data = body.model_dump()
    data["company_name"] = company_name
    try:
        new_job_id = db_create_posted_job(current_user["id"], data)

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
    subprocess.run(
        [sys.executable, "-m", "scripts.scheduled_scraper"],
        cwd=PROJECT_ROOT,
        capture_output=True,
        timeout=3600,
    )


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
    try:
        from app.services.user_profile_service import (
            find_matching_candidates,
            log_company_search,
        )

        required_skills = body.required_skills or []
        if not required_skills:
            return []

        query_embedding = None
        if body.use_semantic:
            from app.services.vector_matching_service import VectorSkillMatcher
            matcher = VectorSkillMatcher()
            try:
                query_embedding = matcher.embed_skills(required_skills)
            finally:
                matcher.close()

        candidates = find_matching_candidates(
            required_skills=required_skills,
            query_embedding=query_embedding,
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
        if body.min_match_score is not None:
            candidates = [c for c in candidates if (c.get("combined_score") or 0) >= body.min_match_score]
        if body.sort_by == "experience":
            candidates = sorted(candidates, key=lambda c: (c.get("years_experience") or 0), reverse=True)
        elif body.sort_by == "recent":
            candidates = sorted(
                candidates,
                key=lambda c: c.get("created_at") or "",
                reverse=True,
            )
        else:
            pass  # keep score order

        result = []
        for i, c in enumerate(candidates, start=1):
            created_at = c.get("created_at")
            result.append(
                CandidateResponse(
                    rank=i,
                    full_name=c.get("full_name") or "—",
                    email=c.get("email") or "",
                    skills=c.get("skills") or [],
                    matched_skills=c.get("matched_skills") or [],
                    keyword_score=float(c.get("keyword_score", 0)),
                    vector_score=float(c.get("vector_score", 0)),
                    combined_score=float(c.get("combined_score", 0)),
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
def all_candidates(limit: int = 50):
    try:
        from app.services.user_profile_service import get_all_profiles
        profiles = get_all_profiles(limit=min(limit, 100))
        return [
            {
                "id": p["id"],
                "email": p["email"],
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
    """Protected: upload CV PDF, extract text and skills, update user profile (job seeker only)."""
    if current_user.get("user_type") != "jobseeker":
        raise HTTPException(status_code=403, detail="Job seeker access only")
    if not cv.filename or not cv.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files allowed")
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
        from app.utils.pdf_utils import extract_text_from_pdf
        from app.services.skill_extraction_service import (
            call_huggingface_api,
            parse_skills_from_response,
            fallback_extract_skills,
        )
        with open(file_path, "rb") as f:
            extracted_text = extract_text_from_pdf(f)
        if not extracted_text or not extracted_text.strip():
            raise HTTPException(status_code=422, detail="Could not extract text from PDF")
        model_name = os.getenv("HF_MODEL")
        skills = []
        try:
            api_response = call_huggingface_api(cv_text=extracted_text, model_name=model_name)
            if api_response:
                skills = parse_skills_from_response(api_response)
        except Exception:
            skills = fallback_extract_skills(extracted_text)
        if not skills:
            skills = fallback_extract_skills(extracted_text)
        if not db_upsert_user_profile_cv(
            current_user["id"],
            filename,
            extracted_text,
            skills,
        ):
            raise HTTPException(status_code=500, detail="Failed to save profile")
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
    return db_get_saved_jobs(current_user["id"])


# ---------------------------------------------------------------------------
# POST /api/saved-jobs/{job_id}
# ---------------------------------------------------------------------------
@app.post("/api/saved-jobs/{job_id}")
def post_save_job(job_id: int, current_user: dict = Depends(get_current_user)):
    """Save a job for the current user."""
    db_save_job(current_user["id"], job_id)
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


# ---------------------------------------------------------------------------
# GET /api/company/saved-candidates
# ---------------------------------------------------------------------------
@app.get("/api/company/saved-candidates")
def get_saved_candidates_route(current_user: dict = Depends(get_current_user)):
    if current_user.get("user_type") != "company":
        raise HTTPException(status_code=403, detail="Company access only")
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
                        "name": f"Vertex {plan.title()}",
                        "description": f"Vertex {plan.title()} Plan",
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


@app.post("/api/payments/cancel")
def cancel_subscription_route(current_user: dict = Depends(get_current_user)):
    sub = db_get_user_subscription(current_user["id"])
    if sub and sub.get("stripe_subscription_id"):
        try:
            stripe.Subscription.modify(
                sub["stripe_subscription_id"],
                cancel_at_period_end=True,
            )
        except Exception:
            pass
    db_cancel_subscription(current_user["id"])
    return {"success": True}


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
        subscription_id = session["subscription"]
        customer_id = session["customer"]
        sub = stripe.Subscription.retrieve(subscription_id)
        period_end = datetime.fromtimestamp(sub["current_period_end"])
        db_upsert_subscription(
            user_id, customer_id, subscription_id, plan, "active", period_end
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
    return db_get_company_analytics(current_user["id"])


# ---------------------------------------------------------------------------
# Job alerts (jobseeker only)
# ---------------------------------------------------------------------------

@app.get("/api/alerts/settings")
def get_alerts_settings(current_user: dict = Depends(get_current_user)):
    if current_user.get("user_type") != "jobseeker":
        raise HTTPException(status_code=403, detail="Jobseeker access only")
    return db_get_alert_settings(current_user["id"])


@app.put("/api/alerts/settings")
def update_alerts_settings(
    body: AlertSettingsUpdate,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("user_type") != "jobseeker":
        raise HTTPException(status_code=403, detail="Jobseeker access only")
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


@app.get("/api/profile/slug")
def get_profile_slug(current_user: dict = Depends(get_current_user)):
    if current_user.get("user_type") != "jobseeker":
        raise HTTPException(status_code=403, detail="Jobseeker access only")
    slug = db_ensure_user_has_slug(
        current_user["id"],
        current_user.get("full_name") or current_user.get("email", ""),
    )
    base = FRONTEND_URL or APP_URL or "http://localhost:3000"
    return {"slug": slug, "profile_url": f"{base}/u/{slug}"}
