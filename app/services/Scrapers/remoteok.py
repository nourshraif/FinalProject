# app/services/Scrapers/remoteok.py

from .base_scraper import BaseScraper
import requests
from typing import Any, Dict, List, Optional


class RemoteOkScraper(BaseScraper):
    """Scraper for RemoteOK.com via the official public JSON API."""

    API_URL = "https://remoteok.com/api"

    @property
    def source_name(self) -> str:
        return "remoteok"

    def scrape(self) -> List[Dict]:
        """Fetch RemoteOK jobs from https://remoteok.com/api."""
        print(f"\n=== Scraping {self.source_name} ===")
        jobs: List[Dict] = []

        try:
            response = requests.get(self.API_URL, headers=self.headers, timeout=30)
            response.raise_for_status()
            payload = response.json()

            if not isinstance(payload, list):
                print(f"✗ Unexpected RemoteOK API response type: {type(payload)}")
                return jobs

            for item in payload:
                job = self._parse_job(item)
                if job:
                    jobs.append(job)

            print(f"✓ Collected {len(jobs)} jobs from {self.source_name}")

        except Exception as e:
            print(f"✗ Error: {e}")

        return jobs

    def _parse_job(self, item: Any) -> Optional[Dict]:
        if not isinstance(item, dict):
            return None

        title = str(item.get("position") or "").strip()
        if len(title) < 5:
            return None

        company = str(item.get("company") or "Remote OK").strip() or "Remote OK"
        location = str(item.get("location") or "").strip() or "Remote"

        job_url = str(item.get("url") or "").strip()
        if not job_url:
            job_id = item.get("slug") or item.get("id")
            if job_id:
                job_url = f"https://remoteok.com/remote-jobs/{job_id}"

        if len(job_url) < 5:
            return None

        tags = item.get("tags") or []
        if isinstance(tags, list):
            description = ", ".join(str(tag).strip() for tag in tags if tag)
        else:
            description = str(tags).strip()

        return {
            "source": self.source_name,
            "title": title[:255],
            "company": company[:255],
            "location": location[:255],
            "description": description[:500] if description else None,
            "url": job_url,
        }
