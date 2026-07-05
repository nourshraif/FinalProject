# app/services/Scrapers/jobrxiv.py

from typing import Dict, List, Optional

import requests

from .base_scraper import BaseScraper


class JobRxivScraper(BaseScraper):
    """Scraper for jobRxiv.org via WordPress REST API."""

    API_URL = "https://jobrxiv.org/wp-json/wp/v2/job-listings"
    MAX_JOBS = 100
    PER_PAGE = 25

    @property
    def source_name(self) -> str:
        return "jobrxiv"

    def scrape(self) -> List[Dict]:
        print(f"\n=== Scraping {self.source_name} ===")
        jobs: List[Dict] = []
        page = 1

        try:
            while len(jobs) < self.MAX_JOBS:
                response = requests.get(
                    self.API_URL,
                    params={"per_page": self.PER_PAGE, "page": page},
                    headers={**self.headers, "Accept": "application/json"},
                    timeout=30,
                )
                if response.status_code == 400:
                    break
                response.raise_for_status()
                batch = response.json()
                if not isinstance(batch, list) or not batch:
                    break

                for item in batch:
                    job = self._parse_job(item)
                    if job:
                        jobs.append(job)
                    if len(jobs) >= self.MAX_JOBS:
                        break

                if len(batch) < self.PER_PAGE:
                    break
                page += 1

            print(f"✓ Collected {len(jobs)} jobs from {self.source_name}")
        except Exception as e:
            print(f"✗ Error: {e}")

        return jobs

    def _parse_job(self, item: dict) -> Optional[Dict]:
        title = (item.get("title") or {}).get("rendered", "").strip()
        url = (item.get("link") or "").strip()
        if len(title) < 5 or not url:
            return None

        meta = item.get("meta") or {}
        company = str(meta.get("_company_name") or "jobRxiv").strip()[:255]
        excerpt = (item.get("excerpt") or {}).get("rendered", "")
        description = excerpt.replace("<p>", "").replace("</p>", " ").strip()[:500] or None

        location = "Remote"
        regions = item.get("job_listing_region") or []
        if isinstance(regions, list) and regions:
            location = str(regions[0])[:255]

        return {
            "source": self.source_name,
            "title": title[:255],
            "company": company,
            "location": location,
            "description": description,
            "url": url,
        }
