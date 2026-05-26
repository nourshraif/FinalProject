# Run Postgres (pgvector) in Docker, everything else locally

## 1. Start Postgres in Docker

```powershell
cd c:\Users\Admin\Downloads\FinalProject-main
docker compose up -d
```

Postgres with `pgvector` will be available at **localhost:5433** by default.

## 2. Configure `.env` for local app

Copy and edit `.env`:

```powershell
copy env.example .env
```

Then set at least:

```env
DB_HOST=localhost
DB_PORT=5433
DB_NAME=jobs_db
DB_USER=postgres
DB_PASSWORD=your_postgres_password

HF_TOKEN=your_huggingface_token_here
HF_MODEL=openai/gpt-oss-120b:groq
SECRET_KEY=your_secret_key
```

## 3. Install Python dependencies (once)

```powershell
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

## 4. Create database tables (once)

```powershell
python app/database/db.py
```

## 5. Seed jobs and build embeddings

```powershell
python -m scripts.scheduled_scraper
python -m scripts.setup_vector_tables
```

## 6. Run the backend API locally

```powershell
uvicorn api.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.

## 7. Run the frontend locally

```powershell
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:3000`.

---

## Optional: local Streamlit demo

```powershell
streamlit run scripts/integrated_job_matcher_app.py
```

Opens at `http://localhost:8501`.

---

## Notes

- Run `uvicorn` from the directory that contains the `api/` folder to avoid `ModuleNotFoundError: No module named 'api'`.
- If you want to reset Postgres, use `docker compose down` and `docker compose up -d`.
- The project now uses `requirements.txt` with the current active dependencies for backend and scraper services.
