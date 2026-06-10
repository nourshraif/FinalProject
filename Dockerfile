# Backend image. Depends on finalproject-base (Python deps + torch).
# Build base first: docker build -f Dockerfile.base -t finalproject-base .

FROM finalproject-base:latest

WORKDIR /app

# Lightweight deps added after base image (avoids full base rebuild for small requirement changes).
RUN pip install --no-cache-dir python-docx>=1.1.0 striprtf>=0.0.26 olefile>=0.47

COPY . .

ENV PYTHONPATH=/app

EXPOSE 8000

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
