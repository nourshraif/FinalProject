# Run Postgres (pgvector) in Docker, everything else locally

## 1. Start Postgres in Docker

```powershell
cd c:\Users\nours\Desktop\FinalProject\FinalProject
docker compose up -d
```

Postgres with pgvector will be available at **localhost:5433** (host port 5433 → container 5432).

## 2. Configure .env for local app

Copy and edit `.env`:

```env
# Connect to Postgres running in Docker from your machine
DB_HOST=localhost
DB_PORT=5433
DB_NAME=jobs_db
DB_USER=postgres
DB_PASSWORD=202211217nour

HF_TOKEN=your_huggingface_token_here
HF_MODEL=openai/gpt-oss-120b:groq
```

## 3. Install Python dependencies (once)

```powershell
pip install -r requirements.txt
```

## 4. Create tables (once)

```powershell
python -m scripts.setup_vector_tables
```

## 5. Run scraper locally

```powershell
python -m scripts.scheduled_scraper
```

## 6. Run Streamlit UI locally

```powershell
streamlit run scripts/integrated_job_matcher_app.py
```

Opens at http://localhost:8501

---

## Summary

| In Docker        | Locally                          |
|------------------|----------------------------------|
| Postgres + pgvector | Python, scraper, Streamlit UI |

- Stop Postgres: `docker compose down`
- Start again: `docker compose up -d`
