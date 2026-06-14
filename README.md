# Vertex — Job Matching & Talent Platform

## Quick Setup for New Developers

### Prerequisites
- Python 3.9+
- Node.js 18+
- Docker Desktop
- Git

### 1. Clone the repository
```bash
git clone https://github.com/nourshraif/FinalProject.git
cd FinalProject
```

### 2. Set up environment variables
```bash
cp env.example .env
# Edit .env and fill in your values
# Ask the project owner for the actual values

cp frontend/.env.example frontend/.env.local
# Edit frontend/.env.local with your values
```

### 3. Start the stack

**Option A — Full stack in Docker (recommended for production-like testing)**

```bash
# One-time: build the Python base image
docker build -f Dockerfile.base -t finalproject-base .

# Build frontend bundle, then build the frontend image
cd frontend && npm install && npm run build && cd ..
docker build -t finalproject-frontend:latest ./frontend

# Start postgres + backend + frontend + nginx
docker compose up -d --build
```

Open **http://localhost** (nginx proxies API and frontend).

**Option B — Database only (local dev with uvicorn + npm run dev)**

```bash
docker compose up -d postgres
```

### 4. Set up Python environment
```bash
python -m venv venv

# Windows:
venv\Scripts\activate

# Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
```

### 5. Initialize the database
```bash
python app/database/db.py
```

### 6. Set up the frontend
```bash
cd frontend
npm install
cd ..
```

### 7. Start the backend
```bash
uvicorn api.main:app --reload --port 8000
```

### 8. Start the frontend
```bash
cd frontend
npm run dev
```

### 9. Open the app

| Mode | URL |
|------|-----|
| Local dev (Option B) | http://localhost:3000 |
| Docker full stack (Option A) | http://localhost |
 
 ### 10. Optional: seed jobs and build embeddings
 ```bash
 python -m scripts.scheduled_scraper
 python -m scripts.setup_vector_tables
 ```

---

