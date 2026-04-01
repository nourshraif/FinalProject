# Vertex — Job Matching & Talent Platform

[![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-green.svg)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+%20pgvector-blue.svg)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-green.svg)](https://www.docker.com/)

**Vertex** is a full-stack job matching and talent platform: job seekers can upload CVs, get skill-based job matches, save jobs, and track applications; companies can search candidates by skills, save candidates, and add private notes.

---

## Recent Updates

- Added **company posted-jobs management** APIs and UI flow (create/list/update/delete/toggle active).
- Added **skill-match notifications on job posting** so matching job seekers are notified when a company posts a relevant role.
- Expanded **notifications system** with unread count, mark-read, mark-all-read, and delete.
- Added **contact request workflow** between companies and job seekers (send/receive/respond).
- Added **job alert settings** and test alert endpoint for job seekers.
- Added **public profile sharing** via slug and profile visibility controls.
- Added **Google OAuth** login callback flow and broader auth recovery endpoints.
- Added **Stripe subscription endpoints** and billing webhook handling.
- Added **role-based analytics endpoints** for both job seekers and companies.
- Added **in-app AI chat assistant API** (`POST /api/chat`) used by the chat widget for CV/job/interview guidance.

---

## Table of Contents

- [Technologies Used](#technologies-used)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [How to Run the Project](#how-to-run-the-project)
- [Configuration](#configuration)
- [Project Structure](#project-structure)
- [API Overview](#api-overview)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Technologies Used

### Backend

| Technology | Purpose |
|------------|---------|
| **Python 3.9+** | Backend runtime |
| **FastAPI** | REST API (auth, jobs, candidates, profiles) |
| **Uvicorn** | ASGI server |
| **PostgreSQL 16** | Primary database |
| **pgvector** | Vector embeddings for semantic matching |
| **psycopg2** | PostgreSQL adapter |
| **Sentence Transformers** (all-MiniLM-L6-v2) | Job & skill embeddings (384-dim) |
| **JWT (python-jose)** | Authentication tokens |
| **bcrypt (passlib)** | Password hashing |
| **Hugging Face API** | CV skill extraction |
| **BeautifulSoup4 / Requests** | Job scraping |
| **PyPDF** | PDF text extraction |
| **pandas, NumPy, scikit-learn** | Data processing & ML utilities |

### Frontend

| Technology | Purpose |
|------------|---------|
| **Next.js 14** | React framework, App Router |
| **React 18** | UI |
| **TypeScript** | Type-safe frontend |
| **Tailwind CSS** | Styling |
| **Lucide React** | Icons |
| **Radix UI** (Slot) | Accessible primitives |
| **Sonner** | Toasts |
| **class-variance-authority, clsx, tailwind-merge** | Component styling |

### DevOps & Tools

| Technology | Purpose |
|------------|---------|
| **Docker & Docker Compose** | PostgreSQL + pgvector |
| **Makefile** | Scraper + DB workflow (optional) |

---

## Features

### For Everyone

- **Landing page** — Hero, features, aurora-style background
- **Auth** — Register and login (job seeker or company); JWT-based sessions
- **Responsive UI** — Glass-morphism cards, transparent backgrounds, modern layout
- **AI chat assistant** — Context-aware chat endpoint for CV tips, interview prep, and job-search guidance

### For Job Seekers

- **CV upload** — Upload PDF; skills extracted via Hugging Face API
- **Job matching** — Match jobs by skills (keyword + semantic similarity)
- **Saved jobs** — Bookmark jobs; view and manage saved list with search
- **Application tracker** — Create and update applications (applied, interviewing, offer, rejected, saved); add notes
- **Profile** — Edit headline, bio, location, LinkedIn, years of experience, skills
- **Contact requests inbox** — Receive requests from companies and accept or decline with one click
- **Notifications center** — In-app notifications with unread count, mark-as-read, and delete support
- **Job alerts** — Configurable alert settings (immediate/daily/weekly) and test alert endpoint
- **Public profile link** — Shareable public profile slug with visibility controls
- **Dashboard** — Quick stats and links to match, tracker, saved, profile

### For Companies

- **Company profile** — Company name, website, industry, size, description, contact name
- **Posted jobs management** — Create, list, update, delete, and activate/deactivate company job postings
- **Skill-match notifications on post** — When a company posts a job, matched job seekers receive notifications
- **Candidate search** — Search by required skills; keyword + semantic (vector) matching; configurable top-k and min matches
- **Saved candidates** — Save candidates from search; view saved list with client-side search
- **Private notes** — Add or edit notes per saved candidate (500 chars); notes modal with save/cancel
- **Contact workflow** — Send contact requests to candidates and track sent requests
- **Talent pool (admin)** — View all candidates in the system (email, name, skills, CV filename)
- **Dashboard** — Candidate pool count, saved candidates count, recently saved candidates (last 3), quick skill search, links to search, talent pool, profile

### Platform & Data

- **Job scraping** — Multiple boards (WeWorkRemotely, Indeed, LinkedIn, RemoteOK, Remotive, Arbeitnow, Himalayas, Bayt); idempotent (duplicates skipped)
- **Vector embeddings** — Stored in PostgreSQL with pgvector; used for semantic job and candidate matching
- **Role-based access** — Separate routes and API guards for job seeker vs company
- **Google OAuth** — Google sign-in flow with callback and account bootstrap
- **Email flows** — Welcome, password reset, contact request, acceptance, and alert emails
- **Subscriptions & billing** — Stripe checkout, subscription status, cancel-at-period-end, webhook sync
- **Analytics** — Role-specific analytics endpoints for job seekers and companies

### Admin Panel

- **Internal dashboard** (`/admin`) — Platform stats, user list with search, activate/deactivate users, make admin, recent activity, run scraper. Visible only to users with `is_admin = TRUE`.
- **Make yourself admin (one-time)** — From the host, run (replace `<postgres_container>` with your container name and `your_email_here` with your account email):

```bash
docker exec -it <postgres_container> psql -U postgres -d jobs_db -c "UPDATE users SET is_admin = TRUE WHERE email = 'your_email_here';"
```

---

## Prerequisites

- **Python 3.9+**
- **Node.js 18+** and **npm**
- **Docker** and **Docker Compose** (for PostgreSQL)
- **Hugging Face account** — [Create a token](https://huggingface.co/settings/tokens) for CV skill extraction

---

## How to Run the Project

### 1. Clone and enter the project

```bash
cd path/to/FinalProject   # directory that contains api/, app/, frontend/
```

### 2. Environment setup

```bash
# Copy example env and edit with your values
cp env.example .env
```

Edit `.env` and set at least:

- `DB_PASSWORD` — PostgreSQL password (must match Docker)
- `HF_TOKEN` — Your Hugging Face API token
- `SECRET_KEY` — Optional; used for JWT signing (defaults to a dev value)

See [Configuration](#configuration) for all variables.

### 3. Start the database

```bash
docker compose up -d
```

This starts PostgreSQL with pgvector on the port defined in `.env` (default `5433`).

### 4. Initialize the database (one-time)

From the **project root** (directory containing `api/` and `app/`):

```bash
python app/database/db.py
```

This creates all tables (users, jobs, user_profiles, applications, saved_jobs, saved_candidates, company_profiles, etc.).

### 5. Run the backend (FastAPI)

In a **first terminal**, from the project root:

```bash
# Optional: create and activate a virtual environment
python -m venv venv
# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# Windows (CMD):
venv\Scripts\activate.bat
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the API
uvicorn api.main:app --reload --port 8000
```

- **API base:** http://localhost:8000  
- **Swagger docs:** http://localhost:8000/docs  
- **Health:** http://localhost:8000/health  

**Important:** Run `uvicorn` from the directory that contains the `api` folder. Running from the parent folder can cause `ModuleNotFoundError: No module named 'api'`.

### 6. Run the frontend (Next.js)

In a **second terminal**:

```bash
cd frontend

# First time only: install dependencies
npm install

# Start the dev server
npm run dev
```

- **Frontend:** http://localhost:3000  

### 7. Optional: seed jobs and embeddings

To scrape jobs and fill the database:

```bash
# From project root, with venv activated
python -m scripts.scheduled_scraper
```

To (re)create vector/embedding tables if needed:

```bash
python -m scripts.setup_vector_tables
```

### Summary: two terminals

| Terminal | Location | Command | URL |
|----------|----------|---------|-----|
| 1 (backend) | Project root | `uvicorn api.main:app --reload --port 8000` | http://localhost:8000 |
| 2 (frontend) | `frontend/` | `npm run dev` | http://localhost:3000 |

### Optional: one command (Unix/macOS/Git Bash)

```bash
./scripts/dev.sh
```

Starts both backend and frontend. Stop with `Ctrl+C`.

---

## Configuration

Create `.env` from `env.example`. Main variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | Port (Docker mapping) | `5433` |
| `DB_NAME` | Database name | `jobs_db` |
| `DB_USER` | PostgreSQL user | `postgres` |
| `DB_PASSWORD` | PostgreSQL password | *(set a strong password)* |
| `SECRET_KEY` | JWT signing key | *(long random string in production)* |
| `HF_TOKEN` | Hugging Face API token | *(from [HF settings](https://huggingface.co/settings/tokens))* |
| `HF_MODEL` | Model for skill extraction | `openai/gpt-oss-120b:groq` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | *(from [Google Cloud Console](https://console.cloud.google.com/apis/credentials))* |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | *(same credentials)* |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL | `http://localhost:8000/api/auth/google/callback` (default) |
| `FRONTEND_URL` | Frontend origin for OAuth redirects | `http://localhost:3000` (default) |

Frontend: set `NEXT_PUBLIC_API_URL` in `frontend/.env.local` if the API is not at `http://localhost:8000`.

---

## Project Structure

```
FinalProject/
├── api/
│   ├── __init__.py
│   └── main.py                 # FastAPI app, all routes, auth, company/jobseeker APIs
├── app/
│   ├── database/
│   │   └── db.py               # DB connection, init_database, CRUD (users, jobs, profiles, saved jobs, saved candidates)
│   ├── services/
│   │   ├── scraper_service.py
│   │   ├── embedding_service.py
│   │   ├── vector_matching_service.py
│   │   ├── skill_extraction_service.py
│   │   ├── user_profile_service.py   # Candidate search, find_matching_candidates
│   │   └── Scrapers/                # Per-site job scrapers
│   └── utils/
│       └── pdf_utils.py
├── frontend/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # Landing
│   │   ├── auth/login/         # Login
│   │   ├── auth/register/      # Register (job seeker / company)
│   │   ├── dashboard/           # Role redirect + jobseeker/company dashboards
│   │   ├── match/               # Job seeker: match jobs by skills
│   │   ├── saved/               # Job seeker: saved jobs
│   │   ├── tracker/             # Job seeker: application tracker
│   │   ├── profile/             # Job seeker: profile edit
│   │   ├── company/             # Company landing, search, saved, profile, admin
│   │   ├── layout.tsx, globals.css
│   │   └── ...
│   ├── components/             # Navbar, JobCard, CandidateCard, SaveButton, SaveCandidateButton, etc.
│   ├── context/
│   │   └── AuthContext.tsx     # Auth state, token, user type
│   ├── lib/
│   │   └── api.ts              # All API client functions
│   ├── types/
│   │   └── index.ts            # TS interfaces
│   ├── package.json
│   └── tailwind.config.ts
├── scripts/
│   ├── scheduled_scraper.py    # Scrape jobs → DB + embeddings
│   ├── setup_vector_tables.py  # Create jobs + job_embeddings (if used)
│   ├── integrated_job_matcher_app.py  # Legacy Streamlit UI (optional)
│   ├── company_portal.py
│   └── dev.sh                  # Start backend + frontend (Unix)
├── docker-compose.yml          # PostgreSQL + pgvector
├── requirements.txt
├── env.example
├── Makefile                    # Docker scraper workflow (optional)
└── README.md
```

---

## API Overview

- **Auth:** `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/google`, `GET /api/auth/google/callback`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, `GET /api/auth/me`
- **CV:** `POST /api/upload-cv`, `POST /api/profile/upload-cv`
- **Jobs (scraped):** `POST /api/match-jobs`, `GET /api/jobs/stats`, `GET /api/jobs/search`, `GET /api/jobs/sources`, `GET /api/jobs/locations`
- **Posted jobs (company):** `GET /api/jobs/posted`, `GET /api/jobs/posted/{job_id}`, `POST /api/jobs/posted`, `PUT /api/jobs/posted/{job_id}`, `DELETE /api/jobs/posted/{job_id}`, `PUT /api/jobs/posted/{job_id}/toggle`, `GET /api/company/posted-jobs`
- **Job seeker profile:** `POST /api/jobseeker/save-profile`, `GET /api/profile`, `PUT /api/profile`, `PUT /api/profile/skills`, `GET /api/profile/slug`, `PUT /api/profile/visibility`, `GET /api/public/profile/{slug}`
- **Applications:** `GET /api/applications`, `POST /api/applications`, `PUT /api/applications/{id}`, `DELETE /api/applications/{id}`
- **Saved jobs:** `GET /api/saved-jobs`, `POST /api/saved-jobs/{job_id}`, `DELETE /api/saved-jobs/{job_id}`, `GET /api/saved-jobs/check/{job_id}`
- **Company:** `GET /api/company/profile`, `PUT /api/company/profile`
- **Company candidates:** `POST /api/company/search-candidates`, `GET /api/company/candidate-count`, `GET /api/company/all-candidates`
- **Company saved candidates:** `GET /api/company/saved-candidates`, `POST /api/company/saved-candidates`, `DELETE /api/company/saved-candidates/{candidate_user_id}`, `PUT /api/company/saved-candidates/notes`
- **Contact requests:** `POST /api/contact-requests`, `GET /api/contact-requests/received`, `GET /api/contact-requests/sent`, `PUT /api/contact-requests/{request_id}`
- **Notifications:** `GET /api/notifications`, `GET /api/notifications/unread-count`, `PUT /api/notifications/{notification_id}/read`, `PUT /api/notifications/read-all`, `DELETE /api/notifications/{notification_id}`
- **Alerts:** `GET /api/alerts/settings`, `PUT /api/alerts/settings`, `POST /api/alerts/test`
- **Payments:** `POST /api/payments/create-checkout`, `GET /api/payments/subscription`, `POST /api/payments/cancel`, `POST /api/payments/webhook`
- **Analytics:** `GET /api/analytics/jobseeker`, `GET /api/analytics/company`
- **Admin:** `GET /api/admin/stats`, `GET /api/admin/users`, `PUT /api/admin/users/{user_id}/toggle-active`, `PUT /api/admin/users/{user_id}/make-admin`, `GET /api/admin/activity`, `POST /api/admin/scraper/run`
- **Scraper:** `POST /api/scraper/run`
- **Chat assistant:** `POST /api/chat`

Protected routes use the `Authorization: Bearer <token>` header.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Connection refused on DB port | Run `docker compose up -d`. Ensure `.env` has `DB_PORT=5433` (or your mapped port). |
| `ModuleNotFoundError: No module named 'api'` | Run `uvicorn` from the directory that **contains** the `api` folder (e.g. `FinalProject`). |
| `relation "jobs" or "user_profiles" does not exist` | Run `python app/database/db.py` once to create all tables. |
| No jobs / empty match results | Run `python -m scripts.scheduled_scraper` to fetch and embed jobs. |
| Frontend can’t reach API | Ensure backend is on http://localhost:8000 or set `NEXT_PUBLIC_API_URL` in `frontend/.env.local`. |
| CORS errors | Backend allows all origins in dev; ensure the request URL matches what the frontend uses. |
| Chatbot replies with generic error | Ensure backend is running and reachable at `NEXT_PUBLIC_API_URL`; verify `POST /api/chat` responds in Swagger (`/docs`). |

---

## License

MIT. See LICENSE for details.
