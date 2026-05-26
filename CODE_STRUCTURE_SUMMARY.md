# Code Structure Summary

This document summarizes the layout and purpose of the main folders and key files in this repository.

## Project root
- `Dockerfile`, `Dockerfile.base`, `docker-compose.yml`: Docker build and compose definitions.
- `Makefile`, `LOCAL_SETUP.md`, `README.md`, `DOCUMENTATION.md`: Dev/run docs and helper tasks.
- `package.json`: root JS scripts (if present).
- `requirements.txt`: Python dependencies.

## `api/` (Python backend entrypoints)
- `main.py`: API application entry (ASGI/WSGI startup).
- `email_service.py`: Email sending utilities.
- `job_alerts_scheduler.py`: Background job alert scheduler.
- `skills_gap_service.py`: Services for skills-gap processing.
- `__init__.py`: Package init.

## `app/` (core backend application logic)
- `database/`
  - `db.py`: Database connection and helpers.
- `models/`
  - `scraper_source.py`: ORM model(s) for scraper sources and related entities.
- `routes/`
  - `admin_scrapers.py`: Admin routes for managing scrapers.
- `services/` (business logic and ingestion)
  - `dynamic_scraper_loader.py`: Loads scraper implementations dynamically.
  - `embedding_service.py`: Embedding generation and storage helpers.
  - `scraper_service.py`: Scraper orchestration and fetch logic.
  - `skill_extraction_service.py`: Extracts skills from text/CVs.
  - `user_profile_service.py`: User profile management and utilities.
  - `vector_matching_service.py`: Vector DB matching and similarity functions.
  - `Scrapers/`: Concrete scraper implementations (many modules).
- `__init__.py`: Package init.

## `utils/`
- `pdf_utils.py`: PDF parsing and text extraction helpers.

## `scripts/` (tooling and utilities)
- `scheduled_scraper.py`, `setup_vector_tables.py`, `generate_slugs.py`, `integrated_job_matcher_app.py`, etc.: one-off scripts and cron-style tasks.

## `frontend/` (Next.js React frontend)
- Top-level configuration: `next.config.mjs`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs`.
- `package.json`: frontend dependencies and scripts.
- `app/`: Next.js App Router pages and nested routes (e.g. `admin/`, `dashboard/`, `jobs/`, `profile/`, `match/`, etc.).
- `components/`: Reusable React components (UI elements, cards, modals, canvas backgrounds, etc.).
- `context/`: React contexts (e.g. `AuthContext.tsx`, `ToastContext.tsx`).
- `hooks/`: Custom hooks (e.g. `useInView.ts`).
- `lib/`: Client helpers (`api.ts`, `auth-context.tsx`, `utils.ts`).
- `public/`: Static assets.
- `types/`: TypeScript types.

## Other folders
- `uploads/`: File uploads and user-submitted files.
- `logs/`: Log files and statuses (e.g. `scraper_status.json`).

## How the pieces fit together (high level)
- Backend services in `app/` implement scraping, embedding, skill extraction, and vector matching.
- `api/` provides ASGI endpoints and scheduled/background tasks tying services together.
- `frontend/` is the user interface built with Next.js and consumes the backend APIs.
- `scripts/` provide utilities to bootstrap or run one-off processes.
- Docker files and `docker-compose.yml` provide containerized development and deployment flows.

## Quick local run notes
- Python deps: `pip install -r requirements.txt`
- Start backend (example): `uvicorn api.main:app --reload`
- Frontend: `cd frontend && npm install && npm run dev`
- Or run `docker-compose up --build` for full stack locally (see `LOCAL_SETUP.md`).

## Key files to inspect first
- Backend entry: `api/main.py`
- DB helpers: `app/database/db.py`
- Scraper implementations: `app/services/Scrapers/`
- Frontend entry: `frontend/app/page.tsx` (or top-level Next pages)

---
If you want, I can: (a) update the existing `README.md` with this summary, (b) generate a markdown diagram, or (c) create a short runbook with exact commands for Windows. Let me know which you prefer.