"""Smoke-test API job boards only (no BeautifulSoup / HTML scrapers).

Usage on VPS:
  docker compose exec backend python scripts/test_api_scrapers.py
  docker compose exec backend python scripts/test_api_scrapers.py remoteok himalayas
"""
import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.services.Scrapers.remoteok import RemoteOkScraper
from app.services.Scrapers.remotive import RemotiveScraper
from app.services.Scrapers.himalayas import HimalayasScraper
from app.services.Scrapers.arbeitnow import ArbeitnowScraper

API_SCRAPERS = {
    "remoteok": RemoteOkScraper,
    "remotive": RemotiveScraper,
    "himalayas": HimalayasScraper,
    "arbeitnow": ArbeitnowScraper,
}


def main() -> None:
    parser = argparse.ArgumentParser(description="Test API-based job board scrapers")
    parser.add_argument(
        "sources",
        nargs="*",
        help="Board keys: remoteok remotive himalayas arbeitnow (default: all four)",
    )
    args = parser.parse_args()

    keys = args.sources if args.sources else list(API_SCRAPERS.keys())
    unknown = [k for k in keys if k.lower() not in API_SCRAPERS]
    if unknown:
        print(f"Unknown source(s): {', '.join(unknown)}")
        print(f"Valid keys: {', '.join(API_SCRAPERS)}")
        sys.exit(1)

    print("API JOB BOARD SCRAPER TEST")
    print("-" * 60)

    any_error = False
    for key in keys:
        name = key.lower()
        scraper = API_SCRAPERS[name]()
        try:
            jobs = scraper.scrape()
            count = len(jobs)
            status = "OK" if count > 0 else "EMPTY"
            print(f"{name:12s} {count:4d} jobs  [{status}]")
            if count > 0:
                sample = jobs[0]
                print(f"             sample: {sample.get('title', '?')[:60]}")
        except Exception as exc:
            any_error = True
            print(f"{name:12s}    0 jobs  [ERROR]  {exc}")

    print("-" * 60)
    sys.exit(1 if any_error else 0)


if __name__ == "__main__":
    main()
