#!/usr/bin/env bash
# Start FastAPI backend and Next.js frontend in parallel.
# Run from project root. Stop with Ctrl+C.

set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "Starting FastAPI (port 8000) and Next.js (port 3000)..."
echo ""

# Start uvicorn in background
uvicorn api.main:app --reload --port 8000 &
UVICORN_PID=$!

# Start Next.js in background
(cd frontend && npm run dev) &
NEXT_PID=$!

cleanup() {
  echo ""
  echo "Shutting down..."
  kill $UVICORN_PID 2>/dev/null || true
  kill $NEXT_PID 2>/dev/null || true
  exit 0
}

trap cleanup SIGINT SIGTERM

echo "API:    http://localhost:8000"
echo "Frontend: http://localhost:3000"
echo "Press Ctrl+C to stop both."
wait
