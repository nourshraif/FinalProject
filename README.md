# Job Matcher - Automatic Scraping System

[![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)](https://www.python.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-green.svg)](https://www.docker.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-blue.svg)](https://www.postgresql.org/)
[![Streamlit](https://img.shields.io/badge/Streamlit-UI-red.svg)](https://streamlit.io/)

A production-ready job matching system with **fully automatic scraping** that runs on Docker container startup. This system scrapes job listings from multiple sources, generates vector embeddings for semantic matching, and provides an intuitive Streamlit interface for CV-to-job matching.

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

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd FinalProject
```

### 2. Configure Environment

```bash
# Copy the example environment file
cp env.example .env

# Edit .env and add your Hugging Face API key
# HF_TOKEN=your_huggingface_token_here
```

### 3. Start Everything (One Command)

```bash
docker compose up
```

This will:
1. ✅ Start PostgreSQL database with pgvector extension
2. ✅ Automatically run job scraping from all sources
3. ✅ Generate embeddings automatically for all jobs
4. ✅ Exit when complete
5. ✅ Database is ready for the UI

**Wait for scraping to complete** (check logs: `docker logs job-scraper`)

### 4. Start the UI

In a new terminal:

```bash
# Install dependencies (if not using Docker)
pip install -r requirements.txt

# Start Streamlit UI
streamlit run scripts/integrated_job_matcher_app.py
```

The UI will open automatically in your browser at `http://localhost:8501`

## Architecture

### Automatic Scraping

- **Runs on container startup**: When you run `docker compose up`, scraping happens automatically
- **Idempotent**: Safe to run multiple times (duplicates are skipped)
- **Automatic embeddings**: Generated during scraping, no manual steps
- **One-time execution**: Scraper runs once and exits cleanly

### Components

1. **PostgreSQL** (`postgres` service)
   - Database with pgvector extension
   - Stores jobs and embeddings

2. **Job Scraper** (`scraper` service)
   - Runs automatically on container startup
   - Scrapes jobs from all configured sources
   - Generates embeddings automatically
   - Exits after completion

3. **Streamlit UI** (run separately)
   - Read-only interface
   - Assumes database is populated
   - No scraping or embedding controls

## How It Works

```
docker compose up
    ↓
PostgreSQL starts
    ↓
Scraper container starts
    ↓
Scraper runs automatically:
  - Scrapes jobs
  - Saves to database
  - Generates embeddings
    ↓
Scraper exits
    ↓
Database is ready
    ↓
Start UI: streamlit run scripts/integrated_job_matcher_app.py
```

## Key Features

- ✅ **Zero manual commands**: Just `docker compose up`
- ✅ **Fully automatic**: Scraping happens on startup
- ✅ **Idempotent**: Safe to restart containers
- ✅ **Production-ready**: Clean, simple, reliable
- ✅ **Read-only UI**: No setup buttons or controls

## Project Structure

```
FinalProject/
├── docker-compose.yml          # Docker configuration (PostgreSQL + Scraper)
├── Dockerfile                  # Container image definition
├── requirements.txt            # Python dependencies
├── .env                        # Environment configuration (copy from env.example)
├── .gitignore                  # Git ignore rules
├── env.example                 # Environment template
├── README.md                   # This file
├── scripts/
│   ├── scheduled_scraper.py    # Main scraper (runs on startup)
│   ├── integrated_job_matcher_app.py  # Streamlit UI
│   ├── check_all_scrapers.py  # Validate scraper implementations
│   ├── check_embeddings_status.py  # Diagnostic tool
│   ├── check_database.py      # Database connection checker
│   ├── check_database_connection.py  # Connection test
│   ├── enable_pgvector.py     # Enable pgvector extension
│   └── setup_vector_tables.py # Setup vector tables
└── app/
    ├── services/
    │   ├── scraper_service.py  # Scraping logic + auto-embedding
    │   ├── embedding_service.py # Embedding generation utilities
    │   ├── vector_matching_service.py # Vector-based matching
    │   ├── matching_service.py # Pattern-based matching
    │   ├── skill_extraction_service.py # CV skill extraction
    │   └── Scrapers/          # Individual scraper implementations
    ├── database/
    │   ├── db.py               # Database connection
    │   └── models.py            # Database models
    └── utils/
        └── pdf_utils.py        # PDF text extraction
```

## Configuration

### Environment Variables

Edit `.env` file with your configuration:

```env
# Database Configuration
DB_HOST=postgres          # Use 'postgres' for Docker, 'localhost' for local
DB_NAME=jobs_db
DB_USER=postgres
DB_PASSWORD=your_password
DB_PORT=5432              # Use 5432 for Docker, 5433 for local (if local PG running)

# Hugging Face API
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

## Setup Instructions

### First Time Setup

1. **Copy environment file:**
   ```bash
   cp env.example .env
   ```

2. **Edit `.env` with your database settings:**
   ```env
   DB_HOST=postgres
   DB_NAME=jobs_db
   DB_USER=postgres
   DB_PASSWORD=your_password
   DB_PORT=5432
   HF_API_KEY=your_huggingface_api_key
   ```

3. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Start Docker containers:**
   ```bash
   docker compose up
   ```
   Wait for scraping to complete (check logs: `docker logs job-scraper`)

5. **Start the UI:**
   ```bash
   streamlit run scripts/integrated_job_matcher_app.py
   ```

## Monitoring & Utilities

### Check Scraper Logs

```bash
# View logs from last run
docker logs job-scraper

# View logs in real-time (if running)
docker logs -f job-scraper
```

### Check Database Status

```bash
# Count jobs
python -c "from app.database.db import get_connection; conn = get_connection(); cur = conn.cursor(); cur.execute('SELECT COUNT(*) FROM jobs'); print(f'Jobs: {cur.fetchone()[0]}'); conn.close()"

# Count embeddings
python -c "from app.database.db import get_connection; conn = get_connection(); cur = conn.cursor(); cur.execute('SELECT COUNT(*) FROM job_embeddings'); print(f'Embeddings: {cur.fetchone()[0]}'); conn.close()"

# Check embeddings status (detailed)
python -m scripts.check_embeddings_status

# Check database connection
python -m scripts.check_database_connection
```

### Utility Scripts

- **`check_all_scrapers.py`**: Validate all scraper implementations
- **`check_embeddings_status.py`**: Check embedding generation status
- **`check_database.py`**: Database health check
- **`check_database_connection.py`**: Test database connection
- **`enable_pgvector.py`**: Enable pgvector extension manually
- **`setup_vector_tables.py`**: Setup vector tables if missing

## Troubleshooting

### Scraper Not Running

```bash
# Check if container ran
docker ps -a | grep job-scraper

# Check logs
docker logs job-scraper

# Restart and run again
docker compose up scraper
```

### Database Connection Issues

- Verify `.env` file has correct settings
- Check PostgreSQL is running: `docker ps | grep postgres`
- Test connection: `python -m scripts.check_database_connection`
- If using local PostgreSQL, make sure it's stopped or using a different port

### No Jobs in Database

- Check scraper logs: `docker logs job-scraper`
- Verify internet connection (scrapers need internet)
- Run scraper manually: `python -m scripts.scheduled_scraper`
- Check if scrapers are working: `python -m scripts.check_all_scrapers`

### Embeddings Not Generated

- Check embeddings status: `python -m scripts.check_embeddings_status`
- Ensure `job_embeddings` table exists: `python -m scripts.setup_vector_tables`
- Verify pgvector is enabled: `python -m scripts.enable_pgvector`
- Embeddings should generate automatically during scraping, but you can regenerate:
  ```python
  from app.services.vector_matching_service import VectorSkillMatcher
  matcher = VectorSkillMatcher()
  matcher.generate_job_embeddings()
  ```

### UI Not Finding Jobs

- Ensure database has jobs: Check with `check_embeddings_status.py`
- Verify embeddings exist: `python -m scripts.check_embeddings_status`
- Check database connection from UI: Ensure `.env` is configured correctly

## Development

### Manual Scraping (Testing)

```bash
# Run scraper once manually (requires database to be running)
python -m scripts.scheduled_scraper
```

### Re-run Scraping

```bash
# Stop containers
docker compose down

# Start again (scraper runs automatically)
docker compose up
```

### Validate Scrapers

```bash
# Check all scrapers are properly implemented
python -m scripts.check_all_scrapers
```

### Common Commands

```bash
# Start everything
docker compose up

# Start in background
docker compose up -d

# Stop everything
docker compose down

# View scraper logs
docker logs job-scraper

# Restart just the scraper
docker compose up scraper

# Start UI
streamlit run scripts/integrated_job_matcher_app.py

# Check database status
python -m scripts.check_embeddings_status
```

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

- **Current Design**: Scraping runs once on container startup
- **Future Enhancement**: Periodic scheduling (cron/task scheduler) can be added
- **Idempotent**: Safe to restart containers multiple times
- **No Manual Steps**: System is fully automatic

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
