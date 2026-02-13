"""
Matching-related API orchestration.

This module exposes helper functions for performing skill matching
using the underlying matching service.
"""

from typing import List, Dict

from app.services.matching_service import match_skills


def match_cv_to_job_skills(cv_skills: List[str], job_skills: List[str]) -> List[Dict]:
    """
    Convenience wrapper around the matching service suitable for
    plugging into an HTTP handler or CLI.
    """

    return match_skills(cv_skills=cv_skills, job_skills=job_skills)

