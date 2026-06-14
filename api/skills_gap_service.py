import json
import os
import re
from typing import List, Dict, Any


try:
    import anthropic as anthropic_sdk
except Exception:
    anthropic_sdk = None


def _skills_overlap(user_skill: str, job_skill: str) -> bool:
    u = user_skill.strip().lower()
    j = job_skill.strip().lower()
    if not u or not j:
        return False
    if u == j or u in j or j in u:
        return True
    u_tokens = set(re.findall(r"[a-z0-9+#.]+", u))
    j_tokens = set(re.findall(r"[a-z0-9+#.]+", j))
    return bool(u_tokens & j_tokens)


def _analyze_gap_locally(
    user_skills: List[str],
    job_title: str,
    job_description: str,
    job_requirements: str = "",
) -> Dict[str, Any]:
    """Rule-based gap analysis when AI providers are unreachable."""
    from app.services.skill_extraction_service import fallback_extract_skills, normalize_skills_list

    job_text = "\n".join(
        part for part in (job_title, job_description, job_requirements) if part and part.strip()
    )
    job_skills = normalize_skills_list(fallback_extract_skills(job_text))

    if not job_skills:
        # Last resort: treat notable user skills as context-only
        job_skills = normalize_skills_list(user_skills[:8])

    matched: List[str] = []
    missing_raw: List[str] = []
    for skill in job_skills:
        if any(_skills_overlap(user, skill) for user in user_skills):
            matched.append(skill)
        else:
            missing_raw.append(skill)

    total = max(len(job_skills), 1)
    match_pct = int(round((len(matched) / total) * 100))
    match_pct = max(0, min(100, match_pct))

    missing_skills = []
    for i, skill in enumerate(missing_raw[:8]):
        missing_skills.append(
            {
                "skill": skill,
                "importance": "high" if i < 2 else "medium" if i < 5 else "low",
                "reason": f"Mentioned in the job posting but not found in your profile.",
                "time_to_learn": "4-8 weeks" if i < 3 else "2-3 months",
                "difficulty": "intermediate",
                "resources": [],
            }
        )

    strengths = matched[:6]
    if user_skills and not strengths:
        strengths = user_skills[:4]

    priority_path = [
        f"Focus on {item['skill']} ({item['importance']} priority)"
        for item in missing_skills[:3]
    ]
    if not priority_path:
        priority_path = ["Your profile already covers the main skills listed for this role."]

    ready = "1-2 months" if match_pct >= 70 else "2-4 months" if match_pct >= 45 else "3-6 months"

    if match_pct >= 75:
        assessment = (
            f"Strong alignment for {job_title or 'this role'} — you match {len(matched)} of "
            f"{len(job_skills)} key skills detected in the posting."
        )
    elif match_pct >= 45:
        assessment = (
            f"Moderate fit for {job_title or 'this role'}. Closing {len(missing_skills)} skill "
            f"gap(s) would significantly improve your competitiveness."
        )
    else:
        assessment = (
            f"Significant upskilling needed for {job_title or 'this role'}. Prioritise the "
            f"missing skills below before applying."
        )

    assessment += " (Local analysis — AI service was unavailable.)"

    return {
        "match_percentage": match_pct,
        "matched_skills": matched,
        "missing_skills": missing_skills,
        "overall_assessment": assessment,
        "estimated_ready_in": ready,
        "priority_learning_path": priority_path,
        "strengths": strengths,
    }


def _is_auth_or_config_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    return any(
        token in msg
        for token in ("401", "403", "unauthorized", "invalid username or password", "invalid token")
    )


def _call_hf_for_gap(prompt: str) -> str:
    """Call Hugging Face router for skills gap JSON."""
    hf_token = os.getenv("HF_TOKEN")
    hf_model = os.getenv("HF_CHAT_MODEL") or os.getenv("HF_MODEL") or "openai/gpt-oss-120b:groq"
    if not hf_token:
        raise ValueError("No AI provider configured (missing ANTHROPIC_API_KEY and HF_TOKEN).")

    from openai import OpenAI

    client = OpenAI(
        base_url="https://router.huggingface.co/v1",
        api_key=hf_token,
        timeout=15.0,
    )
    completion = client.chat.completions.create(
        model=hf_model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=3000,
        temperature=0.2,
    )
    if completion.choices and completion.choices[0].message and completion.choices[0].message.content:
        return completion.choices[0].message.content.strip()

    raise ValueError("HF fallback returned empty response")


def _parse_gap_json(response_text: str) -> Dict[str, Any]:
    cleaned = re.sub(r"```json|```", "", response_text).strip()
    return json.loads(cleaned)


def analyze_job_specific_gap(
    user_skills: List[str],
    job_title: str,
    job_description: str,
    job_requirements: str = "",
) -> Dict[str, Any]:
    skills_list = ", ".join(user_skills) if user_skills else "None"

    job_text = f"""
Job Title: {job_title}
Description: {job_description[:2000]}
Requirements: {job_requirements[:1000]}
"""

    prompt = f"""You are an expert career coach.
Analyze the skill gap between a candidate and
a specific job posting.

CANDIDATE SKILLS:
{skills_list}

JOB POSTING:
{job_text}

Respond with ONLY valid JSON in this exact format:
{{
    "match_percentage": 75,
    "matched_skills": ["Python", "SQL"],
    "missing_skills": [
        {{
            "skill": "Kubernetes",
            "importance": "high",
            "reason": "Required for deployment",
            "time_to_learn": "2-3 months",
            "difficulty": "intermediate",
            "resources": [
                {{
                    "title": "Kubernetes Basics",
                    "platform": "YouTube",
                    "url": "https://youtube.com",
                    "duration": "4 hours",
                    "is_free": true
                }}
            ]
        }}
    ],
    "overall_assessment": "You are a good fit...",
    "estimated_ready_in": "2-3 months",
    "priority_learning_path": [
        "Learn Kubernetes first"
    ],
    "strengths": ["Strong Python background"]
}}

Return ONLY the JSON. No other text."""

    anthropic_key = os.getenv("ANTHROPIC_API_KEY")
    client = anthropic_sdk.Anthropic(api_key=anthropic_key) if (anthropic_sdk and anthropic_key) else None

    # HF_HUB_OFFLINE only affects embedding model downloads — router API calls still use HF_TOKEN.
    if os.getenv("SKILLS_GAP_OFFLINE", "").strip().lower() in ("1", "true", "yes"):
        return _analyze_gap_locally(
            user_skills=user_skills,
            job_title=job_title,
            job_description=job_description,
            job_requirements=job_requirements,
        )

    try:
        if client:
            message = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=3000,
                messages=[{"role": "user", "content": prompt}],
            )
            response_text = message.content[0].text.strip()
        else:
            response_text = _call_hf_for_gap(prompt)
        return _parse_gap_json(response_text)
    except Exception as e:
        if _is_auth_or_config_error(e):
            raise ValueError(
                "Hugging Face authentication failed. Regenerate HF_TOKEN at "
                "https://huggingface.co/settings/tokens (needs Inference Providers access) "
                "and restart the backend."
            ) from e
        print(f"[skills-gap] AI analysis unavailable ({e}), using local fallback")
        return _analyze_gap_locally(
            user_skills=user_skills,
            job_title=job_title,
            job_description=job_description,
            job_requirements=job_requirements,
        )
