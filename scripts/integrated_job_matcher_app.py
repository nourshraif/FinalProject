"""
Vector-Based CV Skill Matcher - Streamlit App

Clean SaaS-style interface for intelligent job matching using semantic vector embeddings.
"""

import os
import sys
import time
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

import streamlit as st
from dotenv import load_dotenv
from app.utils.pdf_utils import extract_text_from_pdf
from app.services.skill_extraction_service import call_huggingface_api, parse_skills_from_response
from app.services.vector_matching_service import VectorSkillMatcher
from app.database.db import get_connection
import pandas as pd

# Load .env from project root (same folder as scripts/)
load_dotenv(project_root / ".env")

# ============================================================================
# PAGE CONFIGURATION
# ============================================================================
st.set_page_config(
    page_title="Job Matcher",
    page_icon="🎯",
    layout="wide",
    initial_sidebar_state="expanded"
)

# ============================================================================
# MINIMAL CSS - Clean SaaS Style
# ============================================================================
st.markdown("""
<style>
    /* Hide default Streamlit elements */
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    header {visibility: hidden;}
    
    /* Clean spacing */
    .main .block-container {
        padding-top: 3rem;
        padding-bottom: 2rem;
        max-width: 1200px;
    }
    
    /* Simple, clean styling */
    h1 { font-size: 2rem; font-weight: 600; color: #1a1a1a; }
    h2 { font-size: 1.5rem; font-weight: 600; color: #2a2a2a; margin-top: 2rem; }
    h3 { font-size: 1.25rem; font-weight: 600; color: #333; }
    
    /* Subtle dividers */
    hr { margin: 2rem 0; border: none; border-top: 1px solid #e5e5e5; }
</style>
""", unsafe_allow_html=True)

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================
def get_job_count():
    """Get total number of jobs in database."""
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM jobs WHERE is_active = TRUE")
        count = cur.fetchone()[0]
        cur.close()
        conn.close()
        return count
    except:
        return 0

def get_embedding_count():
    """Get number of jobs with embeddings."""
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM job_embeddings")
        count = cur.fetchone()[0]
        cur.close()
        conn.close()
        return count
    except:
        return 0

# ============================================================================
# SIDEBAR - Settings Only
# ============================================================================
with st.sidebar:
    st.title("Settings")
    
    st.markdown("---")
    
    # Model selection
    available_models = [
        "openai/gpt-oss-120b:groq",
        "meta-llama/Llama-3.1-8B-Instruct",
        "mistralai/Mistral-7B-Instruct-v0.2",
    ]
    
    selected_model = st.selectbox("CV Extraction Model", available_models, index=0)
    
    st.markdown("---")
    
    # Matching parameters
    st.subheader("Matching")
    
    matching_mode = st.radio(
        "Mode",
        ["Hybrid", "Vector Only", "Keywords Only"],
        help="Hybrid combines vector similarity with keyword matching"
    )
    
    if matching_mode == "Hybrid":
        vector_weight = st.slider("Vector Weight", 0.0, 1.0, 0.7, 0.1)
        keyword_weight = 1.0 - vector_weight
    
    similarity_threshold = st.slider("Min Similarity", 0.0, 1.0, 0.3, 0.05)
    max_jobs = st.slider("Max Results", 10, 100, 30, 10)
    
    st.markdown("---")
    
    # Stats
    st.subheader("Database")
    job_count = get_job_count()
    embedding_count = get_embedding_count()
    
    st.metric("Jobs", f"{job_count:,}")
    st.metric("Embeddings", f"{embedding_count:,}")
    
    if embedding_count < job_count * 0.9:
        st.caption(f"ℹ️ {embedding_count}/{job_count} jobs have embeddings")

# ============================================================================
# INITIALIZE SESSION STATE
# ============================================================================
if 'cv_text' not in st.session_state:
    st.session_state.cv_text = None
if 'cv_skills' not in st.session_state:
    st.session_state.cv_skills = None
if 'matching_jobs' not in st.session_state:
    st.session_state.matching_jobs = None
if 'recommendations' not in st.session_state:
    st.session_state.recommendations = None

# ============================================================================
# MAIN CONTENT
# ============================================================================

# Header
st.title("Job Matcher")
st.markdown("Match your CV skills with job opportunities using AI-powered semantic search.")

st.markdown("---")

# Step 1: Upload CV
st.subheader("1. Upload CV")
uploaded_file = st.file_uploader("Choose PDF file", type=['pdf'], label_visibility="collapsed")

if uploaded_file is not None:
    with st.spinner("Extracting text..."):
        try:
            cv_text = extract_text_from_pdf(uploaded_file)
            if cv_text:
                st.session_state.cv_text = cv_text
                st.success(f"✓ Extracted text from {uploaded_file.name}")
            else:
                st.error("Failed to extract text")
        except Exception as e:
            st.error(f"Error: {e}")

st.markdown("---")

# Step 2: Extract Skills
st.subheader("2. Extract Skills")

