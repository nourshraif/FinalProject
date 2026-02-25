# Job Matcher

[![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)](https://www.python.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-green.svg)](https://www.docker.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+%20pgvector-blue.svg)](https://www.postgresql.org/)
[![Streamlit](https://img.shields.io/badge/Streamlit-UI-red.svg)](https://streamlit.io/)

Job matching system: scrapes job boards, stores jobs and vector embeddings in PostgreSQL (pgvector), and provides a Streamlit UI for CV-to-job matching. **Postgres runs in Docker; scraper and UI run locally.**

---

## Features

- **Job scraping** from multiple boards (WeWorkRemotely, Indeed, LinkedIn, RemoteOK, Remotive, Arbeitnow, Himalayas, Bayt)
- **Vector embeddings** (Sentence Transformers + pgvector) for semantic job matching
- **CV skill extraction** via Hugging Face API; match CV to jobs by similarity
- **Streamlit UI** – upload CV, view matched jobs
- **Idempotent** – safe to re-run scraper (duplicates skipped)

---

## Prerequisites

- **Docker** and **Docker Compose**
- **Python 3.9+**
- **Hugging Face API token** – [create one](https://huggingface.co/settings/tokens)

---

## Quick Start

From the project root:

```bash
# 1. Environment
cp env.example .env
# Edit .env: set DB_PASSWORD and HF_TOKEN

# 2. Start Postgres (Docker)
docker compose up -d

# 3. One-time: create tables
python -m scripts.setup_vector_tables

# 4. Scrape jobs (optional; run whenever you want fresh data)
python -m scripts.scheduled_scraper

# 5. Run the app
streamlit run scripts/integrated_job_matcher_app.py
```

Open **http://localhost:8501** in your browser.

For detailed steps (including Windows), see **LOCAL_SETUP.md**.

---

## Configuration

Create `.env` from `env.example` and set:

| Variable      | Description                    | Example        |
|---------------|--------------------------------|----------------|
| `DB_HOST`     | Postgres host                  | `localhost`    |
| `DB_PORT`     | Postgres port (Docker mapping) | `5433`         |
| `DB_NAME`     | Database name                  | `jobs_db`      |
| `DB_USER`     | Postgres user                  | `postgres`     |
| `DB_PASSWORD` | Postgres password              | *(your choice)*|
| `HF_TOKEN`    | Hugging Face API token         | *(from HF)*    |
| `HF_MODEL`    | Model for skill extraction      | `openai/gpt-oss-120b:groq` |

---

## How It Works

1. **Postgres** (Docker) – stores `jobs` and `job_embeddings` (pgvector).
2. **Scraper** – `python -m scripts.scheduled_scraper` fetches jobs, saves them, and generates embeddings.
3. **Streamlit app** – user uploads a CV; skills are extracted (Hugging Face); vector similarity finds the best-matching jobs.

---

## Project Structure

```
FinalProject/
├── docker-compose.yml           # Postgres + pgvector
├── requirements.txt
├── env.example / .env
├── README.md
├── LOCAL_SETUP.md
├── scripts/
│   ├── scheduled_scraper.py     # Scrape jobs → DB + embeddings
│   ├── setup_vector_tables.py   # Create jobs + job_embeddings
│   └── integrated_job_matcher_app.py   # Streamlit UI
└── app/
    ├── database/db.py           # Connection + init_database
    ├── services/
    │   ├── scraper_service.py
    │   ├── embedding_service.py
    │   ├── vector_matching_service.py
    │   ├── skill_extraction_service.py
    │   └── Scrapers/            # Per-site scrapers
    └── utils/pdf_utils.py
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Connection refused on 5433 | Run `docker compose up -d`. Ensure `.env` has `DB_PORT=5433`. |
| `relation "job_embeddings" does not exist` | Run `python -m scripts.setup_vector_tables`. |
| No jobs / 0 matches in UI | Run `python -m scripts.scheduled_scraper`. To generate embeddings for existing jobs: `python -c "from app.services.vector_matching_service import VectorSkillMatcher; VectorSkillMatcher().generate_job_embeddings()"` |

---

## Tech Stack

- **Python 3.9+** · **PostgreSQL 16** with **pgvector**
- **Sentence Transformers** (all-MiniLM-L6-v2) for embeddings
- **Streamlit** for the UI
- **Hugging Face** API for CV skill extraction
- **BeautifulSoup4 / Requests** for scraping

---

## License

MIT. See LICENSE for details.
