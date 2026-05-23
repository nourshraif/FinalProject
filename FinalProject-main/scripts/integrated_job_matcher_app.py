"""
Vector-Based CV Skill Matcher - Streamlit App

Modern SaaS-style UI. Backend: PostgreSQL/pgvector, Sentence Transformers, Hugging Face API.
"""

import os
import sys
import time
from pathlib import Path

project_root = Path(__file__).parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

import streamlit as st
from dotenv import load_dotenv
from app.utils.pdf_utils import extract_text_from_pdf
from app.services.skill_extraction_service import call_huggingface_api, parse_skills_from_response
from app.services.vector_matching_service import VectorSkillMatcher
from app.database.db import get_connection, save_cv_upload
from app.services.user_profile_service import save_user_profile
import pandas as pd

load_dotenv(project_root / ".env")

st.set_page_config(
    page_title="JobMatcher",
    page_icon="🎯",
    layout="wide",
    initial_sidebar_state="expanded",
)

# =============================================================================
# CSS THEME - load_css()
# =============================================================================
def load_css():
    return """
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
    :root {
        --navy: #0f172a;
        --navy-light: #1e293b;
        --navy-muted: #334155;
        --white: #ffffff;
        --gray-100: #f1f5f9;
        --gray-200: #e2e8f0;
        --gray-400: #94a3b8;
        --accent: #3b82f6;
        --accent-hover: #2563eb;
        --success: #10b981;
        --radius: 12px;
        --shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
        --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
    }
    * { font-family: 'Inter', -apple-system, sans-serif; box-sizing: border-box; }
    #MainMenu, footer { visibility: hidden; }
    header { visibility: hidden; }
    .main .block-container {
        padding: 0;
        max-width: 1200px;
        margin: 0 auto;
    }
    /* Nav */
    .nav-bar {
        background: var(--navy);
        color: var(--white);
        padding: 0.75rem 1.5rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-radius: 0 0 var(--radius) var(--radius);
        margin-bottom: 2rem;
        box-shadow: var(--shadow);
    }
    .nav-logo { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.02em; }
    .nav-links { display: flex; gap: 1.5rem; align-items: center; }
    .nav-links a { color: var(--gray-200); text-decoration: none; font-weight: 500; font-size: 0.9rem; }
    .nav-links a:hover { color: var(--white); }
    .nav-avatar {
        width: 36px; height: 36px;
        border-radius: 50%;
        background: var(--navy-light);
        border: 2px solid var(--gray-400);
    }
    /* Hero */
    .hero {
        text-align: center;
        padding: 3rem 2rem;
        background: linear-gradient(180deg, var(--gray-100) 0%, var(--white) 100%);
        border-radius: var(--radius);
        margin-bottom: 2rem;
    }
    .hero h1 { font-size: 2.25rem; font-weight: 700; color: var(--navy); margin-bottom: 0.5rem; }
    .hero p { font-size: 1.1rem; color: var(--navy-muted); max-width: 560px; margin: 0 auto 1.5rem; }
    /* Upload zone */
    .upload-zone {
        border: 2px dashed var(--gray-200);
        border-radius: var(--radius);
        padding: 2.5rem;
        text-align: center;
        background: var(--gray-100);
        margin: 1rem 0;
        transition: border-color 0.2s, background 0.2s;
    }
    .upload-zone:hover { border-color: var(--accent); background: #eff6ff; }
    .upload-icon { font-size: 2.5rem; margin-bottom: 0.5rem; color: var(--navy-muted); }
    .upload-text { font-size: 0.95rem; color: var(--navy-muted); }
    /* Cards */
    .job-card {
        background: var(--white);
        border: 1px solid var(--gray-200);
        border-radius: var(--radius);
        padding: 1.25rem;
        margin-bottom: 1rem;
        box-shadow: var(--shadow);
        transition: box-shadow 0.2s;
    }
    .job-card:hover { box-shadow: var(--shadow-lg); }
    .job-card-title { font-size: 1.1rem; font-weight: 600; color: var(--navy); margin-bottom: 0.25rem; }
    .job-card-meta { font-size: 0.85rem; color: var(--navy-muted); margin-bottom: 0.5rem; }
    .job-card-badge {
        display: inline-block;
        padding: 0.25rem 0.6rem;
        border-radius: 9999px;
        font-size: 0.8rem;
        font-weight: 600;
        margin-bottom: 0.5rem;
    }
    .badge-high { background: #d1fae5; color: #065f46; }
    .badge-mid { background: #fef3c7; color: #92400e; }
    .badge-low { background: #fee2e2; color: #991b1b; }
    .job-card-tags { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 0.75rem; }
    .job-tag { background: var(--gray-100); color: var(--navy-muted); padding: 0.2rem 0.5rem; border-radius: 6px; font-size: 0.75rem; }
    .job-card-apply {
        display: inline-block;
        background: var(--accent);
        color: var(--white) !important;
        padding: 0.5rem 1rem;
        border-radius: 8px;
        font-size: 0.9rem;
        font-weight: 500;
        text-decoration: none;
        margin-top: 0.5rem;
    }
    .job-card-apply:hover { background: var(--accent-hover); color: var(--white); }
    /* Skeleton */
    .skeleton { background: linear-gradient(90deg, var(--gray-200) 25%, var(--gray-100) 50%, var(--gray-200) 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 6px; }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    .skeleton-card { height: 160px; margin-bottom: 1rem; border-radius: var(--radius); }
    /* Footer */
    .app-footer {
        margin-top: 3rem;
        padding: 1.5rem;
        border-top: 1px solid var(--gray-200);
        text-align: center;
        font-size: 0.85rem;
        color: var(--navy-muted);
    }
    .app-footer a { color: var(--accent); text-decoration: none; margin: 0 0.5rem; }
    /* Dashboard */
    .stat-card {
        background: var(--white);
        border: 1px solid var(--gray-200);
        border-radius: var(--radius);
        padding: 1.25rem;
        box-shadow: var(--shadow);
    }
    .stat-value { font-size: 1.75rem; font-weight: 700; color: var(--navy); }
    .stat-label { font-size: 0.85rem; color: var(--navy-muted); margin-top: 0.25rem; }
    /* Responsive */
    @media (max-width: 768px) {
        .nav-bar { flex-wrap: wrap; gap: 0.75rem; }
        .nav-links { width: 100%; justify-content: center; }
        .hero h1 { font-size: 1.75rem; }
        .main .block-container { padding-left: 1rem; padding-right: 1rem; }
    }
    </style>
    """


