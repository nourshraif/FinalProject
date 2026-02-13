"""
Streamlit UI to test the CV skill extraction pipeline.

Run with:
    streamlit run scripts/run_skill_extraction_ui.py
"""
import os
import sys
import tempfile
from typing import Optional, List

# Ensure project root is on sys.path when running via Streamlit
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import streamlit as st
from dotenv import load_dotenv

from app.utils.pdf_utils import extract_text_from_pdf
from app.services.skill_extraction_service import (
    call_huggingface_api,
    parse_skills_from_response,
)


# Load environment variables from .env in the pr sceioject root
load_dotenv()


def extract_skills_from_cv_text(cv_text: str, model_name: Optional[str] = None) -> List[str]:
    """
    Orchestrate the skill extraction pipeline for raw CV text.
    """
    api_response = call_huggingface_api(cv_text=cv_text, model_name=model_name)
    if not api_response:
        return []
    return parse_skills_from_response(api_response)


def main() -> None:
    st.set_page_config(page_title="CV Skill Extraction", layout="centered")

    st.title("CV Skill Extraction")
    st.markdown(
        "Upload a CV in PDF format, extract its text, and run the skill extraction pipeline."
    )

    # Upload section
    st.markdown("### Upload CV PDF")
    uploaded_file = st.file_uploader(
        "Choose a CV PDF file",
        type=["pdf"],
        help="Upload a PDF file containing the CV you want to analyze.",
    )

    # Optional: allow custom model override via sidebar
    with st.sidebar:
        st.header("Settings")
        default_model = os.getenv("HF_MODEL", "openai/gpt-oss-120b:groq")
        use_custom_model = st.checkbox(
            "Use custom model name", help="Override the HF_MODEL from your .env"
        )
        if use_custom_model:
            model_name = st.text_input(
                "Model name",
                value=default_model,
                help="Full Hugging Face model name, e.g. mistralai/Mistral-7B-Instruct-v0.2",
            )
        else:
            model_name = default_model

    # State placeholders
    extracted_text: Optional[str] = None
    skills: List[str] = []

    # Extract button
    st.markdown("### Extract")
    extract_button = st.button(
        "Run Skill Extraction",
        type="primary",
        use_container_width=True,
        disabled=uploaded_file is None,
    )

    if extract_button:
        if uploaded_file is None:
            st.error("Please upload a PDF file first.")
            return

        # Save uploaded file temporarily on disk
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
            tmp_file.write(uploaded_file.getbuffer())
            temp_path = tmp_file.name

        try:
            with st.spinner("Extracting text from PDF..."):
                with open(temp_path, "rb") as f:
                    extracted_text = extract_text_from_pdf(f)

            if not extracted_text:
                st.error("Failed to extract text from the uploaded PDF.")
                return

            with st.spinner("Running skill extraction..."):
                try:
                    skills = extract_skills_from_cv_text(
                        cv_text=extracted_text,
                        model_name=model_name,
                    )
                except Exception as e:
                    st.error(f"Error while calling the skill extraction service: {e}")
                    return

            # Results section
            st.markdown("### Results")
            st.success(f"Extracted {len(skills)} skills.")

            if skills:
                st.markdown("#### Skills")
                for skill in skills:
                    st.markdown(f"- **{skill}**")

            with st.expander("View extracted CV text"):
                st.text_area(
                    "CV Text",
                    extracted_text,
                    height=250,
                    label_visibility="collapsed",
                )

        finally:
            # Clean up temp file
            try:
                os.remove(temp_path)
            except OSError:
                pass


if __name__ == "__main__":
    main()

