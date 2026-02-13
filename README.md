## FinalProject Backend & CV Skill App

This repository contains:
- **Core backend layers** under `app/` (services, api, database, utils)
- **Streamlit CV Skill Extractor** under `cv_skill_app/`
- **Standalone scripts** under `scripts/` for scraping and matching

### Project Structure

- **app/**
  - **main.py**: Backend entrypoint skeleton (for future FastAPI/Flask or Docker usage)
  - **api/**
    - **cv_routes.py**: Orchestration helpers for CV/skill extraction
    - **job_routes.py**: Orchestration helpers for job scraping
    - **matching_routes.py**: Orchestration helpers for skill matching
  - **services/**
    - **skill_extraction_service.py**: Calls Hugging Face / OpenAI-compatible API and parses skills
    - **scraper_service.py**: Daleel Madani job scraping and DB insertion
    - **matching_service.py**: Skill matching with sentence-transformers + cosine similarity
    - **embedding_service.py**: Centralized embedding model factory
  - **database/**
    - **db.py**: PostgreSQL connection helper
    - **models.py**: Placeholder for future ORM models
  - **utils/**
    - **pdf_utils.py**: PDF text extraction utilities

- **scripts/**
  - **run_scraper.py**: Runs the Daleel Madani scraper via services
  - **run_matching.py**: Runs a sample skill matching session

- **cv_skill_app/**
  - **app.py**: Streamlit UI, now calling into `app.services` and `app.utils`
  - **main.py**, **pdf_utils.py**: Thin compatibility wrappers around the new services/utils

- **JOB/** and **matching/**
  - Contain legacy files that now delegate to the new `app/` services so older imports still work.

### How to Install

From the repository root:

```bash
pip install -r requirements.txt
```

### How to Run

- **Streamlit CV Skill Extractor**
  ```bash
  streamlit run cv_skill_app/app.py
  ```

- **Run matching demo script**
  ```bash
  python -m scripts.run_matching
  # or
  python scripts/run_matching.py
  ```

- **Run Daleel Madani scraper**
  ```bash
  python -m scripts.run_scraper
  # or
  python scripts/run_scraper.py
  ```

### Notes

- All **business logic** (scraping, matching, skill extraction, PDF parsing, DB connection)
  now lives under `app/services`, `app/utils`, and `app/database`.
- Older modules (`cv_skill_app/main.py`, `cv_skill_app/pdf_utils.py`, `JOB/db.py`,
  `JOB/daleel_scraper.py`, `matching/similarity.py`, `run_matching.py`) are kept as
  lightweight wrappers so existing imports and scripts continue to work without changes.

