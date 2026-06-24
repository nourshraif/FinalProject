# app/services/Scrapers/remotive.py

from typing import Any, Dict, List, Optional

import requests

from .base_scraper import BaseScraper


class RemotiveScraper(BaseScraper):
    """Scraper for Remotive.com via the official public JSON API."""

    API_URL = "https://remotive.com/api/remote-jobs"

    @property
    def source_name(self) -> str:
        return "remotive"

    def scrape(self) -> List[Dict]:
        """Fetch Remotive jobs from https://remotive.com/api/remote-jobs."""
        print(f"\n=== Scraping {self.source_name} ===")
        jobs: List[Dict] = []

        try:
            response = requests.get(self.API_URL, headers=self.headers, timeout=30)
            response.raise_for_status()
            payload = response.json()
            listings = payload.get("jobs") if isinstance(payload, dict) else None

            if not isinstance(listings, list):
                print(f"✗ Unexpected Remotive API response: missing jobs list")
                return jobs

            for item in listings:
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

        title = str(item.get("title") or "").strip()
        if len(title) < 5:
            return None

        company = str(item.get("company_name") or "Remotive").strip() or "Remotive"
        job_url = str(item.get("url") or "").strip()
        if len(job_url) < 5:
            return None

        location = str(item.get("candidate_required_location") or "Remote").strip() or "Remote"

        tags = item.get("tags") or []
        if isinstance(tags, list):
            description = ", ".join(str(tag).strip() for tag in tags if tag)
        else:
            description = str(tags).strip()

        if not description:
            category = str(item.get("category") or "").strip()
            if category:
                description = category

        return {
            "source": self.source_name,
            "title": title[:255],
            "company": company[:255],
            "location": location[:255],
            "description": description[:500] if description else None,
            "url": job_url,
        }
