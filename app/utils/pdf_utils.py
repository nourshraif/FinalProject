"""
PDF Utilities Module

Extracts text from PDF files using several engines and keeps the richest
result. Designed / two-column CVs (e.g. Canva templates with a sidebar) are
poorly handled by a single naive extractor, so we try layout-aware engines
first and fall back to pypdf.
"""

from io import BytesIO
from typing import Optional

import pypdf

# If an engine yields at least this many words, treat it as a good extraction
# and stop trying slower engines.
_GOOD_ENOUGH_WORDS = 120


def _read_bytes(pdf_file) -> Optional[bytes]:
    """Accept a path, raw bytes, or a file-like object and return bytes."""
    if pdf_file is None:
        return None
    if isinstance(pdf_file, bytes):
        return pdf_file
    if isinstance(pdf_file, str):
        try:
            with open(pdf_file, "rb") as fh:
                return fh.read()
        except Exception as e:
            print(f"Error reading PDF path: {e}")
            return None
    # File-like object (e.g. BytesIO / UploadFile buffer)
    try:
        try:
            pdf_file.seek(0)
        except Exception:
            pass
        data = pdf_file.read()
        return data if isinstance(data, bytes) else bytes(data)
    except Exception as e:
        print(f"Error reading PDF file object: {e}")
        return None


def _extract_with_pymupdf(data: bytes) -> str:
    """PyMuPDF (fitz): best reading order for multi-column layouts."""
    try:
        import fitz  # PyMuPDF
    except Exception:
        return ""
    try:
        parts = []
        with fitz.open(stream=data, filetype="pdf") as doc:
            for page in doc:
                # sort=True orders text blocks top-to-bottom, left-to-right,
                # which keeps sidebar and main column readable.
                parts.append(page.get_text("text", sort=True) or "")
        return "\n".join(parts).strip()
    except Exception as e:
        print(f"PyMuPDF extraction failed: {e}")
        return ""


def _extract_with_pdfplumber(data: bytes) -> str:
    """pdfplumber: layout-aware extraction built on pdfminer.six."""
    try:
        import pdfplumber
    except Exception:
        return ""
    try:
        parts = []
        with pdfplumber.open(BytesIO(data)) as pdf:
            for page in pdf.pages:
                parts.append(page.extract_text(layout=False) or "")
        return "\n".join(parts).strip()
    except Exception as e:
        print(f"pdfplumber extraction failed: {e}")
        return ""


def _extract_with_pypdf(data: bytes) -> str:
    """pypdf: original engine, kept as final fallback."""
    try:
        reader = pypdf.PdfReader(BytesIO(data))
        parts = []
        for page in reader.pages:
            parts.append(page.extract_text() or "")
        return "\n".join(parts).strip()
    except Exception as e:
        print(f"pypdf extraction failed: {e}")
        return ""


def extract_text_from_pdf(pdf_file) -> Optional[str]:
    """
    Extract text content from a PDF file.

    Tries multiple engines (layout-aware first) and returns the extraction
    with the most words, so designed / multi-column CVs are handled reliably.

    Args:
        pdf_file: Path, bytes, or file-like object.

    Returns:
        str: Extracted text, or None if every engine fails.
    """
    data = _read_bytes(pdf_file)
    if not data:
        return None

    best = ""
    best_words = 0
    for engine in (_extract_with_pymupdf, _extract_with_pdfplumber, _extract_with_pypdf):
        text = engine(data)
        words = len(text.split())
        if words > best_words:
            best, best_words = text, words
        if best_words >= _GOOD_ENOUGH_WORDS:
            break

    return best or None
