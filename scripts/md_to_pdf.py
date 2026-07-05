"""Convert a Markdown file to PDF (HTML intermediate via xhtml2pdf).

Usage:
  python scripts/md_to_pdf.py
  python scripts/md_to_pdf.py path/to/file.md path/to/output.pdf
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _md_to_html(md_text: str) -> str:
    import markdown

    body = markdown.markdown(
        md_text,
        extensions=["tables", "fenced_code", "sane_lists", "nl2br"],
    )
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Vertex Feature Workflows (Code)</title>
  <style>
    @page {{
      size: A4;
      margin: 1.6cm 1.4cm;
    }}
    body {{
      font-family: Helvetica, Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.45;
      color: #111827;
    }}
    h1 {{
      font-size: 20pt;
      color: #1e1b4b;
      border-bottom: 2px solid #6366f1;
      padding-bottom: 6px;
      margin-top: 0;
    }}
    h2 {{
      font-size: 14pt;
      color: #312e81;
      margin-top: 18px;
      page-break-after: avoid;
    }}
    h3 {{
      font-size: 11.5pt;
      color: #3730a3;
      margin-top: 14px;
      page-break-after: avoid;
    }}
    p, li {{
      margin: 4px 0;
    }}
    ul, ol {{
      margin: 6px 0 10px 0;
      padding-left: 18px;
    }}
    blockquote {{
      margin: 10px 0;
      padding: 8px 12px;
      border-left: 4px solid #6366f1;
      background: #f5f3ff;
      color: #374151;
    }}
    code {{
      font-family: Consolas, "Courier New", monospace;
      font-size: 9pt;
      background: #f3f4f6;
      padding: 1px 4px;
      border-radius: 3px;
    }}
    pre {{
      background: #f8fafc;
      border: 1px solid #e5e7eb;
      padding: 10px;
      font-size: 8.5pt;
      line-height: 1.35;
      white-space: pre-wrap;
      word-wrap: break-word;
      page-break-inside: avoid;
    }}
    pre code {{
      background: transparent;
      padding: 0;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0 14px 0;
      font-size: 9pt;
      page-break-inside: avoid;
    }}
    th {{
      background: #eef2ff;
      color: #1e1b4b;
      text-align: left;
      padding: 6px 8px;
      border: 1px solid #c7d2fe;
    }}
    td {{
      padding: 5px 8px;
      border: 1px solid #e5e7eb;
      vertical-align: top;
    }}
    hr {{
      border: none;
      border-top: 1px solid #e5e7eb;
      margin: 16px 0;
    }}
    strong {{
      color: #111827;
    }}
  </style>
</head>
<body>
{body}
</body>
</html>"""


def convert(md_path: Path, pdf_path: Path) -> None:
    from xhtml2pdf import pisa

    md_text = md_path.read_text(encoding="utf-8")
    html = _md_to_html(md_text)

    pdf_path.parent.mkdir(parents=True, exist_ok=True)
    with pdf_path.open("wb") as pdf_file:
        status = pisa.CreatePDF(html, dest=pdf_file, encoding="utf-8")

    if status.err:
        raise RuntimeError(f"PDF generation failed with {status.err} error(s)")


def main() -> int:
    md_path = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "FEATURE_WORKFLOWS_CODE.md"
    pdf_path = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "FEATURE_WORKFLOWS_CODE.pdf"

    if not md_path.is_file():
        print(f"ERROR: Markdown file not found: {md_path}")
        return 1

    convert(md_path, pdf_path)
    print(f"Saved: {pdf_path}")
    print(f"Source: {md_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
