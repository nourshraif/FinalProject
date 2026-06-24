# app/services/Scrapers/himalayas.py

import time
from typing import Any, Dict, List, Optional

import requests

from .base_scraper import BaseScraper


class HimalayasScraper(BaseScraper):
    """Scraper for Himalayas.app via the official public JSON API."""

    API_URL = "https://himalayas.app/jobs/api"
    PAGE_SIZE = 20
    MAX_JOBS = 100

    @property
    def source_name(self) -> str:
        return "himalayas"

    def scrape(self) -> List[Dict]:
        """Fetch Himalayas jobs with offset/limit pagination."""
        print(f"\n=== Scraping {self.source_name} ===")
        jobs: List[Dict] = []
        offset = 0

        try:
            while len(jobs) < self.MAX_JOBS:
                response = requests.get(
                    self.API_URL,
                    params={"offset": offset, "limit": self.PAGE_SIZE},
                    headers=self.headers,
                    timeout=30,
                )
                response.raise_for_status()
                payload = response.json()

                batch = payload.get("jobs") if isinstance(payload, dict) else None
                if not batch:
                    break

                for item in batch:
                    job = self._parse_job(item)
                    if job:
                        jobs.append(job)
                    if len(jobs) >= self.MAX_JOBS:
                        break

                if len(batch) < self.PAGE_SIZE:
                    break

                offset += len(batch)
                total = payload.get("totalCount")
                if isinstance(total, int) and offset >= total:
                    break

                time.sleep(0.3)

            print(f"✓ Collected {len(jobs)} jobs from {self.source_name}")

        except Exception as e:
            print(f"✗ Error: {e}")

        return jobs

    def _parse_job(self, item: Any) -> Optional[Dict]:
        if not isinstance(item, dict):
            return None

        title = str(item.get("title") or "").strip()
        if len(title) < 5:
            return None

        company = str(item.get("companyName") or "Himalayas").strip() or "Himalayas"
        job_url = str(item.get("applicationLink") or "").strip()
        if len(job_url) < 5:
            return None

        restrictions = item.get("locationRestrictions") or []
        if isinstance(restrictions, list) and restrictions:
            location = ", ".join(str(r).strip() for r in restrictions if r)
        else:
            location = "Remote"

        description = str(item.get("excerpt") or "").strip()
        if not description:
            categories = item.get("categories") or []
            if isinstance(categories, list):
                description = ", ".join(str(c).strip() for c in categories if c)

        return {
            "source": self.source_name,
            "title": title[:255],
            "company": company[:255],
            "location": (location or "Remote")[:255],
            "description": description[:500] if description else None,
            "url": job_url,
        }
