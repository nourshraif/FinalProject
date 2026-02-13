"""
CLI entrypoint to run the Daleel Madani job scraper.

This script delegates all business logic to the scraper service.
"""

from app.services.scraper_service import scrape_jobs


if __name__ == "__main__":
    scrape_jobs()

