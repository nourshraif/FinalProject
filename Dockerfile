# Backend image. Depends on finalproject-base (Python deps + torch).
# Build base first: docker build -f Dockerfile.base -t finalproject-base .

FROM finalproject-base:latest

WORKDIR /app

COPY . .

ENV PYTHONPATH=/app

EXPOSE 8000

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
