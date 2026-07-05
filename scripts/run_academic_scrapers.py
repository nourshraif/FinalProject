"""Scrape academic job boards and insert jobs into the database.

Usage (local):
  python scripts/run_academic_scrapers.py

Usage (VPS / Docker):
  docker compose exec backend python scripts/run_academic_scrapers.py
  docker compose exec backend python scripts/run_academic_scrapers.py jobrxiv euraxess
"""
import argparse
import logging
import sys
import time
from pathlib import Path
from typing import List, Optional

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env")

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

from app.database.db import get_connection
from app.services.Scrapers.academicpositions import AcademicPositionsScraper
from app.services.Scrapers.biospace import BioSpaceScraper
from app.services.Scrapers.euraxess import EuraxessScraper
from app.services.Scrapers.jobrxiv import JobRxivScraper
from app.services.scraper_service import ScraperService

ACADEMIC_SCRAPERS = {
    "academicpositions": AcademicPositionsScraper,
    "biospace": BioSpaceScraper,
    "euraxess": EuraxessScraper,
    "jobrxiv": JobRxivScraper,
}


def run_academic_scrapers(source_keys: Optional[List[str]] = None, delay_seconds: int = 2) -> dict:
    keys = source_keys or list(ACADEMIC_SCRAPERS.keys())
    conn = get_connection()
    service = ScraperService(conn)

    try:
        print(f"\n{'=' * 80}")
        print("ACADEMIC JOB BOARD INGEST (scrape + save to DB)")
        print(f"{'=' * 80}\n")

        raw_jobs = []
        service.stats.log_phase_header(1, "ACADEMIC INGESTION")

        for key in keys:
            name = key.lower()
            cls = ACADEMIC_SCRAPERS.get(name)
            if not cls:
                print(f"  ? Unknown source: {name}")
                continue

            scraper = cls()
            try:
                jobs = scraper.scrape()
                raw_jobs.extend(jobs)
                service.stats.source_breakdown[scraper.source_name] = len(jobs)
                service.stats.sources_processed += 1
                service.stats.total_fetched += len(jobs)
                print(f"  OK {scraper.source_name:20s} -> {len(jobs):4d} jobs")
                time.sleep(delay_seconds)
            except Exception as exc:
                logger.error("Error scraping %s: %s", scraper.source_name, exc, exc_info=True)
                print(f"  ERR {scraper.source_name:20s} -> {exc}")

        print(
            f"\nPHASE 1: {service.stats.total_fetched} jobs fetched "
            f"from {service.stats.sources_processed} academic boards"
        )
        service.stats.log_phase_complete()

        processed = service.phase2_process_jobs(raw_jobs)
        service.phase3_store_jobs(processed, batch_size=50)
        service.stats.print_summary()
        service._print_db_stats()

        return {
            "collected": service.stats.total_fetched,
            "inserted": service.stats.jobs_inserted,
            "updated": service.stats.jobs_updated,
            "unchanged": service.stats.jobs_unchanged,
            "saved": service.stats.total_saved,
            "duplicates": service.stats.duplicates_found,
            "errors": service.stats.errors_count,
        }
    finally:
        service.close()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Scrape academic job boards and save jobs to the database"
    )
    parser.add_argument(
        "sources",
        nargs="*",
        help="Optional keys: academicpositions biospace euraxess jobrxiv (default: all)",
    )
    args = parser.parse_args()

    try:
        result = run_academic_scrapers(args.sources or None)
        print(
            f"\nDone — fetched {result['collected']}, "
            f"new {result['inserted']}, updated {result['updated']}, "
            f"unchanged {result['unchanged']}, errors {result['errors']}"
        )
        return 0
    except Exception as exc:
        logger.error("Fatal error: %s", exc, exc_info=True)
        return 1


if __name__ == "__main__":
    sys.exit(main())