# =============================================================================
# DATA HELPERS
# =============================================================================
def get_job_count():
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM jobs WHERE is_active = TRUE")
        count = cur.fetchone()[0]
        cur.close()
        conn.close()
        return count
    except Exception:
        return 0


def get_embedding_count():
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM job_embeddings")
        count = cur.fetchone()[0]
        cur.close()
        conn.close()
        return count
    except Exception:
        return 0


def get_dashboard_stats():
    """Total jobs, last updated, top categories (sources). Pull from DB or mock."""
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM jobs WHERE is_active = TRUE")
        total = cur.fetchone()[0]
        cur.execute("SELECT MAX(scraped_at) FROM jobs")
        row = cur.fetchone()
        last_updated = row[0] if row and row[0] else None
        cur.execute("""
            SELECT source, COUNT(*) as c FROM jobs WHERE is_active = TRUE
            GROUP BY source ORDER BY c DESC LIMIT 5
        """)
        top_sources = cur.fetchall()
        cur.close()
        conn.close()
        return {"total_jobs": total, "last_updated": last_updated, "top_categories": top_sources}
    except Exception:
        return {"total_jobs": 0, "last_updated": None, "top_categories": []}


# =============================================================================
# PLACEHOLDER FUNCTIONS (TODO)
# =============================================================================
def save_job(job_id: int, user_id: int = None) -> bool:
    # TODO: persist saved job for user (e.g. saved_jobs table, user_id + job_id)
    return False


def share_job(job_id: int, job_url: str) -> str:
    # TODO: generate shareable link or open share dialog
    return job_url or ""


def filter_jobs(jobs: list, job_type: str = None, location: str = None, salary_min: float = None, salary_max: float = None, date_posted: str = None) -> list:
    # TODO: apply filters (job_type, location, salary range, date posted)
    return jobs


# =============================================================================
# INJECT CSS
# =============================================================================
st.markdown(load_css(), unsafe_allow_html=True)

# =============================================================================
# SESSION STATE
# =============================================================================
if "cv_text" not in st.session_state:
    st.session_state.cv_text = None
if "cv_skills" not in st.session_state:
    st.session_state.cv_skills = None
if "cv_file_name" not in st.session_state:
    st.session_state.cv_file_name = None
if "matching_jobs" not in st.session_state:
    st.session_state.matching_jobs = None
if "recommendations" not in st.session_state:
    st.session_state.recommendations = None
if "current_page" not in st.session_state:
    st.session_state.current_page = "Search"

