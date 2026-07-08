"""
Infer a user's major/primary role from CV skills + profile headline,
then use that label to boost job titles that contain the same role.
"""

from __future__ import annotations

import re
from typing import List, Optional, Sequence, Tuple


# Ordered: more specific phrases first within each role's terms.
PRIMARY_ROLE_CATALOG: List[dict] = [
    {
        "label": "Nurse",
        "family": "nursing_clinical",
        "terms": [
            "registered nurse",
            "staff nurse",
            "clinical nurse",
            "icu nurse",
            "adult nursing",
            "nursing",
            "nurse",
            "midwife",
            "midwifery",
            "nmc",
        ],
    },
    {
        "label": "Pharmacist",
        "family": "pharmacy",
        "terms": [
            "clinical pharmacist",
            "pharmacist",
            "pharmacy",
            "pharmd",
            "pharmacology",
        ],
    },
    {
        "label": "Physician",
        "family": "physician",
        "terms": [
            "general practitioner",
            "medical doctor",
            "physician",
            "surgeon",
            "doctor",
        ],
    },
    {
        "label": "Physiotherapist",
        "family": "allied_health",
        "terms": [
            "physiotherapist",
            "physiotherapy",
            "physical therapist",
        ],
    },
    {
        "label": "Dentist",
        "family": "dental",
        "terms": ["dentist", "dental", "orthodontist"],
    },
    {
        "label": "Software Engineer",
        "family": "software_engineering",
        "terms": [
            "software engineer",
            "software developer",
            "full stack developer",
            "fullstack developer",
            "backend developer",
            "frontend developer",
            "web developer",
            "mobile developer",
            "devops engineer",
            "programmer",
            "software",
            "developer",
        ],
    },
    {
        "label": "Data Scientist",
        "family": "data_ai",
        "terms": [
            "data scientist",
            "machine learning engineer",
            "ml engineer",
            "data analyst",
            "data engineer",
            "ai engineer",
        ],
    },
    {
        "label": "Teacher",
        "family": "education",
        "terms": [
            "special education",
            "teacher",
            "teaching",
            "tutor",
            "lecturer",
            "instructor",
            "educator",
        ],
    },
    {
        "label": "Accountant",
        "family": "finance_accounting",
        "terms": [
            "accountant",
            "accounting",
            "auditor",
            "financial analyst",
            "bookkeeper",
        ],
    },
    {
        "label": "Sales Representative",
        "family": "sales_marketing",
        "terms": [
            "sales representative",
            "account executive",
            "business development",
            "sales manager",
            "sales",
            "marketing",
        ],
    },
    {
        "label": "HR Specialist",
        "family": "hr_admin",
        "terms": [
            "human resources",
            "talent acquisition",
            "recruiter",
            "hr manager",
            "hr specialist",
        ],
    },
]


def _normalize_blob(parts: Sequence[str]) -> str:
    return " ".join(str(p or "").strip().lower() for p in parts if str(p or "").strip())


def _term_in_text(term: str, text: str) -> bool:
    term = (term or "").strip().lower()
    if not term or not text:
        return False
    # Prefer word-boundary match; fall back to substring for multi-word / short codes.
    if " " in term or len(term) <= 3:
        return term in text
    return bool(re.search(rf"\b{re.escape(term)}\b", text))


def infer_primary_role(
    skills: Optional[Sequence[str]] = None,
    headline: Optional[str] = None,
    extra_text: Optional[str] = None,
) -> Tuple[Optional[str], List[str]]:
    """
    Pick the user's major role from skills + headline.

    Returns:
        (label, match_terms) e.g. ("Nurse", ["registered nurse", "nurse", ...])
        or (None, []) if nothing confident.
    """
    skills = [str(s).strip() for s in (skills or []) if str(s).strip()]
    headline = (headline or "").strip()
    extra_text = (extra_text or "").strip()

    skill_blob = _normalize_blob(skills)
    headline_blob = headline.lower()
    combined = _normalize_blob([headline, extra_text, *skills])
    if not combined:
        return None, []

    best_label: Optional[str] = None
    best_terms: List[str] = []
    best_score = 0.0

    for role in PRIMARY_ROLE_CATALOG:
        terms: List[str] = list(role["terms"])
        score = 0.0
        # Headline / target-title signal is strongest (user's stated role).
        for term in terms:
            if _term_in_text(term, headline_blob):
                # Longer phrase = more specific.
                score += 4.0 + min(2.0, len(term.split()))
                break
        for term in terms:
            if _term_in_text(term, skill_blob):
                score += 2.0 + 0.35 * min(3, len(term.split()))
        # Soft presence anywhere in combined blob
        if score == 0:
            for term in terms:
                if _term_in_text(term, combined):
                    score += 1.0
                    break

        if score > best_score:
            best_score = score
            best_label = str(role["label"])
            best_terms = terms

    # Require a minimum signal so random skill lists don't invent a role.
    if best_score < 2.0:
        return None, []
    return best_label, best_terms


def primary_role_in_title(title: str, role_terms: Sequence[str]) -> bool:
    """True if the job title contains the primary role (or a synonym)."""
    title_l = (title or "").lower()
    if not title_l or not role_terms:
        return False
    # Prefer longer terms first so "clinical pharmacist" beats "pharmacist" ordering
    # but any hit is enough.
    sorted_terms = sorted(role_terms, key=lambda t: len(t), reverse=True)
    return any(_term_in_text(term, title_l) for term in sorted_terms)