if st.session_state.cv_text:
    if st.button("Extract Skills", type="primary"):
        with st.spinner("Analyzing CV..."):
            try:
                api_response = call_huggingface_api(
                    cv_text=st.session_state.cv_text,
                    model_name=selected_model
                )
                
                if api_response:
                    skills = parse_skills_from_response(api_response)
                    st.session_state.cv_skills = skills
                    st.session_state.matching_jobs = None
                    st.success(f"✓ Extracted {len(skills)} skills")
                else:
                    st.error("No response from AI")
            except Exception as e:
                st.error(f"Error: {e}")
                if "402" in str(e):
                    st.info("Try manual entry below")

# Manual skill entry
if not st.session_state.cv_skills:
    st.markdown("**Or enter skills manually:**")
    manual_skills = st.text_area(
        "One skill per line",
        placeholder="Python\nJavaScript\nReact",
        height=100,
        label_visibility="collapsed"
    )
    
    if st.button("Use These Skills"):
        if manual_skills:
            skills = [s.strip() for s in manual_skills.split('\n') if s.strip()]
            st.session_state.cv_skills = skills
            st.success(f"✓ Added {len(skills)} skills")
            st.rerun()

# Display current skills
if st.session_state.cv_skills:
    st.markdown(f"**Your skills:** {', '.join(st.session_state.cv_skills[:10])}")
    if len(st.session_state.cv_skills) > 10:
        st.caption(f"+ {len(st.session_state.cv_skills) - 10} more")

st.markdown("---")

# Step 3: Find Matches
st.subheader("3. Find Matches")

if st.session_state.cv_skills:
    if st.button("Find Matches", type="primary"):
        with st.spinner("Finding matches..."):
            start_time = time.time()
            
            try:
                matcher = VectorSkillMatcher()
                
                if matching_mode == "Hybrid":
                    matches = matcher.find_matching_jobs_hybrid(
                        cv_skills=st.session_state.cv_skills,
                        top_k=max_jobs,
                        vector_weight=vector_weight,
                        keyword_weight=keyword_weight
                    )
                elif matching_mode == "Vector Only":
                    matches = matcher.find_similar_jobs(
                        cv_skills=st.session_state.cv_skills,
                        top_k=max_jobs,
                        similarity_threshold=similarity_threshold
                    )
                else:
                    matches = matcher.find_matching_jobs_hybrid(
                        cv_skills=st.session_state.cv_skills,
                        top_k=max_jobs,
                        vector_weight=0.0,
                        keyword_weight=1.0
                    )
                
                st.session_state.matching_jobs = matches
                
                if matches:
                    recs = matcher.get_skill_recommendations(
                        cv_skills=st.session_state.cv_skills,
                        n_jobs=min(50, len(matches))
                    )
                    st.session_state.recommendations = recs
                
                matcher.close()
                
                elapsed = time.time() - start_time
                st.success(f"✓ Found {len(matches)} matches in {elapsed:.1f}s")
            
            except Exception as e:
                st.error(f"Error: {e}")

# Results
if st.session_state.matching_jobs:
    st.markdown("---")
    
    # Summary
    df = pd.DataFrame(st.session_state.matching_jobs)
    score_col = 'match_percentage' if 'match_percentage' in df.columns else 'similarity_score'
    
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
    
    # Tabs
    tab1, tab2, tab3 = st.tabs(["Matches", "Analytics", "Recommendations"])
    
    # Tab 1: Matches
    with tab1:
        for i, job in enumerate(st.session_state.matching_jobs, 1):
            score = job.get('match_percentage', job.get('similarity_score', 0) * 100)
            
            with st.container():
                col_left, col_right = st.columns([4, 1])
                
                with col_left:
                    st.markdown(f"**{job['title']}**")
                    st.caption(f"{job['company']} • {job.get('location', 'Remote')} • {job['source']}")
                
                with col_right:
                    st.metric("Match", f"{score:.0f}%")
                
                with st.expander("Details"):
                    if job.get('description'):
                        st.text(job['description'][:500])
                    if job.get('url'):
                        st.markdown(f"[View Job →]({job['url']})")
                
                if i < len(st.session_state.matching_jobs):
                    st.markdown("---")
    
    # Tab 2: Analytics
    with tab2:
        if score_col in df.columns:
            st.bar_chart(df.set_index('title')[score_col] * 100)
            st.markdown("**Top Companies**")
            st.bar_chart(df['company'].value_counts().head(10))
    
    # Tab 3: Recommendations
    with tab3:
        if st.session_state.recommendations and st.session_state.recommendations.get('recommendations'):
            recs = st.session_state.recommendations
            st.markdown(f"Based on {recs['jobs_analyzed']} jobs")
            
            for rec in recs['recommendations'][:15]:
                st.markdown(f"**{rec['skill']}** - {rec['percentage']:.0f}% of jobs")
                st.progress(min(rec['percentage'] / 100, 1.0))
        else:
            st.info("Recommendations will appear after matching")