# =============================================================================
# SIDEBAR - Filters (TODO) + Settings
# =============================================================================
with st.sidebar:
    st.markdown("### ⚙️ Settings")
    st.markdown("---")
    # TODO: wire these to filter_jobs()
    st.markdown("**Filters** *(TODO)*")
    _job_type = st.selectbox("Job type", ["All", "Full-time", "Part-time", "Contract"], key="sb_job_type")
    _location = st.text_input("Location", placeholder="e.g. Remote", key="sb_location")
    _salary = st.slider("Salary range (placeholder)", 0, 200, (0, 200), key="sb_salary")
    _date_posted = st.selectbox("Date posted", ["Any", "Last 24h", "Last 7 days"], key="sb_date")
    st.markdown("---")
    available_models = [
        "openai/gpt-oss-120b:groq",
        "meta-llama/Llama-3.1-8B-Instruct",
        "mistralai/Mistral-7B-Instruct-v0.2",
    ]
    selected_model = st.selectbox("CV Extraction Model", available_models, index=0)
    st.markdown("---")
    st.markdown("**Matching**")
    matching_mode = st.radio("Mode", ["Hybrid", "Vector Only", "Keywords Only"], help="Hybrid = vector + keyword")
    if matching_mode == "Hybrid":
        vector_weight = st.slider("Vector Weight", 0.0, 1.0, 0.7, 0.1)
        keyword_weight = 1.0 - vector_weight
    else:
        vector_weight = 0.7
        keyword_weight = 0.3
    similarity_threshold = st.slider("Min Similarity", 0.0, 1.0, 0.3, 0.05)
    max_jobs = st.slider("Max Results", 10, 100, 30, 10)
    st.markdown("---")
    job_count = get_job_count()
    embedding_count = get_embedding_count()
    st.metric("Jobs in DB", f"{job_count:,}")
    st.metric("Embeddings", f"{embedding_count:,}")

# =============================================================================
# TOP NAV
# =============================================================================
st.markdown(
    '<div class="nav-bar">'
    '<span class="nav-logo">JobMatcher</span>'
    '<div class="nav-links" id="nav-links"></div>'
    '<div class="nav-avatar"></div></div>',
    unsafe_allow_html=True,
)
# Working nav: buttons that set page (HTML nav is visual only)
nav_a, nav_b, nav_c, nav_d = st.columns(4)
with nav_a:
    if st.button("Dashboard", use_container_width=True, key="nav_dash"):
        st.session_state.current_page = "Dashboard"
        st.rerun()
with nav_b:
    if st.button("Search", use_container_width=True, key="nav_search"):
        st.session_state.current_page = "Search"
        st.rerun()
with nav_c:
    if st.button("Saved Jobs", use_container_width=True, key="nav_saved"):
        st.session_state.current_page = "Saved Jobs"
        st.rerun()
with nav_d:
    if st.button("Settings", use_container_width=True, key="nav_settings"):
        st.session_state.current_page = "Settings"
        st.rerun()
st.markdown("---")

# =============================================================================
# PAGE: Dashboard
# =============================================================================
if st.session_state.current_page == "Dashboard":
    stats = get_dashboard_stats()
    st.markdown("## Dashboard")
    st.markdown("")
    col1, col2, col3 = st.columns(3)
    with col1:
        st.markdown(f'<div class="stat-card"><div class="stat-value">{stats["total_jobs"]:,}</div><div class="stat-label">Total jobs scraped</div></div>', unsafe_allow_html=True)
    with col2:
        lu = stats["last_updated"]
        lu_str = lu.strftime("%Y-%m-%d %H:%M") if lu else "—"
        st.markdown(f'<div class="stat-card"><div class="stat-value" style="font-size:1.1rem;">{lu_str}</div><div class="stat-label">Last updated</div></div>', unsafe_allow_html=True)
    with col3:
        cats = stats["top_categories"]
        cat_str = ", ".join([s[0] for s in cats[:5]]) if cats else "—"
        st.markdown(f'<div class="stat-card"><div class="stat-value" style="font-size:1rem;">{cat_str}</div><div class="stat-label">Top categories</div></div>', unsafe_allow_html=True)
    st.markdown("---")
    st.info("Use **Search** to upload your CV and find matching jobs.")
    st.markdown('<div class="app-footer">© JobMatcher · <a href="#">Privacy</a> · <a href="#">Terms</a> · <a href="#">Contact</a></div>', unsafe_allow_html=True)
    st.stop()

# =============================================================================
# PAGE: Saved Jobs / Settings (placeholders)
# =============================================================================
if st.session_state.current_page == "Saved Jobs":
    st.markdown("## Saved Jobs")
    st.info("Save jobs from search results to see them here. *(TODO: implement save_job and persistence)*")
    st.markdown('<div class="app-footer">© JobMatcher · <a href="#">Privacy</a> · <a href="#">Terms</a></div>', unsafe_allow_html=True)
    st.stop()
