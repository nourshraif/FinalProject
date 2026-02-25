# Job Matcher - Automatic Scraping System

[![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)](https://www.python.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-green.svg)](https://www.docker.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-blue.svg)](https://www.postgresql.org/)
[![Streamlit](https://img.shields.io/badge/Streamlit-UI-red.svg)](https://streamlit.io/)

Job matching system: scrapes job boards, stores jobs and vector embeddings in PostgreSQL (pgvector), and provides a Streamlit UI for CV-to-job matching. Postgres runs in Docker; scraper and UI run locally.

## Features

- 🔄 **Automatic Job Scraping**: Scrapes jobs from 8+ job boards automatically
- 🤖 **AI-Powered Skill Extraction**: Extracts skills from CVs using Hugging Face models
- 🎯 **Vector-Based Matching**: Uses pgvector for semantic similarity matching
- 🐳 **Docker-Ready**: One-command setup with Docker Compose
- 📊 **Interactive UI**: Clean Streamlit interface for job matching
- 🔒 **Production-Ready**: Idempotent, reliable, and fully automated

## Prerequisites

- **Docker** and **Docker Compose** installed
- **Python 3.9+** (for local development)
- **Hugging Face API Key** ([Get one here](https://huggingface.co/settings/tokens))

## Quick Start

1. **Copy env and set DB + HF token:** `cp env.example .env` then edit `.env`.
2. **Start Postgres:** `docker compose up -d`
3. **One-time setup:** `python -m scripts.setup_vector_tables`
4. **Scrape jobs:** `python -m scripts.scheduled_scraper`
5. **Run UI:** `streamlit run scripts/integrated_job_matcher_app.py` → http://localhost:8501

See **LOCAL_SETUP.md** for step-by-step commands.

## Architecture

### Automatic Scraping

- **Runs on container startup**: When you run `docker compose up`, scraping happens automatically
- **Idempotent**: Safe to run multiple times (duplicates are skipped)
- **Automatic embeddings**: Generated during scraping, no manual steps
- **One-time execution**: Scraper runs once and exits cleanly

### Components

1. **PostgreSQL** (Docker) – pgvector extension, stores jobs and embeddings.
2. **Scraper** (local) – `python -m scripts.scheduled_scraper` scrapes sources and generates embeddings.
3. **Streamlit UI** (local) – CV upload and job matching.

## Key Features

- Postgres + pgvector in Docker; app runs locally
- One scraper pipeline, one embedding flow
- Idempotent scraping (duplicates skipped)

## Project Structure

```
FinalProject/
├── docker-compose.yml          # Postgres (pgvector) only
├── requirements.txt
├── env.example / .env
├── README.md
├── LOCAL_SETUP.md             # Run commands
├── scripts/
│   ├── scheduled_scraper.py    # Scrape jobs → DB + embeddings
│   ├── setup_vector_tables.py # Create jobs + job_embeddings tables
│   └── integrated_job_matcher_app.py  # Streamlit UI
└── app/
    ├── database/db.py         # Connection + init_database
    ├── services/
    │   ├── scraper_service.py
    │   ├── embedding_service.py
    │   ├── vector_matching_service.py
    │   ├── skill_extraction_service.py
    │   └── Scrapers/
    └── utils/pdf_utils.py
```

## Configuration

### Environment Variables

Edit `.env` file with your configuration:

```env
DB_HOST=localhost
DB_PORT=5433
DB_NAME=jobs_db
DB_USER=postgres
DB_PASSWORD=your_password
HF_TOKEN=your_huggingface_token_here
HF_MODEL=openai/gpt-oss-120b:groq
```

### Supported Job Boards

The system scrapes from the following job boards:
- WeWorkRemotely
- Indeed
- LinkedIn
- RemoteOK
- Remotive
- Arbeitnow
- Himalayas
- Bayt

To add or remove scrapers, edit `app/services/Scrapers/__init__.py`

## Setup

1. `cp env.example .env` and set `DB_PASSWORD`, `HF_TOKEN`.
2. `docker compose up -d` (start Postgres).
3. `python -m scripts.setup_vector_tables` (once).
4. `python -m scripts.scheduled_scraper` (to fetch jobs).
5. `streamlit run scripts/integrated_job_matcher_app.py`.

## Troubleshooting

- **Connection refused:** Start Postgres with `docker compose up -d`. Use `DB_PORT=5433` in `.env`.
- **relation "job_embeddings" does not exist:** Run `python -m scripts.setup_vector_tables`.
- **No jobs in UI:** Run the scraper, then generate embeddings for existing jobs:
  `python -c "from app.services.vector_matching_service import VectorSkillMatcher; VectorSkillMatcher().generate_job_embeddings()"`

## Technology Stack

- **Backend**: Python 3.9+
- **Database**: PostgreSQL 16 with pgvector extension
- **Vector Embeddings**: Sentence Transformers (all-MiniLM-L6-v2)
- **Web Scraping**: BeautifulSoup4, Requests
- **UI Framework**: Streamlit
- **Containerization**: Docker & Docker Compose
- **AI/ML**: Hugging Face Transformers, scikit-learn

## How It Works

1. **Scraping**: Automatically scrapes jobs from configured job boards
2. **Storage**: Jobs are stored in PostgreSQL with deduplication
3. **Embedding Generation**: Each job description is converted to a vector embedding
4. **CV Processing**: User uploads CV, skills are extracted using AI
5. **Matching**: Vector similarity search finds the best matching jobs
6. **Results**: Displayed in an intuitive Streamlit interface

## Production Notes

- Postgres in Docker; scraper and UI run locally. Idempotent scraping (duplicates skipped).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with [Streamlit](https://streamlit.io/)
- Vector embeddings powered by [Sentence Transformers](https://www.sbert.net/)
- Database powered by [PostgreSQL](https://www.postgresql.org/) and [pgvector](https://github.com/pgvector/pgvector)
- AI models from [Hugging Face](https://huggingface.co/)
