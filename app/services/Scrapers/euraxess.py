# app/services/Scrapers/euraxess.py

import re
from typing import Dict, List, Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from .base_scraper import BaseScraper


class EuraxessScraper(BaseScraper):
    """Scraper for EURAXESS job search (HTML pagination)."""

    BASE_URL = "https://euraxess.ec.europa.eu"
    SEARCH_URL = f"{BASE_URL}/jobs/search"
    MAX_JOBS = 100
    MAX_PAGES = 8

    @property
    def source_name(self) -> str:
        return "euraxess"

    def scrape(self) -> List[Dict]:
        print(f"\n=== Scraping {self.source_name} ===")
        jobs: List[Dict] = []
        seen_urls: set[str] = set()

        try:
            for page in range(1, self.MAX_PAGES + 1):
                if len(jobs) >= self.MAX_JOBS:
                    break
                response = requests.get(
                    self.SEARCH_URL,
                    params={"page": page},
                    headers=self.headers,
                    timeout=30,
                )
                response.raise_for_status()
                batch = self._parse_page(response.text, seen_urls)
                if not batch:
                    break
                jobs.extend(batch)

            print(f"✓ Collected {len(jobs)} jobs from {self.source_name}")
        except Exception as e:
            print(f"✗ Error: {e}")

        return jobs[: self.MAX_JOBS]

    def _parse_page(self, html: str, seen_urls: set[str]) -> List[Dict]:
        soup = BeautifulSoup(html, "html.parser")
        found: List[Dict] = []

        for anchor in soup.find_all("a", href=True):
            href = anchor["href"].strip()
            if not re.search(r"/jobs/\d+", href):
                continue

            url = urljoin(self.BASE_URL, href)
            if url in seen_urls:
                continue

            title = anchor.get_text(" ", strip=True)
            if len(title) < 8:
                continue

            seen_urls.add(url)
            found.append(
                {
                    "source": self.source_name,
                    "title": title[:255],
                    "company": "EURAXESS",
                    "location": "Europe",
                    "description": None,
                    "url": url,
                }
            )

        return found
