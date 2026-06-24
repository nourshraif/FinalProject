"""Quick smoke test: how many jobs each active scraper returns."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.services.Scrapers import get_all_scrapers
from app.services.Scrapers.hirelebanese_scraper import scrape_hirelebanese
from app.services.Scrapers.careersandjobsinlebanon_scraper import (
    scrape_careersandjobsinlebanon,
)


def main() -> None:
    results: list[tuple[str, int, str | None]] = []

    for scraper in get_all_scrapers():
        name = scraper.source_name
        try:
            jobs = scraper.scrape()
            results.append((name, len(jobs), None))
        except Exception as exc:
            results.append((name, 0, str(exc)[:120]))

    for label, fn in (
        ("hirelebanese", scrape_hirelebanese),
        ("careersandjobsinlebanon", scrape_careersandjobsinlebanon),
    ):
        try:
            jobs = fn()
            results.append((label, len(jobs), None))
        except Exception as exc:
            results.append((label, 0, str(exc)[:120]))

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
