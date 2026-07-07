"""One-off: archive scraped jobs marked expired on the source site.

Usage:
  python scripts/archive_expired_jobs.py
  docker compose exec backend python scripts/archive_expired_jobs.py
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env")

from app.database.db import archive_expired_scraped_jobs


def main() -> None:
    result = archive_expired_scraped_jobs()
    print("Expired job cleanup:")
    print(f"  archived:    {result.get('archived', 0)}")
    print(f"  deleted:     {result.get('deleted', 0)}")
    print(f"  deactivated: {result.get('deactivated', 0)} (saved bookmarks kept)")


if __name__ == "__main__":
    main()
