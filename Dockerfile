# Dockerfile for FinalProject
# Multi-stage build for production-ready container

FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Set Python path
ENV PYTHONPATH=/app

# Expose port (if running web server in future)
EXPOSE 8000

# Default command (overridden by docker-compose.yml)
# CMD ["python", "-m", "scripts.scheduled_scraper"]
