#!/usr/bin/env bash
# Deploy Vertex on Ubuntu (DigitalOcean Droplet)
# Usage:
#   bash scripts/deploy.sh              # git pull + full rebuild
#   SKIP_GIT_PULL=1 bash scripts/deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
BRANCH="${DEPLOY_BRANCH:-main}"

echo "==> Vertex deploy from $ROOT"

if [[ "${SKIP_GIT_PULL:-0}" != "1" ]]; then
  if [[ -d .git ]]; then
    echo "==> Pulling latest from GitHub (${BRANCH})"
    git fetch origin "${BRANCH}"
    git checkout "${BRANCH}"
    git pull --ff-only origin "${BRANCH}"
  else
    echo "WARNING: Not a git repo — skipping git pull. Clone from GitHub first:"
    echo "  git clone https://github.com/nourshraif/FinalProject.git /opt/FinalProject"
  fi
fi

if [[ ! -f .env ]]; then
  echo "ERROR: .env missing. Copy env.example to .env and fill in values first."
  exit 1
fi

if [[ ! -f frontend/.env.local ]]; then
  echo "WARNING: frontend/.env.local missing — creating production defaults"
  cat > frontend/.env.local <<'EOF'
# Same-origin API via nginx (do not use localhost in production builds)
NEXT_PUBLIC_API_URL=
EOF
fi

echo "==> Building Python base image (skip if unchanged: SKIP_BASE_BUILD=1)"
if [[ "${SKIP_BASE_BUILD:-0}" != "1" ]]; then
  DOCKER_BUILDKIT=1 docker build -f Dockerfile.base -t finalproject-base .
fi

echo "==> Building frontend"
cd frontend
npm ci
npm run build
cd ..
docker build -t finalproject-frontend:latest ./frontend

echo "==> Starting stack"
docker compose up -d --build --force-recreate

echo "==> Ensuring database schema (safe on every deploy)"
docker compose run --rm --entrypoint python backend -c \
  "from app.database.db import init_database; init_database()" || true

echo "==> Status"
docker compose ps

if docker compose exec -T backend curl -sf http://localhost:8000/health >/dev/null 2>&1; then
  echo "==> Backend health: OK"
else
  echo "WARNING: Backend health check failed — run: docker compose logs backend --tail 50"
fi

IP="$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
echo ""
echo "Done. Open: http://${IP}"
