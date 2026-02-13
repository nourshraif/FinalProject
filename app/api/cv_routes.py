"""
CV-related API orchestration.

These helpers are framework-agnostic and can be wrapped by a web
framework (FastAPI, Flask, etc.) to expose HTTP endpoints.
"""

from typing import Optional, List

from app.services.skill_extraction_service import (
    call_huggingface_api,
    parse_skills_from_response,
)
from app.utils.pdf_utils import extract_text_from_pdf


def extract_skills_from_pdf_file(pdf_file, model_name: Optional[str] = None) -> List[str]:
    """
    High-level helper that takes a PDF file-like object and returns
    extracted skills using the underlying services.
    """
    cv_text = extract_text_from_pdf(pdf_file)
    if not cv_text:
        return []

    api_response = call_huggingface_api(cv_text=cv_text, model_name=model_name)
    if not api_response:
        return []

    return parse_skills_from_response(api_response)