if st.session_state.current_page == "Settings":
    st.markdown("## Settings")
    st.info("Use the **sidebar** for matching and model settings.")
    st.markdown('<div class="app-footer">© JobMatcher · <a href="#">Privacy</a> · <a href="#">Terms</a></div>', unsafe_allow_html=True)
    st.stop()

# =============================================================================
# PAGE: Search (main flow)
# =============================================================================
# Hero
st.markdown(
    '<div class="hero">'
    '<h1>Match your CV to the right jobs</h1>'
    '<p>Upload your CV, we extract your skills and find the best matches using AI-powered semantic search.</p>'
    '</div>',
    unsafe_allow_html=True,
)

# Upload zone (styled)
st.markdown('<div class="upload-zone"><div class="upload-icon">📄</div><div class="upload-text">Drop your CV here or click to browse · PDF only</div></div>', unsafe_allow_html=True)
uploaded_file = st.file_uploader("Choose PDF file", type=["pdf"], label_visibility="collapsed")

if uploaded_file is not None:
    with st.spinner("Extracting text..."):
        try:
            cv_text = extract_text_from_pdf(uploaded_file)
            if cv_text:
                st.session_state.cv_text = cv_text
                st.session_state.cv_file_name = uploaded_file.name
                st.success(f"✓ Extracted text from {uploaded_file.name}")
            else:
                st.error("Failed to extract text")
        except Exception as e:
            st.error(f"Error: {e}")

st.markdown("---")
st.markdown("**2. Extract skills**")
if st.session_state.cv_text:
    if st.button("Extract Skills", type="primary", key="btn_extract"):
        with st.spinner("Analyzing CV..."):
            try:
                api_response = call_huggingface_api(
                    cv_text=st.session_state.cv_text,
                    model_name=selected_model,
                )
                if api_response:
                    skills = parse_skills_from_response(api_response)
                    st.session_state.cv_skills = skills
                    st.session_state.matching_jobs = None
                    if st.session_state.cv_file_name and st.session_state.cv_text:
                        try:
                            save_cv_upload(
                                st.session_state.cv_file_name,
                                st.session_state.cv_text,
                                skills,
                            )
                        except Exception:
                            pass
                    st.success(f"✓ Extracted {len(skills)} skills")
                else:
                    st.error("No response from AI")
            except Exception as e:
                st.error(f"Error: {e}")
                if "402" in str(e):
                    st.info("Try manual entry below.")

if not st.session_state.cv_skills:
    st.markdown("**Or enter skills manually:**")
    manual_skills = st.text_area("One skill per line", placeholder="Python\nJavaScript\nReact", height=100, label_visibility="collapsed")
    if st.button("Use These Skills", key="btn_manual"):
        if manual_skills:
            skills = [s.strip() for s in manual_skills.split("\n") if s.strip()]
            st.session_state.cv_skills = skills
            st.success(f"✓ Added {len(skills)} skills")
            st.rerun()

if st.session_state.cv_skills:
    st.markdown(f"**Your skills:** {', '.join(st.session_state.cv_skills[:10])}")
    if len(st.session_state.cv_skills) > 10:
        st.caption(f"+ {len(st.session_state.cv_skills) - 10} more")

    # Optional: add profile to talent pool (so companies can find you)
    with st.expander("Join the talent pool (optional)"):
        st.caption("Add your profile so companies can search for candidates like you.")
        pool_email = st.text_input("Email", key="pool_email", placeholder="you@example.com")
        pool_name = st.text_input("Full name (optional)", key="pool_name", placeholder="Your name")
        if st.button("Add my profile to talent pool", key="btn_join_pool"):
            if not (pool_email and pool_email.strip()):
                st.warning("Please enter your email.")
            else:
                try:
                    from sentence_transformers import SentenceTransformer
                    model = SentenceTransformer("all-MiniLM-L6-v2")
                    skills_text = "Professional skills: " + ", ".join(st.session_state.cv_skills)
                    skills_embedding = model.encode(skills_text, convert_to_numpy=True)
                    save_user_profile(
                        email=pool_email.strip(),
                        skills=st.session_state.cv_skills,
                        cv_text=st.session_state.cv_text or "",
                        full_name=(pool_name or "").strip(),
                        cv_filename=st.session_state.cv_file_name or "",
                        skills_embedding=skills_embedding,
                    )
                    st.success("You're in the talent pool. Companies can now find you.")
                except Exception as e:
                    st.error(f"Could not add profile: {e}")

st.markdown("---")
st.markdown("**3. Find matches**")
run_match = st.session_state.cv_skills and st.button("Find Matches", type="primary", key="btn_match")

