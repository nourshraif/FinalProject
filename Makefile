# FinalProject Docker workflow
# Use "make build-base" once (or when requirements.txt changes), then "make up" for fast startups.

DOCKER_BUILDKIT := 1
export DOCKER_BUILDKIT

BASE_IMAGE := finalproject-base:latest
COMPOSE := docker compose

.PHONY: build-base up up-build rebuild-base help

# Build the base image (Python + system deps + pip packages). Do this once or after changing requirements.txt.
build-base:
	docker build -f Dockerfile.base -t $(BASE_IMAGE) .

# Start services. App image builds in seconds if base exists.
up:
	$(COMPOSE) up -d postgres
	$(COMPOSE) run --rm scraper

# Build app image and start (fast: only rebuilds app layer if base exists).
up-build:
	$(COMPOSE) up -d postgres
	$(COMPOSE) build scraper && $(COMPOSE) run --rm scraper

# Rebuild base image from scratch (e.g. after requirements.txt change). Uses BuildKit cache for speed.
rebuild-base: build-base

help:
	@echo "  build-base   Build base image (run once or when requirements.txt changes)"
	@echo "  up           Start postgres + run scraper (uses existing images)"
	@echo "  up-build     Build app image then run (fast if base already built)"
	@echo "  rebuild-base Alias for build-base"
