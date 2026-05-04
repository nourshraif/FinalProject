# Vertex — Complete Technical Documentation

> **Scope:** This document describes the **Vertex** codebase as implemented in this repository (FastAPI backend, Next.js 14 frontend, PostgreSQL 16 + pgvector, scrapers, Stripe, Resend, Hugging Face / optional Anthropic).  
> **Note:** There is **no** `api/vertex_knowledge.py` in this tree. Skills Gap uses **Anthropic Claude Haiku** when `ANTHROPIC_API_KEY` is set, otherwise the **Hugging Face router** (`HF_TOKEN`). The UI is **dark-themed** (`data-theme="dark"`); there is no separate light/dark toggle in `layout.tsx`.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Problem Statement](#2-problem-statement)
3. [Solution](#3-solution)
4. [Architecture Overview](#4-architecture-overview)
5. [Technology Stack](#5-technology-stack)
6. [Database Design](#6-database-design)
7. [Authentication System](#7-authentication-system)
8. [API Endpoints Reference](#8-api-endpoints-reference)
9. [AI & Matching System](#9-ai--matching-system)
10. [Job Scraping System](#10-job-scraping-system)
11. [Frontend Architecture](#11-frontend-architecture)
12. [Key Features (detailed)](#12-key-features-detailed)
13. [Payment System](#13-payment-system)
14. [Email System](#14-email-system)
15. [Notification System](#15-notification-system)
16. [Admin System](#16-admin-system)
17. [Security](#17-security)
18. [Setup & Installation](#18-setup--installation)
19. [Environment Variables](#19-environment-variables)
20. [Glossary](#20-glossary)

---

## 1. Project Overview

### What Vertex is

**Vertex** is a **two-sided talent marketplace** prototype: **job seekers** discover and apply to roles (including **AI-assisted matching** over aggregated listings), and **companies** post jobs, **search candidates**, and send **contact requests**. The stack is a **decoupled SPA + REST API**: **Next.js 14** (`frontend/`) talks to **FastAPI** (`api/main.py`) backed by **PostgreSQL with pgvector** for semantic similarity.

### Who built it and why

Vertex is developed as a **Master’s-level graduation / capstone project** demonstrating modern full-stack engineering: secure auth, payments, email, background scheduling, web scraping, embeddings-based retrieval, and a polished UI.

### Problem it solves

- **Fragmentation:** Jobs live on many boards; candidates must visit each site.  
- **Weak discovery:** Pure keyword search misses **synonyms** and **related phrasing**.  
- **Recruiter noise:** Companies need tools to **target** candidates by skills, not only by volume of applications.

### Target users

| Persona | Primary goals |
|--------|----------------|
| **Job seeker** | Upload CV, extract skills, match to jobs, save/apply, alerts, skills gap |
| **Company** | Profile, post jobs, search/save candidates, contact requests, analytics (Business) |
| **Admin** | Platform stats, user moderation, scraper ops, cleanup tools |

### Differentiators (vs. large networks)

- **Transparent hybrid matching:** embeddings (**semantic**) + **keyword** overlap, with tunable weights in code.  
- **Your own aggregated index** into Postgres, not dependence on a single vendor’s inventory.  
- **Subscription-gated** premium features enforced in **both** UI (`PlanGate`) and API (`require_plan`).

### Current stats

Counts are **data-dependent** (run after scrapers). `init_database()` prints `Current jobs in database: N`. There is **no** built-in analytics counter for “total users” in the health payload by default—use admin stats or SQL.

### Two-sided marketplace

- **Supply:** scraped `jobs` + company `posted_jobs`; optional `job_embeddings`.  
- **Demand:** registered users, `user_profiles` (skills + optional `skills_embedding`).  
- **Interactions:** `job_applications`, `saved_jobs`, `contact_requests`, `notifications`, Stripe `subscriptions`.

---

## 2. Problem Statement

### Traditional job boards

- Listings are **browsing-centric**; relevance ranking is often **basic**.  
- Users repeat the same **filters** on each site; **no unified skill graph**.

### Why keyword matching fails

- Job posts use **varying vocabulary** (“ML engineer” vs “machine learning scientist”).  
- CVs use **abbreviations** and **stack synonyms** that string search may not connect.

### Gap between seekers and companies

- Seekers need **discovery** and **feedback** on fit.  
- Companies need **searchable talent** and **controlled outreach** (privacy, rate limits).

### Lebanon & MENA context (optional narrative)

The codebase includes **Lebanon-oriented scrapers** (`HireLebanese`, `CareersAndJobsInLebanon`) **plus** **Bayt** for broader MENA coverage, alongside **global remote** boards—useful for a thesis emphasizing **regional + international** labor markets. This is **not** a dedicated NGO/ReliefWeb integration unless you add it separately.

### Skill assessment challenge

- CVs are **unstructured PDFs**; skills must be **extracted** (LLM + fallback).  
- “Fit” is **multi-dimensional**; Vertex uses **scores** as **heuristics**, not certified hiring truth.

---

## 3. Solution

| Problem | Vertex response |
|--------|------------------|
| Fragmented listings | Multi-source **scrapers** + optional admin run; `jobs` table |
| Keyword limits | **pgvector** + Sentence Transformers + **hybrid** scoring |
| Company sourcing | **Candidate search** with embeddings + keyword blend (`user_profile_service`) |
| Skill transparency | **Skills Gap** JSON analysis (`api/skills_gap_service.py`) |
| Trust / billing | **Stripe** subscriptions + **webhooks** |
| Engagement | **Resend** emails, **notifications**, optional **job alerts** scheduler |
| Privacy-aware contact | **Contact requests** with status + optional email reveal flow |

---

## 4. Architecture Overview

### ASCII diagram

```
┌─────────────────────┐         ┌─────────────────────┐
│  Job seeker browser │         │  Company browser    │
└──────────┬──────────┘         └──────────┬──────────┘
           │                               │
           └───────────────┬───────────────┘
                           │ HTTPS (JSON)
                           v
              ┌────────────────────────┐
              │   Next.js :3000        │
              │   (App Router, TS)     │
              └────────────┬───────────┘
                           │  NEXT_PUBLIC_API_URL
                           v
              ┌────────────────────────┐
              │   FastAPI :8000        │
              │   api/main.py          │
              └────────────┬───────────┘
                           │ psycopg2
                           v
              ┌────────────────────────┐
              │ PostgreSQL + pgvector  │
              │ (Docker :5433)         │
              └────────────────────────┘
        scrapers / embeddings / schedulers
                           ^
           ┌───────────────┴────────────────┐
           │                                 │
    [HF / Anthropic]                    [Stripe]
    Skill extract, gap, chat            Payments
           │                                 │
      [Resend]                          [Google OAuth]
      Transactional mail                Social login
```

### Layers

| Layer | Responsibility |
|-------|----------------|
| **Frontend** | Routing, forms, dashboards, `lib/api.ts` HTTP client, JWT in `localStorage`, polling notifications |
| **Backend** | Auth, validation (Pydantic), business rules, DB access, Stripe webhooks, email sends |
| **Database** | Relational data + `vector` columns + `job_embeddings` (created by embedding pipeline) |
| **External** | HF router (skills, chat, gap fallback), optional Anthropic (gap), Resend, Stripe, Google OAuth |

### Data flow (example: match jobs)

1. User submits skills or CV PDF → **FastAPI** extracts text (`pypdf` via `app/utils/pdf_utils.py`).  
2. Skills from **HF** + **fallback** merge (`app/services/skill_extraction_service.py`).  
3. **VectorSkillMatcher** embeds skills, queries **`job_embeddings`** with pgvector, blends keyword score.  
4. JSON returned to Next.js → UI renders ranked cards.

---

## 5. Technology Stack

### Backend

| Tech | What | Why here | Where |
|------|------|----------|--------|
| **Python 3.9+** | Language | ML/scraper ecosystem | `api/`, `app/` |
| **FastAPI** | API framework | Speed, OpenAPI, deps | `api/main.py` |
| **PostgreSQL 16** | RDBMS | ACID, joins | `app/database/db.py` |
| **pgvector** | Vector type + ops | Similarity in-SQL | `CREATE EXTENSION vector`, `job_embeddings`, `skills_embedding` |
| **psycopg2** | DB driver | Stable | All `db.py` queries |
| **sentence-transformers** | Embeddings | Local encode for jobs/skills | `app/services/embedding_service.py`, `vector_matching_service.py` |
| **OpenAI-compatible client** | HF router chat | Same SDK shape as OpenAI | `openai` package + `base_url` HF router |
| **python-jose** | JWT | HS256 encode/decode | `api/main.py` |
| **bcrypt** | Password hashing | Industry practice | `api/main.py` (`hash_password` / `verify_password`) — *requirements also list `passlib[bcrypt]` but runtime uses `bcrypt` directly* |
| **APScheduler** | Cron-like jobs | Daily/weekly alerts | `api/job_alerts_scheduler.py`, app lifespan |
| **Stripe** | Billing | Checkout + webhooks | `api/main.py` |
| **Resend** | Email API | Transactional mail | `api/email_service.py` |
| **BeautifulSoup / requests** | HTML scraping | Job ingestion | `app/services/Scrapers/*` |
| **pypdf** | PDF text | CV upload | `app/utils/pdf_utils.py` |
| **httpx** | HTTP client | OAuth-related HTTP | `requirements` + imports as used |

### Frontend

| Tech | What | Why here | Where |
|------|------|----------|--------|
| **Next.js 14.2** | React framework | App Router, SSR-ready | `frontend/app/` |
| **TypeScript** | Typed JS | Safety | All `*.ts` / `*.tsx` |
| **Tailwind CSS** | Utility CSS | Rapid UI | `globals.css`, components |
| **Radix Slot** | Primitive composition | Button variants | `components/ui/button.tsx` |
| **Sonner** | Toasts | UX feedback | `layout.tsx`, `ToastContext` |
| **Recharts** | Charts | Analytics | `frontend/app/analytics/page.tsx` |
| **Lucide** | Icons | Consistent icon set | Components |

### Docker

`docker-compose.yml` runs **`pgvector/pgvector:pg16`** mapped to host port **5433** by default.

---

## 6. Database Design

### ER overview (logical)

```
users (1) ────── (0..1) company_profiles   [user_id]
users (1) ────── (0..1) subscriptions      [user_id UNIQUE]
users (1) ────── (N)  job_applications
users (1) ────── (N)  saved_jobs ───► jobs (N)
users (1) ────── (N)  notifications
users (1) ────── (0..1) job_alert_settings
users (1) ────── (N)  contact_requests (as company or candidate)
users (1) ────── (N)  saved_candidates (company_user_id → candidate_user_id)

jobs (1) ─────── (0..1) job_embeddings     [created by embedding pipeline]
jobs (1) ─────── (N)  saved_jobs
jobs (1) ─────── (N)  sent_job_alerts

user_profiles: keyed by email in legacy schema; holds skills + skills_embedding
posted_jobs: company_user_id → users
```

### Tables (from `init_database()` + migrations in `db.py`)

#### `jobs`
| Column | Type | Purpose |
|--------|------|---------|
| `id` | SERIAL PK | Internal id |
| `source` | VARCHAR(50) | Scraper / origin label |
| `job_title` | VARCHAR(255) | Title |
| `company` | VARCHAR(255) | Employer |
| `location` | VARCHAR(255) | Location text |
| `description` | TEXT | Full text for search/match |
| `job_url` | VARCHAR(500) UNIQUE | **Dedup key** for upsert |
| `scraped_at`, `created_at` | TIMESTAMP | Freshness |
| `is_active` | BOOLEAN | Soft visibility |

#### `job_embeddings` (created by `embedding_service` / `vector_matching_service`, not in first `CREATE TABLE` block)
| Column | Purpose |
|--------|---------|
| `job_id` | FK → `jobs.id` |
| `full_text` | Text used to embed |
| `skills_text` | Extracted/normalized skills snippet |
| `embedding` | `vector(dim)` for similarity |

#### `user_profiles`
Job seeker extended profile: `email` UNIQUE, `cv_text`, `skills` (`TEXT[]`), **`skills_embedding vector(384)`**, `cv_filename`, headline/bio/location/linkedin/years_experience, `profile_slug`, `is_public`.

#### `users`
Core auth: `email`, `full_name`, `hashed_password`, `user_type` (`jobseeker`|`company`), flags, **`plan`**, **`is_admin`**.

#### `company_profiles`
One row per company user: `company_name`, website, industry, size, description, `logo_url`.

#### `subscriptions`
Stripe mirror: `stripe_customer_id`, `stripe_subscription_id`, `plan`, `status`, `current_period_end`, UNIQUE(`user_id`).

#### `job_applications`
Tracker rows: `job_title`, `company`, optional `job_url`, `status`, `notes`, timestamps.

#### `saved_jobs`
`UNIQUE(user_id, job_id)` bookmark.

#### `saved_candidates`
Company bookmarks of candidates + `notes`, `UNIQUE(company_user_id, candidate_user_id)`.

#### `contact_requests`
Company → candidate message, `status` pending/accepted/declined, `company_email_revealed`.

#### `contact_messages` / `contact_message_replies`
Public “contact us” + admin/user thread replies (`send_via` backend/email).

#### `notifications`
Types: `contact_request`, `request_accepted`, `request_declined`, `job_alert`, `new_job_match`, `profile_view`, `system`.

#### `password_reset_tokens`
`token`, `expires_at`, `used`.

#### `job_alert_settings` / `sent_job_alerts`
Per-user alert prefs + dedupe of which `(user_id, job_id)` already emailed.

#### `posted_jobs`
Company-authored listings with rich fields (`skills_required[]`, salary, URLs, counters).

#### `company_searches`
Audit of candidate searches: skills array, `user_id`, `results_count`.

#### `cv_uploads`
Stores upload metadata + `extracted_text` snippet + `skills_text` string for history/debug.

---

## 7. Authentication System

### Email / password

1. **Register** — `POST /api/auth/register` hashes password (`bcrypt`, `BCRYPT_ROUNDS=12`), inserts `users` (+ company profile row if needed), sends welcome email, returns JWT + `TokenResponse`.  
2. **Login** — `POST /api/auth/login` verifies hash, issues JWT, optional welcome notification.  
3. **JWT** — `create_access_token` embeds `user_id`, `email`, `user_type` + **`exp`**. **`ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7`** (7 days, not 24h).  
4. **Protected requests** — `HTTPBearer`; `get_current_user` decodes JWT, loads user from DB (includes current `plan`).

### Password reset

1. `POST /api/auth/forgot-password` — creates token in `password_reset_tokens`, emails link `{APP_URL}/auth/reset-password?token=...` via Resend.  
2. `POST /api/auth/reset-password` — validates token, updates hash, marks token used.

### Google OAuth (high level)

1. Client navigates to `GET /api/auth/google` (starts OAuth).  
2. Google redirects to `GET /api/auth/google/callback?code=...`.  
3. Backend exchanges code, resolves profile, **creates or finds** user, issues JWT, redirects to `FRONTEND_URL/auth/callback?token=...&...`.

### JWT payload (claims)

Example **data claims** (plus `exp`):

```json
{
  "user_id": 42,
  "email": "user@example.com",
  "user_type": "jobseeker"
}
```

### Frontend route protection

- **`ProtectedRoute`** — redirects unauthenticated users to `/auth/login`; enforces `jobseeker` vs `company` vs `any`.  
- **`PlanGate`** — fetches subscription via `getSubscription`; blocks or soft-gates UI by feature (`view_matches`, `skills_gap`, `search_candidates`, …). **Admins bypass** the gate in UI.  
- **API** — `require_plan()` returns **403** with structured `plan_required` payload if feature not allowed.

---

## 8. API Endpoints Reference

> **Convention:** Unless noted, **Bearer JWT** required. Public routes marked **Public**.

### Auth

| Method | Path | Auth | Notes |
|--------|------|------|------|
| POST | `/api/auth/register` | Public | Body: email, password, full_name, user_type, optional company_name |
| POST | `/api/auth/login` | Public | Returns `access_token` + user meta |
| GET | `/api/auth/google` | Public | Starts OAuth |
| GET | `/api/auth/google/callback` | Public | OAuth redirect target |
| POST | `/api/auth/forgot-password` | Public | Anti-enumeration messaging |
| POST | `/api/auth/reset-password` | Public | token + new_password |
| GET | `/api/auth/me` | Bearer | Current user |

### Health / chat

| GET | `/health` | Public |
| POST | `/api/chat` | Public | Career assistant; HF router + fallback |

### CV / match / skills

| POST | `/api/upload-cv` | Bearer | PDF extract + skills |
| POST | `/api/match-jobs` | Bearer | Hybrid match; plan may apply |
| POST | `/api/skills-gap/analyze` | Bearer + Pro | Profile skills vs pasted JD |
| POST | `/api/skills-gap/analyze-job/{job_id}` | Bearer + Pro | Gap vs specific job |

### Jobs (scraped + posted)

| GET | `/api/jobs/stats` | Public |
| GET | `/api/jobs/search` | Public | Query params filters |
| GET | `/api/jobs/sources` | Public |
| GET | `/api/jobs/locations` | Public |
| GET | `/api/jobs/posted` | Public |
| GET | `/api/jobs/posted/{job_id}` | Public |
| GET | `/api/jobs/{job_id}` | Public | Scraped job by id |
| POST/PUT/DELETE | `/api/jobs/posted` … | Bearer company | CRUD + toggle |

### Scraper

| POST | `/api/scraper/run` | Public in code — **restrict in production** |

### Company talent

| POST | `/api/company/search-candidates` | Bearer Business | Hybrid search |
| GET | `/api/company/candidate-count` | Bearer |
| GET | `/api/company/all-candidates` | Bearer |
| GET/PUT | `/api/company/profile` | Bearer company |
| GET | `/api/company/posted-jobs` | Bearer company |
| GET/POST/DELETE/PUT | `/api/company/saved-candidates` … | Bearer Business |
| GET/DELETE | `/api/company/search-history` … | Bearer Business |

### Job seeker profile

| POST | `/api/jobseeker/save-profile` | Bearer | Legacy/save flow |
| GET/PUT | `/api/profile` | Bearer jobseeker |
| PUT | `/api/profile/skills` | Bearer |
| POST | `/api/profile/upload-cv` | Bearer |
| PUT | `/api/profile/visibility` | Bearer |
| GET | `/api/profile/slug` | Bearer |

### Applications & saved jobs

| GET/POST/PUT/DELETE | `/api/applications` … | Bearer jobseeker |
| GET/POST/DELETE/GET | `/api/saved-jobs` … | Bearer |

### Contact

| POST | `/api/contact-requests` | Bearer company |
| GET | `/api/contact-requests/received` | Bearer |
| GET | `/api/contact-requests/sent` | Bearer |
| PUT | `/api/contact-requests/{request_id}` | Bearer | accept/decline |
| POST | `/api/contact` | Public | Guest contact |
| GET/POST | `/api/contact/my-messages` … | Bearer |

### Admin

| GET | `/api/admin/stats` | Admin |
| GET | `/api/admin/users` | Admin |
| PUT | `/api/admin/users/{id}/toggle-active` | Admin |
| PUT | `/api/admin/users/{id}/make-admin` | Admin |
| GET | `/api/admin/activity` | Admin |
| POST | `/api/admin/scraper/run` | Admin |
| POST | `/api/admin/cleanup-duplicates` | Admin |
| POST | `/api/admin/cleanup-inactive-jobs` | Admin |
| GET | `/api/admin/scraper/last-run` | Admin |
| GET | `/api/admin/health` | Admin |
| Contact message admin routes | `/api/admin/contact-messages` … | Admin |

### Notifications

| GET | `/api/notifications` | Bearer |
| GET | `/api/notifications/unread-count` | Bearer |
| PUT | `/api/notifications/{id}/read` | Bearer |
| PUT | `/api/notifications/read-all` | Bearer |
| DELETE | `/api/notifications/{id}` | Bearer |

### Payments

| POST | `/api/payments/create-checkout` | Bearer |
| GET | `/api/payments/subscription` | Bearer |
| POST | `/api/payments/verify-session` | Bearer | Client-side completion helper |
| POST | `/api/payments/cancel` | Bearer |
| POST | `/api/payments/webhook` | Stripe signature | No JWT |

### Analytics & alerts

| GET | `/api/analytics/jobseeker` | Bearer + plan |
| GET | `/api/analytics/company` | Bearer Business |
| GET/PUT | `/api/alerts/settings` | Bearer Pro |
| POST | `/api/alerts/test` | Bearer Pro jobseeker |

### Public profile

| GET | `/api/public/profile/{slug}` | Public |

---

## 9. AI & Matching System

### Semantic vs keyword

- **Keyword:** substring checks (e.g. job alerts scorer).  
- **Semantic:** embedding distance in pgvector (`<=>` cosine-style ops).

### Embeddings pipeline

1. Text → **SentenceTransformer** (`all-MiniLM-L6-v2`, **384** dims in schema).  
2. Vector stored in **`job_embeddings`** per job.  
3. Query: embed user skills string → **nearest neighbors** in SQL.

### Hybrid job match (`VectorSkillMatcher`)

- Retrieve top jobs by vector distance.  
- Compute **keyword_score** from skill tokens in description.  
- **Default blend:** `vector_weight=0.7`, `keyword_weight=0.3` (see `api/main.py` call site).

### Company candidate ranking (`user_profile_service`)

When `skills_embedding` present: SQL orders by distance; combines **vector** + **keyword** (e.g. 0.6 / 0.4 in service).

### CV skill extraction

`skill_extraction_service.call_huggingface_api` → structured list; `merge_skills_from_api_and_fallback` unions **HF** output with **regex/keyword fallback**.

### Skills Gap Analyzer

`analyze_job_specific_gap` builds a strict **JSON schema prompt**.  
- If **`ANTHROPIC_API_KEY`** → **Claude Haiku** model string in code.  
- Else → **`_call_hf_for_gap`** via HF router.  
Response JSON includes `missing_skills` with suggested **resources** (YouTube / Coursera style URLs in template).

---

## 10. Job Scraping System

### Orchestration

- **`scripts/scheduled_scraper.py`** → `scrape_jobs()` in `app/services/scraper_service.py`.  
- **Class-based scrapers** from `get_all_scrapers()` **plus** `scrape_hirelebanese()` and `scrape_careersandjobsinlebanon()`.

### Class scrapers (9)

WeWorkRemotely, Indeed, LinkedIn, RemoteOK, Remotive, Arbeitnow, Himalayas, Bayt (+ base).

### Lebanon modules (2)

HireLebanese, CareersAndJobsInLebanon — invoked from `ScraperService.scrape_web_sources`.

### Persistence & dedup

```sql
INSERT INTO jobs (..., job_url, ...)
VALUES (...)
ON CONFLICT (job_url) DO UPDATE SET
  job_title = EXCLUDED.job_title,
  ...,
  scraped_at = NOW()
RETURNING id;
```

Admin **`remove_duplicate_jobs`** deletes older duplicate URLs.

### Embeddings after save

`generate_and_save_embedding(...)` runs per upserted job (failures logged, job still kept).

---

## 11. Frontend Architecture

### `app/` routes (representative)

| Path | Access | Role |
|------|--------|------|
| `/` | Public | Landing |
| `/auth/login`, `/register`, `/forgot-password`, `/reset-password` | Public | Auth |
| `/auth/callback` | Public | OAuth token handoff |
| `/dashboard/jobseeker`, `/company` | Protected | Role dashboards |
| `/profile`, `/match`, `/saved`, `/tracker`, `/skills-gap`, `/settings/alerts` | Protected seeker | Features |
| `/company/search`, `/saved`, `/jobs`, `/post-job`, `/history`, `/requests` | Protected company | Recruiting |
| `/admin` | Admin | Console |
| `/jobs`, `/find-jobs`, `/search`, `/jobs/[id]` | Mostly public | Browse |
| `/u/[slug]` | Public | Public profile page |
| `/pricing`, `/settings/billing`, `/payment/success` | Mixed | Stripe |
| `/notifications`, `/analytics` | Protected | Engagement |

### State

- **`AuthContext`** — `user`, `token`, `login`, `logout`, `refreshUser`, `updateUser`.  
- **`ToastContext`** — `showToast` wrapper around Sonner.

### Key components (summary)

| Component | Role |
|-----------|------|
| `Navbar` / `Footer` | Shell, nav, notification poll hook |
| `NotificationBell` | Poll unread count + dropdown |
| `ChatBot` | Floating assistant → `/api/chat` |
| `PlanGate` | Subscription UI gate |
| `ProtectedRoute` | Auth + role redirect |
| `CVUploader` | Client CV upload UX |
| `CandidateCard`, `JobCard`, … | Presentation |
| `GoogleButton` | Starts OAuth URL |

---

## 12. Key Features (detailed)

*(Each feature: user story → API + DB + UI — abbreviated for length; all map to sections above.)*

1. **Registration** — `users` + optional `company_profiles`; welcome email; JWT.  
2. **CV upload & skills** — `/api/profile/upload-cv`, `user_profiles`, HF + fallback.  
3. **AI job matching** — `/api/match-jobs`, `job_embeddings`, hybrid scoring.  
4. **Job search** — `/api/jobs/search`, `/find-jobs`, `/search`.  
5. **Application tracker** — `job_applications`, `/tracker`.  
6. **Saved jobs** — `saved_jobs`, `/saved`.  
7. **Profile** — `/profile`, skills editor.  
8. **Skills gap** — `/skills-gap`, analyze endpoints.  
9. **Company registration** — same auth with `user_type=company`.  
10. **Company profile** — `/company/profile`.  
11. **Candidate search** — `/company/search`, embeddings.  
12. **Contact requests** — `contact_requests` + emails + notifications.  
13. **Saved candidates** — `saved_candidates`.  
14. **Posted jobs** — `posted_jobs` CRUD.  
15. **Search history** — `company_searches`.  
16. **Job alerts** — `job_alert_settings`, scheduler + Resend.  
17. **Notifications** — table + polling UI.  
18. **Analytics** — `/analytics`, Recharts.  
19. **Admin** — stats, users, scraper, cleanup.  
20. **Subscriptions** — Stripe checkout + webhook + `subscriptions`.  
21. **Password reset** — tokens + Resend.  
22. **Theming** — **Dark** root theme (`data-theme="dark"`).  
23. **Chatbot** — `/api/chat`.  
24. **Public profile** — slug + `is_public`.

---

## 13. Payment System

### Flow

1. `POST /api/payments/create-checkout` with `plan` + billing cycle.  
2. Stripe **Checkout Session** URL returned → browser redirect.  
3. On success, frontend may call **`/api/payments/verify-session`** (helps when webhook lag).  
4. **`/api/payments/webhook`** verifies `stripe-signature` with `STRIPE_WEBHOOK_SECRET`, updates `subscriptions` + `users.plan`.

### Test cards (Stripe docs)

| Card | Behavior |
|------|----------|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 0002` | Decline |
| `4000 0025 0000 3155` | 3DS challenge |

### Plan enforcement

`check_plan_access` / `require_plan` in `api/main.py` — jobseeker **Pro** gates vs company **Business** gates (see code lists `JOBSEEKER_PRO_FEATURES`, `COMPANY_PRO_FEATURES`).

---

## 14. Email System (`api/email_service.py`)

| Function | When |
|----------|------|
| `send_welcome_email` | After register / OAuth create |
| `send_job_alert_email` | Scheduler / test alert |
| `send_contact_request_email` | New request to candidate |
| `send_acceptance_email` | Candidate accepted |
| `send_password_reset_email` | Forgot password |
| `send_support_reply_email` | Admin replies to contact message |

**Resend:** `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (default `onboarding@resend.dev` in code fallback).

---

## 15. Notification System

### Types (DB constraint)

`contact_request`, `request_accepted`, `request_declined`, `job_alert`, `new_job_match`, `profile_view`, `system`.

### Delivery model

**Polling:** `Navbar` / `NotificationBell` `setInterval(..., 30000)` → `/api/notifications/unread-count` (not WebSockets).

---

## 16. Admin System

- `users.is_admin` + `get_admin_user` dependency.  
- Features: stats, user list/toggle active/make admin, activity feed, run scraper, cleanup duplicates/inactive jobs, health, contact message moderation.

**Promote admin (SQL example):**

```sql
UPDATE users SET is_admin = TRUE
WHERE email = 'you@example.com';
```

---

## 17. Security

| Area | Implementation |
|------|------------------|
| Passwords | bcrypt, salted hashes, 72-byte handling |
| JWT | HS256, secret from env, expiry |
| SQLi | Parameterized queries |
| CORS | `CORSMiddleware` — **currently `allow_origins=["*"]` — tighten in prod** |
| Secrets | `.env` not committed; see `env.example` |
| Stripe | Webhook signature verification |

**Rate limiting:** not implemented in repo — mark as **TODO** for production hardening.

---

## 18. Setup & Installation

### Prerequisites

Python **3.9+**, Node **18+**, Docker Desktop, Git.

### Steps

```bash
git clone <your-repo-url> FinalProject
cd FinalProject
cp env.example .env
# Edit .env — DB_*, SECRET_KEY, HF_TOKEN, Stripe, Google, Resend, APP_URL, NEXT_PUBLIC_API_URL
```

**Database**

```bash
docker compose up -d
python app/database/db.py    # runs init_database()
```

**Backend**

```bash
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
uvicorn api.main:app --reload --port 8000
```

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

**Optional: seed jobs**

```bash
python -m scripts.scheduled_scraper
```

**URLs**

- Frontend: `http://localhost:3000`  
- API: `http://localhost:8000`  
- OpenAPI: `http://localhost:8000/docs`

---

## 19. Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Postgres | Yes |
| `SECRET_KEY` | JWT signing | Yes |
| `HF_TOKEN`, `HF_MODEL` (+ optional `HF_CHAT_MODEL`) | HF router | Strongly recommended |
| `ANTHROPIC_API_KEY` | Skills gap primary | Optional |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Email | For mail features |
| `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` | Billing | For payments |
| `STRIPE_PRO_PRICE_ID`, `STRIPE_BUSINESS_PRICE_ID` | Price objects | For checkout |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | OAuth | For Google login |
| `APP_URL` | Links in emails (reset, etc.) | Yes |
| `FRONTEND_URL` | OAuth redirect to Next callback | Recommended |
| `NEXT_PUBLIC_API_URL` | Browser → API base | Yes (frontend `.env.local` or build env) |

---

## 20. Glossary

| Term | Meaning in Vertex |
|------|-------------------|
| **API** | REST JSON interface under `/api/*` |
| **Authentication** | Proving identity (password or Google) |
| **Authorization** | JWT + `require_plan` / admin checks |
| **bcrypt** | Password hashing |
| **CORS** | Browser cross-origin permission headers |
| **Cosine / `<=>` distance** | pgvector similarity scoring |
| **Docker** | Hosts Postgres+pgvector image |
| **Embedding** | Numeric vector representing text |
| **FastAPI** | Python web framework for API |
| **JWT** | Bearer token with `user_id` + expiry |
| **Next.js** | React meta-framework (App Router) |
| **OAuth** | Google delegated login |
| **pgvector** | Postgres vector extension |
| **PostgreSQL** | Primary datastore |
| **REST** | Resource-style HTTP JSON API |
| **Scraping** | HTML ingestion of job boards |
| **Semantic search** | Meaning-based retrieval via embeddings |
| **Stripe** | Payments + subscriptions |
| **TypeScript** | Typed frontend language |
| **Vector** | float array stored as `vector` type |
| **Webhook** | Stripe server-to-server POST for billing events |

---

### Appendix: Repository map

```
FinalProject/
├── api/                 # FastAPI application
├── app/
│   ├── database/db.py   # Schema + data access
│   ├── services/        # Scrapers, matching, embeddings, CV pipeline
│   └── utils/pdf_utils.py
├── frontend/            # Next.js 14 app
├── scripts/             # scheduled_scraper, setup_vector_tables, etc.
├── docker-compose.yml
├── requirements.txt
├── env.example
└── DOCUMENTATION.md       # (this file)
```

---

## Appendix A — Full route list (quick index)

Use **`http://localhost:8000/docs`** (Swagger UI) and **`/redoc`** for **authoritative** request/response schemas generated from FastAPI models.

| Method | Path |
|--------|------|
| GET | `/health` |
| POST | `/api/chat` |
| POST | `/api/auth/register` |
| POST | `/api/auth/login` |
| GET | `/api/auth/google` |
| GET | `/api/auth/google/callback` |
| POST | `/api/auth/forgot-password` |
| POST | `/api/auth/reset-password` |
| GET | `/api/auth/me` |
| GET | `/api/admin/stats` |
| GET | `/api/admin/users` |
| PUT | `/api/admin/users/{user_id}/toggle-active` |
| PUT | `/api/admin/users/{user_id}/make-admin` |
| GET | `/api/admin/activity` |
| POST | `/api/admin/scraper/run` |
| POST | `/api/admin/cleanup-duplicates` |
| POST | `/api/admin/cleanup-inactive-jobs` |
| GET | `/api/admin/scraper/last-run` |
| GET | `/api/admin/health` |
| POST | `/api/upload-cv` |
| POST | `/api/match-jobs` |
| POST | `/api/skills-gap/analyze` |
| POST | `/api/skills-gap/analyze-job/{job_id}` |
| GET | `/api/jobs/stats` |
| GET | `/api/jobs/search` |
| GET | `/api/jobs/sources` |
| GET | `/api/jobs/locations` |
| GET | `/api/jobs/posted` |
| GET | `/api/jobs/posted/{job_id}` |
| GET | `/api/jobs/{job_id}` |
| POST | `/api/jobs/posted` |
| PUT | `/api/jobs/posted/{job_id}` |
| DELETE | `/api/jobs/posted/{job_id}` |
| PUT | `/api/jobs/posted/{job_id}/toggle` |
| POST | `/api/scraper/run` |
| POST | `/api/company/search-candidates` |
| GET | `/api/company/candidate-count` |
| GET | `/api/company/all-candidates` |
| POST | `/api/jobseeker/save-profile` |
| GET | `/api/profile` |
| PUT | `/api/profile` |
| PUT | `/api/profile/skills` |
| POST | `/api/profile/upload-cv` |
| GET | `/api/applications` |
| POST | `/api/applications` |
| PUT | `/api/applications/{app_id}` |
| DELETE | `/api/applications/{app_id}` |
| GET | `/api/saved-jobs` |
| POST | `/api/saved-jobs/{job_id}` |
| DELETE | `/api/saved-jobs/{job_id}` |
| GET | `/api/saved-jobs/check/{job_id}` |
| GET | `/api/company/profile` |
| PUT | `/api/company/profile` |
| GET | `/api/company/posted-jobs` |
| GET | `/api/company/saved-candidates` |
| POST | `/api/company/saved-candidates` |
| DELETE | `/api/company/saved-candidates/{candidate_user_id}` |
| PUT | `/api/company/saved-candidates/notes` |
| GET | `/api/company/search-history` |
| DELETE | `/api/company/search-history/{search_id}` |
| DELETE | `/api/company/search-history` |
| POST | `/api/contact-requests` |
| POST | `/api/contact` |
| GET | `/api/admin/contact-messages` |
| GET | `/api/admin/contact-messages/{message_id}` |
| PUT | `/api/admin/contact-messages/{message_id}/status` |
| POST | `/api/admin/contact-messages/{message_id}/reply` |
| GET | `/api/contact/my-messages` |
| GET | `/api/contact/my-messages/{message_id}` |
| POST | `/api/contact/my-messages/{message_id}/reply` |
| GET | `/api/contact-requests/received` |
| GET | `/api/contact-requests/sent` |
| PUT | `/api/contact-requests/{request_id}` |
| GET | `/api/notifications` |
| GET | `/api/notifications/unread-count` |
| PUT | `/api/notifications/{notification_id}/read` |
| PUT | `/api/notifications/read-all` |
| DELETE | `/api/notifications/{notification_id}` |
| POST | `/api/payments/create-checkout` |
| GET | `/api/payments/subscription` |
| POST | `/api/payments/verify-session` |
| POST | `/api/payments/cancel` |
| POST | `/api/payments/webhook` |
| GET | `/api/analytics/jobseeker` |
| GET | `/api/analytics/company` |
| GET | `/api/alerts/settings` |
| PUT | `/api/alerts/settings` |
| POST | `/api/alerts/test` |
| GET | `/api/public/profile/{slug}` |
| PUT | `/api/profile/visibility` |
| GET | `/api/profile/slug` |

---

*End of document. Update this file whenever schema, env vars, or major flows change. For per-field request/response bodies, prefer the generated OpenAPI at `/docs` alongside this narrative.*
