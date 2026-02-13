"""
PDF Utilities Module

This module contains functions for extracting text from PDF files.
"""

import pypdf
from typing import Optional


def extract_text_from_pdf(pdf_file) -> Optional[str]:
    """
    Extract text content from a PDF file.

    Args:
        pdf_file: File-like object (e.g., from Streamlit file uploader)

    Returns:
        str: Extracted text from the PDF, or None if extraction fails
    """
    try:
        # Create a PDF reader object
        pdf_reader = pypdf.PdfReader(pdf_file)

        # Extract text from all pages
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"

        return text.strip()

    except Exception as e:
        print(f"Error extracting text from PDF: {e}")
        return None

