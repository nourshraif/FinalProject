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

from typing import List, Optional
from datetime import datetime, timedelta

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
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
)

# ---------------------------------------------------------------------------
# JWT Auth configuration
# ---------------------------------------------------------------------------
SECRET_KEY = os.getenv("SECRET_KEY", "vertex-dev-secret-change-in-prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

BCRYPT_ROUNDS = 12
security = HTTPBearer()

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(title="Job Matcher API", version="1.0.0")

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
    company_name: Optional[str] = None
    required_skills: List[str]
    top_k: int = 20
    min_matches: int = 1
    use_semantic: bool = True


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


class SaveCandidateRequest(BaseModel):
    candidate_user_id: int


class CandidateNotesRequest(BaseModel):
    candidate_user_id: int
    notes: str


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


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_type: str
    full_name: str
    user_id: int
    email: str


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


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@app.get("/health")
def health():
    return {"status": "ok"}


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
        return TokenResponse(
            access_token=token,
            user_type=request.user_type,
            full_name=request.full_name,
            user_id=user_id,
            email=request.email,
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
    return TokenResponse(
        access_token=token,
        user_type=user["user_type"],
        full_name=user["full_name"],
        user_id=user["id"],
        email=user["email"],
    )


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
        "created_at": (
            current_user["created_at"].isoformat()
            if current_user.get("created_at") and hasattr(current_user["created_at"], "isoformat")
            else str(current_user.get("created_at", ""))
        ),
    }


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
def search_candidates(body: SearchCandidatesRequest):
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

        if body.company_name:
            log_company_search(body.company_name, required_skills)

        candidates = find_matching_candidates(
            required_skills=required_skills,
            query_embedding=query_embedding,
            top_k=min(body.top_k, 50),
            min_keyword_matches=body.min_matches,
        )

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
                )
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
