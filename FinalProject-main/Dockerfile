# App image: code only. Depends on finalproject-base (see Dockerfile.base).
# Build is fast (~seconds) as long as finalproject-base exists.
# Ensure base exists first: docker build -f Dockerfile.base -t finalproject-base .

FROM finalproject-base:latest

WORKDIR /app

COPY . .

ENV PYTHONPATH=/app

EXPOSE 8000

# Default command (overridden by docker-compose.yml)
# CMD ["pythno", "-m", "scripts.scheduled_scraper"]