[![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-green.svg)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+%20pgvector-blue.svg)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-green.svg)](https://www.docker.com/)

**Vertex** is a full-stack job matching and talent platform: job seekers upload CVs, get skill-based matches, and track applications; companies post jobs, manage applicant pipelines, and (on Business) search and outreach to candidates.

---

## Recent Updates

### Latest (Unreleased)

- Implemented **3-tier company pricing** (Free / Growth / Business) with enforced limits in `api/plan_limits.py`:
  - **Free:** 1 active job, receive applicants, basic pipeline (Applied / Rejected) — no outbound contact requests
  - **Growth** (plan `pro`): 5 jobs, full pipeline, job boost, **hiring funnel analytics**
  - **Business:** unlimited jobs; candidate search, save, unlimited contact requests; **hiring funnel + outreach analytics**
- **Contact requests are Business-only** — Free and Growth manage inbound applicants on job postings; outbound outreach requires Business.
- **Candidate email privacy** — Job seeker emails are hidden in search/saved candidates and contact-request flows until the candidate **accepts** a contact request. Emails on the **Applicants** page are visible because the candidate applied to your job.
- **Cancel at period end** — Stripe subscriptions cancel at billing period end; paid features stay active until `current_period_end`, then revert to Free (`cancel_at_period_end` on subscription + billing UI).
- **Company analytics split** — Growth sees hiring funnel metrics; Business adds search, save, and contact-request analytics (`includes_outreach_analytics` on `GET /api/analytics/company`).
- Added **`GET /api/company/plan-usage`** for current plan limits and usage counts.
- Updated **pricing page**, **PlanGate**, billing labels, and admin platform settings for Growth limits/prices.
- Added **Skills Gap Analyzer** flow with new endpoints (`/api/skills-gap/analyze`, `/api/skills-gap/analyze-job/{job_id}`) and a dedicated `/skills-gap` page for job seekers; **Analyze My Gap** on Match page and dashboard last-match cards (Pro).
- Added **plan-based feature gating** (Free/Pro/Business) across key workflows such as full match visibility, saved jobs, application tracker, candidate search, contact request limits, and company posting limits.
- Introduced **new Lebanon-focused scrapers** for HireLebanese and CareersAndJobsInLebanon, integrated into the scraper service pipeline.
- Added new **public product pages**: About, Contact, Privacy Policy, and Terms of Service, plus navigation/footer updates.
- Improved **subscription UX** in frontend auth/navigation and pricing flows with clearer plan awareness and gated upgrade prompts (`PlanGate`).

### Previous Milestone

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
| **httpx** | HTTP client for OAuth + external API calls |
| **Resend** | Transactional email delivery |
| **Stripe** | Subscription billing + webhook handling |
| **OpenAI** | Hugging Face router / AI assistant client |
| **Streamlit** | Optional legacy dashboard + demo scripts |
| **pandas / NumPy / SciPy** | Data processing and analytics |
| **PyPDF** | PDF text extraction |

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
| **Docker & Docker Compose** | PostgreSQL + pgvector; optional full stack (backend, frontend, nginx) |
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
- **Job matching** — Match jobs by skills (keyword + semantic similarity); last match run persisted (`GET /api/match-jobs/last`)
- **Skills Gap Analyzer** — Pro: compare your skills to a target job (`/skills-gap` page; **Analyze My Gap** on Match + dashboard last matches)
- **Saved jobs** — Bookmark jobs; view and manage saved list with search
- **Application tracker** — Pro: create and update applications (applied, interviewing, offer, rejected, saved); add notes
- **Profile** — Edit headline, bio, location, LinkedIn, years of experience, skills
- **Contact requests inbox** — Receive requests from companies and accept or decline with one click
- **Notifications center** — In-app notifications with unread count, mark-as-read, and delete support
- **Job alerts** — Configurable alert settings (immediate/daily/weekly) and test alert endpoint
- **Public profile link** — Shareable public profile slug with visibility controls
- **Dashboard** — Quick stats, **Your last matches** (from last matcher run), and links to match, tracker, saved, profile

### For Companies

- **Company profile** — Company name, website, industry, size, description, contact name
- **Posted jobs management** — Create, list, update, delete, and activate/deactivate job postings (tier-based active job limits)
- **Skill-match notifications on post** — When a company posts a job, matched job seekers receive notifications
- **Applicant pipeline** — Review applications per posted job; **unlimited applicants per posting** on all tiers; full pipeline (Reviewing → Interview → Offer) on Growth+
- **Candidate search** — **Business only:** search by required skills with keyword + semantic matching
- **Saved candidates** — **Business only** (unlimited); private notes per candidate (500 chars)
- **Contact workflow** — **Business only:** search candidates and send unlimited contact requests (candidate email revealed only after they accept). **Free & Growth:** manage applicants who apply to your job postings.
- **Hiring analytics** — **Growth+** at `/analytics`: funnel metrics (applications, pipeline stages, job conversion). **Business** adds outreach analytics (searches, saves, contact requests).
- **Talent pool** — Business companies can browse registered candidates via search (emails gated until contact accepted); `/company/admin` requires login and does not expose candidate emails
- **Dashboard** — Applicants, open roles, and activity charts (applications on Growth; search activity on Business); quick links to jobs and analytics

### Platform & Data

- **Job scraping** — Multiple boards (WeWorkRemotely, Indeed, LinkedIn, RemoteOK, Remotive, Arbeitnow, Himalayas, Bayt); idempotent (duplicates skipped)
- **Vector embeddings** — Stored in PostgreSQL with pgvector; used for semantic job and candidate matching
- **Role-based access** — Separate routes and API guards for job seeker vs company
- **Google OAuth** — Google sign-in flow with callback and account bootstrap
- **Email flows** — Welcome, password reset, contact request, acceptance, and alert emails
- **Subscriptions & billing** — Stripe checkout (job seeker Pro, company Growth/Business), subscription status, cancel-at-period-end, webhook sync

### Subscription plans

#### Job seekers

| Plan | Price | Highlights |
|------|-------|------------|
| **Free** | $0 | CV upload, browse/apply, basic profile |
| **Pro** | ~$12/mo | Unlimited matches, skills gap, application tracker, job alerts, profile boost |

#### Companies

| Plan | Price | Highlights |
|------|-------|------------|
| **Free** | $0 | 1 active job, **unlimited applicants per job**, receive & review applications, basic pipeline |
| **Growth** | ~$29/mo | 5 jobs, full pipeline, job boost, hiring funnel analytics |
| **Business** | ~$49/mo | Unlimited jobs, search & save candidates, unlimited contact requests, outreach analytics |

Growth is stored as plan `pro` for company accounts; Business is plan `business`. Limits are configurable in **Admin → Platform Settings** (job posting limits, Growth/Business prices).

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
| `APP_URL` | Public app URL (Stripe redirects) | `http://localhost:3000` (dev) or `http://localhost` (Docker/nginx) |
| `NEXT_PUBLIC_API_URL` | Frontend → API base URL | `http://localhost:8000` (dev) or `http://localhost` (Docker/nginx) |
| `STRIPE_SECRET_KEY` | Stripe secret key | *(from Stripe dashboard)* |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | *(from Stripe webhook config)* |

Frontend: set `NEXT_PUBLIC_API_URL` in `frontend/.env.local` (local dev) or bake it at Docker build time. When using nginx on port 80, use `http://localhost` so API calls go through the reverse proxy.

Growth/Business prices and Free/Growth limits can also be tuned via **Admin → Platform Settings** (`growth_*` and `free_*` keys in `platform_settings`).

---

## Project Structure

```
FinalProject/
├── api/
│   ├── __init__.py
│   ├── main.py                 # FastAPI app, all routes, auth, company/jobseeker APIs
│   └── plan_limits.py          # Subscription tier limits (Free / Growth / Business)
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
│   ├── setup_vector_tables.py  # Create job_embeddings tables and schema
│   ├── integrated_job_matcher_app.py  # Legacy Streamlit UI (optional)
│   ├── company_portal.py        # Legacy Streamlit company demo portal
│   └── dev.sh                   # Start backend + frontend (Unix)
├── logs/                        # Scraper and scheduler status JSON logs
├── uploads/                     # Uploaded CVs and file storage
├── docker-compose.yml          # Postgres + backend + frontend + nginx
├── Dockerfile                  # Backend image (requires finalproject-base)
├── Dockerfile.base             # Python deps + embedding model cache
├── frontend/Dockerfile         # Next.js standalone image
├── requirements.txt
├── env.example
├── Makefile                    # Docker scraper workflow (optional)
└── README.md
```

---

## API Overview

- **Auth:** `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/google`, `GET /api/auth/google/callback`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, `GET /api/auth/me`
- **CV:** `POST /api/upload-cv`, `POST /api/profile/upload-cv`
- **Jobs (scraped):** `POST /api/match-jobs`, `GET /api/match-jobs/last`, `GET /api/jobs/stats`, `GET /api/jobs/search`, `GET /api/jobs/sources`, `GET /api/jobs/locations`
- **Skills gap:** `POST /api/skills-gap/analyze`, `POST /api/skills-gap/analyze-job/{job_id}`
- **Posted jobs (company):** `GET /api/jobs/posted`, `GET /api/jobs/posted/{job_id}`, `POST /api/jobs/posted`, `PUT /api/jobs/posted/{job_id}`, `DELETE /api/jobs/posted/{job_id}`, `PUT /api/jobs/posted/{job_id}/toggle`, `GET /api/company/posted-jobs`
- **Job seeker profile:** `POST /api/jobseeker/save-profile`, `GET /api/profile`, `PUT /api/profile`, `PUT /api/profile/skills`, `GET /api/profile/slug`, `PUT /api/profile/visibility`, `GET /api/public/profile/{slug}`
- **Applications:** `GET /api/applications`, `POST /api/applications`, `PUT /api/applications/{id}`, `DELETE /api/applications/{id}`
- **Saved jobs:** `GET /api/saved-jobs`, `POST /api/saved-jobs/{job_id}`, `DELETE /api/saved-jobs/{job_id}`, `GET /api/saved-jobs/check/{job_id}`
- **Company:** `GET /api/company/profile`, `PUT /api/company/profile`, `GET /api/company/plan-usage`
- **Company candidates:** `POST /api/company/search-candidates`, `GET /api/company/candidate-count`, `GET /api/company/all-candidates`
- **Company saved candidates:** `GET /api/company/saved-candidates`, `POST /api/company/saved-candidates`, `DELETE /api/company/saved-candidates/{candidate_user_id}`, `PUT /api/company/saved-candidates/notes`
- **Contact requests:** `POST /api/contact-requests`, `GET /api/contact-requests/received`, `GET /api/contact-requests/sent`, `PUT /api/contact-requests/{request_id}`
- **Notifications:** `GET /api/notifications`, `GET /api/notifications/unread-count`, `PUT /api/notifications/{notification_id}/read`, `PUT /api/notifications/read-all`, `DELETE /api/notifications/{notification_id}`
- **Alerts:** `GET /api/alerts/settings`, `PUT /api/alerts/settings`, `POST /api/alerts/test`
- **Payments:** `POST /api/payments/create-checkout`, `POST /api/payments/verify-session`, `GET /api/payments/subscription`, `POST /api/payments/cancel`, `POST /api/payments/webhook`
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
| Frontend can’t reach API | Local dev: backend on http://localhost:8000 and `NEXT_PUBLIC_API_URL=http://localhost:8000`. Docker: use http://localhost and ensure nginx + backend containers are running. |
| Plan limits not updating after code changes | Rebuild backend: `docker compose up -d --build backend`. Rebuild frontend after UI changes: `cd frontend && npm run build && docker build -t finalproject-frontend:latest ./frontend`. |
| CORS errors | Backend allows all origins in dev; ensure the request URL matches what the frontend uses. |
| Chatbot replies with generic error | Ensure backend is running and reachable at `NEXT_PUBLIC_API_URL`; verify `POST /api/chat` responds in Swagger (`/docs`). |

---

## License

MIT. See LICENSE for details.
