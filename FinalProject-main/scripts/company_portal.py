"""
Company Portal - Streamlit Page

Companies enter the skills they need and the system returns ranked candidates
from the talent pool (job seekers who uploaded their CVs and saved their profiles).
"""

import sys
from pathlib import Path

project_root = Path(__file__).parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

import streamlit as st
from dotenv import load_dotenv

load_dotenv(project_root / ".env")

from app.services.user_profile_service import (
    find_matching_candidates,
    log_company_search,
    get_all_profiles,
    get_profile_count,
)

# ============================================================================
# PAGE CONFIG
# ============================================================================
st.set_page_config(
    page_title="Company Portal | Talent Search",
    page_icon="🏢",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown("""
<style>
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    header {visibility: hidden;}
    .main .block-container { padding-top: 3rem; max-width: 1200px; }
    h1 { font-size: 2rem; font-weight: 600; color: #1a1a1a; }
    h2 { font-size: 1.5rem; font-weight: 600; color: #2a2a2a; margin-top: 2rem; }
    h3 { font-size: 1.25rem; font-weight: 600; color: #333; }
    hr { margin: 2rem 0; border: none; border-top: 1px solid #e5e5e5; }

    /* Candidate card */
    .candidate-card {
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        padding: 1.2rem 1.5rem;
        margin-bottom: 1rem;
    }
    .match-badge {
        background: #dcfce7;
        color: #166534;
        font-weight: 700;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 0.9rem;
    }
    .skill-chip {
        display: inline-block;
        background: #dbeafe;
        color: #1e40af;
        padding: 2px 10px;
        border-radius: 14px;
        font-size: 0.78rem;
        margin: 2px;
    }
    .matched-chip {
        display: inline-block;
        background: #bbf7d0;
        color: #14532d;
        padding: 2px 10px;
        border-radius: 14px;
        font-size: 0.78rem;
        margin: 2px;
    }
</style>
""", unsafe_allow_html=True)


# ============================================================================
# SESSION STATE
# ============================================================================
if "company_results" not in st.session_state:
    st.session_state.company_results = None
if "last_required_skills" not in st.session_state:
    st.session_state.last_required_skills = []


# ============================================================================
# SIDEBAR
# ============================================================================
with st.sidebar:
    st.title("🏢 Company Portal")
    st.markdown("---")
    candidate_count = get_profile_count()
    st.metric("Candidates in Pool", candidate_count)
    st.markdown("---")
    st.subheader("Search Settings")
    top_k = st.slider("Max Candidates", 5, 50, 15, 5)
    min_matches = st.slider("Min Skill Matches", 1, 10, 1)
    use_semantic = st.toggle("Semantic Matching (AI)", value=True,
                             help="Use vector embeddings for smarter skill matching")
    st.markdown("---")

    # Admin: show all profiles
    with st.expander("🔍 View All Candidates (Admin)"):
        if st.button("Load All Profiles"):
            profiles = get_all_profiles(limit=50)
            if profiles:
                for p in profiles:
                    st.markdown(f"**{p['full_name']}** — {p['email']}")
                    st.caption(", ".join(p["skills"][:8]))
                    st.markdown("---")
            else:
                st.info("No profiles yet.")


# ============================================================================
# MAIN
# ============================================================================
st.title("🏢 Talent Search")
st.markdown("Find candidates whose skills match your requirements from our talent pool.")

st.markdown("---")

# ── Company Info ─────────────────────────────────────────────────────────
st.subheader("1. Company Information")
company_name = st.text_input("Company Name", placeholder="e.g. Acme Corp")

st.markdown("---")

# ── Required Skills ───────────────────────────────────────────────────────
st.subheader("2. Required Skills")
st.caption("Enter the skills you are looking for in candidates.")

col_text, col_chips = st.columns([3, 2])

with col_text:
    skills_input = st.text_area(
        "Enter skills (one per line or comma-separated)",
        placeholder="Python\nMachine Learning\nPostgreSQL\nDocker",
        height=160,
        label_visibility="collapsed",
    )

with col_chips:
    # Quick-add common skill chips
    st.markdown("**Quick add:**")
    quick_skills = [
        "Python", "JavaScript", "React", "Node.js",
        "SQL", "PostgreSQL", "MongoDB", "Docker",
        "Kubernetes", "AWS", "Machine Learning", "Deep Learning",
        "Django", "Flask", "TypeScript", "Java", "C++", "Git",
        "REST API", "GraphQL", "Agile", "Scrum",
    ]
    selected_quick = []
    cols = st.columns(3)
    for i, skill in enumerate(quick_skills):
        with cols[i % 3]:
            if st.checkbox(skill, key=f"quick_{skill}"):
                selected_quick.append(skill)

st.markdown("---")

# ── Search Button ─────────────────────────────────────────────────────────
if st.button("🔍 Search Candidates", type="primary", use_container_width=True):
    # Parse skills
    raw_skills = []
    if skills_input.strip():
        for line in skills_input.replace(",", "\n").split("\n"):
            s = line.strip()
            if s:
                raw_skills.append(s)
    raw_skills += selected_quick

    # Deduplicate
    seen = set()
    required_skills = []
    for s in raw_skills:
        if s.lower() not in seen:
            seen.add(s.lower())
            required_skills.append(s)

    if not required_skills:
        st.warning("⚠️ Please enter at least one required skill.")
    elif candidate_count == 0:
        st.error("❌ No candidates in the talent pool yet. Ask job seekers to upload their CVs first.")
    else:
        with st.spinner(f"Searching {candidate_count} candidates..."):
            try:
                query_embedding = None
                if use_semantic:
                    from sentence_transformers import SentenceTransformer
                    model = SentenceTransformer("all-MiniLM-L6-v2")
                    skills_text = "Professional skills: " + ", ".join(required_skills)
                    query_embedding = model.encode(skills_text, convert_to_numpy=True)

                results = find_matching_candidates(
                    required_skills=required_skills,
                    query_embedding=query_embedding,
                    top_k=top_k,
                    min_keyword_matches=min_matches,
                )

                st.session_state.company_results = results
                st.session_state.last_required_skills = required_skills

                # Log search
                if company_name:
                    log_company_search(company_name, required_skills)

                st.success(f"✅ Found **{len(results)}** matching candidate(s)")

            except Exception as e:
                st.error(f"Error during search: {e}")

# ============================================================================
# RESULTS
# ============================================================================
if st.session_state.company_results is not None:
    results = st.session_state.company_results
    required = st.session_state.last_required_skills

    if not results:
        st.info("No candidates matched the required skills. Try lowering the minimum matches or adding more skills.")
    else:
        st.markdown("---")
        st.subheader(f"3. Matching Candidates ({len(results)} found)")

        # Summary metrics
        avg_score = sum(r["combined_score"] for r in results) / len(results)
        best_score = max(r["combined_score"] for r in results)
        col1, col2, col3 = st.columns(3)
        col1.metric("Candidates Found", len(results))
        col2.metric("Avg Match Score", f"{avg_score:.1f}%")
        col3.metric("Best Match", f"{best_score:.1f}%")

        st.markdown("---")

        # Required skills display
        st.markdown("**You searched for:** " + " ".join(
            f'<span class="skill-chip">{s}</span>' for s in required
        ), unsafe_allow_html=True)
        st.markdown("")

        # Candidate cards
        for rank, candidate in enumerate(results, 1):
            score = candidate["combined_score"]
            matched = candidate["matched_skills"]
            all_skills = candidate["skills"]

            # Colour badge based on score
            if score >= 70:
                badge_color = "#dcfce7"
                text_color = "#166534"
            elif score >= 40:
                badge_color = "#fef9c3"
                text_color = "#713f12"
            else:
                badge_color = "#fee2e2"
                text_color = "#991b1b"

            with st.container():
                st.markdown(
                    f"""
                    <div class="candidate-card">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div>
                                <span style="font-size:1.1rem; font-weight:700;">
                                    #{rank}  {candidate['full_name']}
                                </span>
                                &nbsp;&nbsp;
                                <span style="color:#555; font-size:0.9rem;">📧 {candidate['email']}</span>
                            </div>
                            <span style="background:{badge_color}; color:{text_color};
                                         font-weight:700; padding:5px 14px;
                                         border-radius:20px; font-size:0.95rem;">
                                {score:.0f}% match
                            </span>
                        </div>
                    </div>
                    """,
                    unsafe_allow_html=True,
                )

                with st.expander(f"View details — {candidate['full_name']}"):
                    col_a, col_b = st.columns(2)
                    with col_a:
                        st.markdown("**✅ Matched Skills**")
                        if matched:
                            st.markdown(" ".join(
                                f'<span class="matched-chip">{s}</span>' for s in matched
                            ), unsafe_allow_html=True)
                        else:
                            st.caption("Matched via semantic similarity")

                    with col_b:
                        st.markdown("**🧠 All Skills**")
                        if all_skills:
                            st.markdown(" ".join(
                                f'<span class="skill-chip">{s}</span>' for s in all_skills[:20]
                            ), unsafe_allow_html=True)
                            if len(all_skills) > 20:
                                st.caption(f"+ {len(all_skills) - 20} more skills")

                    st.markdown("")
                    sc1, sc2 = st.columns(2)
                    sc1.metric("Keyword Match", f"{candidate['keyword_score']:.1f}%")
                    sc2.metric("Semantic Match", f"{candidate['vector_score']:.1f}%")

                    if candidate.get("cv_filename"):
                        st.caption(f"📄 CV: {candidate['cv_filename']}")
                    if candidate.get("created_at"):
                        st.caption(f"🗓️ Registered: {candidate['created_at'].strftime('%Y-%m-%d')}")

        st.markdown("---")
        st.caption("💡 Tip: Contact candidates directly via email shown above.")
