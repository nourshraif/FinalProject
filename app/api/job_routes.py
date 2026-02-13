"""
Job-related API orchestration.

For now this simply provides a thin wrapper around the Daleel Madani
scraper service, so a web framework or CLI can trigger scraping without
knowing scraping details.
"""

from app.services.scraper_service import scrape_jobs


def refresh_jobs_from_daleel() -> None:
    """
    Trigger a full scrape of Daleel Madani jobs.
    """

    scrape_jobs()

