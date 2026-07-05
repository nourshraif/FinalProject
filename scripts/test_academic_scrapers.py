"""Test academic/science job board scrapers.

Usage on VPS:
  docker compose exec backend python scripts/test_academic_scrapers.py
  docker compose exec backend python scripts/test_academic_scrapers.py jobrxiv euraxess
"""
import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from app.services.Scrapers.academicpositions import AcademicPositionsScraper
from app.services.Scrapers.biospace import BioSpaceScraper
from app.services.Scrapers.euraxess import EuraxessScraper
from app.services.Scrapers.jobrxiv import JobRxivScraper

ACADEMIC_SCRAPERS = {
    "academicpositions": AcademicPositionsScraper,
    "biospace": BioSpaceScraper,
    "euraxess": EuraxessScraper,
    "jobrxiv": JobRxivScraper,
}


def main() -> None:
    parser = argparse.ArgumentParser(description="Test academic job board scrapers")
    parser.add_argument(
        "sources",
        nargs="*",
        help="Keys: academicpositions biospace euraxess jobrxiv",
    )
    args = parser.parse_args()
    keys = args.sources if args.sources else list(ACADEMIC_SCRAPERS.keys())

    print("ACADEMIC JOB BOARD SCRAPER TEST")
    print("-" * 60)

    any_error = False
    for key in keys:
        name = key.lower()
        cls = ACADEMIC_SCRAPERS.get(name)
        if not cls:
            print(f"{name:18s}  UNKNOWN (valid: {', '.join(ACADEMIC_SCRAPERS)})")
            any_error = True
            continue
        scraper = cls()
        try:
            jobs = scraper.scrape()
            count = len(jobs)
            status = "OK" if count > 0 else "EMPTY"
            print(f"{name:18s} {count:4d} jobs  [{status}]")
            if count > 0:
                sample = jobs[0]
                print(f"{'':18s} sample: {sample.get('title', '?')[:55]}")
        except Exception as exc:
            any_error = True
            print(f"{name:18s}    0 jobs  [ERROR]  {exc}")

    print("-" * 60)
    sys.exit(1 if any_error else 0)


if __name__ == "__main__":
    main()
