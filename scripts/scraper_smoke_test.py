"""Quick smoke test: how many jobs each active scraper returns.

Usage:
  python scripts/scraper_smoke_test.py                    # all scrapers
  python scripts/scraper_smoke_test.py remoteok remotive  # specific boards only
"""
import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.services.Scrapers import get_all_scrapers
from app.services.Scrapers.hirelebanese_scraper import scrape_hirelebanese
from app.services.Scrapers.careersandjobsinlebanon_scraper import (
    scrape_careersandjobsinlebanon,
)

FUNCTION_SCRAPERS = {
    "hirelebanese": scrape_hirelebanese,
    "careersandjobsinlebanon": scrape_careersandjobsinlebanon,
}

# Recently fixed / API-based boards
API_JOB_BOARDS = ("remoteok", "remotive", "himalayas", "arbeitnow")


def main() -> None:
    parser = argparse.ArgumentParser(description="Smoke-test job board scrapers")
    parser.add_argument(
        "sources",
        nargs="*",
        help="Optional source keys (e.g. remoteok remotive). Default: all scrapers.",
    )
    parser.add_argument(
        "--api-only",
        action="store_true",
        help=f"Test only API boards: {', '.join(API_JOB_BOARDS)}",
    )
    args = parser.parse_args()

    if args.api_only:
        wanted = {k.lower() for k in API_JOB_BOARDS}
    elif args.sources:
        wanted = {s.lower() for s in args.sources}
    else:
        wanted = None

    results: list[tuple[str, int, str | None]] = []

    for scraper in get_all_scrapers():
        name = scraper.source_name
        if wanted is not None and name.lower() not in wanted:
            continue
        try:
            jobs = scraper.scrape()
            results.append((name, len(jobs), None))
        except Exception as exc:
            results.append((name, 0, str(exc)[:120]))

    for label, fn in FUNCTION_SCRAPERS.items():
        if wanted is not None and label not in wanted:
            continue
        try:
            jobs = fn()
            results.append((label, len(jobs), None))
        except Exception as exc:
            results.append((label, 0, str(exc)[:120]))

    if wanted is not None and not results:
        print(f"No matching scrapers for: {', '.join(sorted(wanted))}")
        print(f"Available keys: {', '.join(API_JOB_BOARDS + tuple(FUNCTION_SCRAPERS))}")
        sys.exit(1)

    print("SCRAPER SMOKE TEST")
    print("-" * 60)
    for name, count, err in results:
        if count > 0:
            status = "OK"
        elif err:
            status = "ERROR"
        else:
            status = "EMPTY"
        line = f"{name:28s} {count:4d} jobs  [{status}]"
        if err:
            line += f"  {err}"
        print(line)


if __name__ == "__main__":
    main()
