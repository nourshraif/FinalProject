#!/usr/bin/env bash
# Deploy Vertex on Ubuntu (DigitalOcean Droplet)
# Usage: bash scripts/deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Vertex deploy from $ROOT"

if [[ ! -f .env ]]; then
  echo "ERROR: .env missing. Copy env.example to .env and fill in values first."
  exit 1
fi

if [[ ! -f frontend/.env.local ]]; then
  echo "WARNING: frontend/.env.local missing — copying from .env.example"
  cp frontend/.env.example frontend/.env.local
fi

echo "==> Building Python base image (skip if unchanged: comment out next line)"
DOCKER_BUILDKIT=1 docker build -f Dockerfile.base -t finalproject-base .

echo "==> Building frontend"
cd frontend
npm ci
npm run build
cd ..
docker build -t finalproject-frontend:latest ./frontend

echo "==> Starting stack"
docker compose up -d --build --force-recreate

echo "==> Status"
docker compose ps

IP="$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
echo ""
echo "Done. Open: http://${IP}"
