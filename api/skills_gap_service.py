import json
import os
import re
from typing import List, Dict, Any


try:
    import anthropic as anthropic_sdk
except Exception:
    anthropic_sdk = None


def _call_hf_for_gap(prompt: str) -> str:
    """Fallback to Hugging Face router when Anthropic is unavailable."""
    hf_token = os.getenv("HF_TOKEN")
    hf_model = os.getenv("HF_CHAT_MODEL") or os.getenv("HF_MODEL") or "openai/gpt-oss-120b:groq"
    if not hf_token:
        raise ValueError("No AI provider configured (missing ANTHROPIC_API_KEY and HF_TOKEN).")

    try:
        from openai import OpenAI

        client = OpenAI(
            base_url="https://router.huggingface.co/v1",
            api_key=hf_token,
        )
        completion = client.chat.completions.create(
            model=hf_model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=3000,
            temperature=0.2,
        )
        if completion.choices and completion.choices[0].message and completion.choices[0].message.content:
            return completion.choices[0].message.content.strip()
    except Exception as e:
        raise ValueError(f"HF fallback failed: {e}") from e

    raise ValueError("HF fallback returned empty response")


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

    if client:
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=3000,
            messages=[{"role": "user", "content": prompt}],
        )
        response_text = message.content[0].text.strip()
    else:
        response_text = _call_hf_for_gap(prompt)

    cleaned = re.sub(r"```json|```", "", response_text).strip()
    return json.loads(cleaned)