if run_match:
    # Skeleton while matcher runs (same run)
    placeholder = st.empty()
    with placeholder.container():
        st.markdown('<div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div>', unsafe_allow_html=True)
    start_time = time.time()
    try:
        matcher = VectorSkillMatcher()
        if matching_mode == "Hybrid":
            matches = matcher.find_matching_jobs_hybrid(
                cv_skills=st.session_state.cv_skills,
                top_k=max_jobs,
                vector_weight=vector_weight,
                keyword_weight=keyword_weight,
            )
        elif matching_mode == "Vector Only":
            matches = matcher.find_similar_jobs(
                cv_skills=st.session_state.cv_skills,
                top_k=max_jobs,
                similarity_threshold=similarity_threshold,
            )
        else:
            matches = matcher.find_matching_jobs_hybrid(
                cv_skills=st.session_state.cv_skills,
                top_k=max_jobs,
                vector_weight=0.0,
                keyword_weight=1.0,
            )
        st.session_state.matching_jobs = matches
        if matches:
            recs = matcher.get_skill_recommendations(
                cv_skills=st.session_state.cv_skills,
                n_jobs=min(50, len(matches)),
            )
            st.session_state.recommendations = recs
        matcher.close()
        elapsed = time.time() - start_time
        placeholder.empty()
        st.success(f"✓ Found {len(matches)} matches in {elapsed:.1f}s")
    except Exception as e:
        placeholder.empty()
        st.error(f"Error: {e}")

# Results as cards
if st.session_state.matching_jobs:
    df = pd.DataFrame(st.session_state.matching_jobs)
    score_col = "match_percentage" if "match_percentage" in df.columns else "similarity_score"
    col1, col2, col3 = st.columns(3)
    with col1:
        avg = df[score_col].mean() * 100 if score_col in df.columns else 0
        st.metric("Avg Match", f"{avg:.1f}%")
    with col2:
        best = df[score_col].max() * 100 if score_col in df.columns else 0
        st.metric("Best Match", f"{best:.1f}%")
    with col3:
        st.metric("Total", len(df))
    st.markdown("---")
    tab1, tab2, tab3 = st.tabs(["Matches", "Analytics", "Recommendations"])

    with tab1:
        # Job cards in columns (2 per row)
        jobs = st.session_state.matching_jobs
        for i in range(0, len(jobs), 2):
            row_jobs = jobs[i : i + 2]
            cols = st.columns(2)
            for j, job in enumerate(row_jobs):
                score = job.get("match_percentage", job.get("similarity_score", 0) * 100)
                badge_class = "badge-high" if score >= 70 else "badge-mid" if score >= 40 else "badge-low"
                url = job.get("url") or "#"
                title = (job.get("title") or "Job")[:60]
                company = (job.get("company") or "—")[:40]
                location = (job.get("location") or "Remote")[:30]
                source = job.get("source") or ""
                with cols[j]:
                    skills_text = job.get("skills_text") or ""
                    skills_preview = [s.strip() for s in skills_text.split(",") if s.strip()][:5]
                    tags_html = "".join(f'<span class="job-tag">{s[:20]}</span>' for s in skills_preview) if skills_preview else ""
                    st.markdown(
                        f'<div class="job-card">'
                        f'<div class="job-card-title">{title}</div>'
                        f'<div class="job-card-meta">{company} · {location} · {source}</div>'
                        f'<span class="job-card-badge {badge_class}">{score:.0f}% match</span>'
                        f'<div class="job-card-tags">{tags_html}</div>'
                        f'<a class="job-card-apply" href="{url}" target="_blank">Apply</a>'
                        f'</div>',
                        unsafe_allow_html=True,
                    )

    with tab2:
        if score_col in df.columns:
            st.bar_chart(df.set_index("title")[score_col] * 100)
            st.markdown("**Top companies**")
            st.bar_chart(df["company"].value_counts().head(10))

    with tab3:
        if st.session_state.recommendations and st.session_state.recommendations.get("recommendations"):
            recs = st.session_state.recommendations
            st.markdown(f"Based on {recs['jobs_analyzed']} jobs")
            for rec in recs["recommendations"][:15]:
                st.markdown(f"**{rec['skill']}** — {rec['percentage']:.0f}% of jobs")
                st.progress(min(rec["percentage"] / 100, 1.0))
        else:
            st.info("Recommendations appear after matching.")

st.markdown('<div class="app-footer">© JobMatcher · <a href="#">Privacy</a> · <a href="#">Terms</a> · <a href="#">Contact</a></div>', unsafe_allow_html=True)
