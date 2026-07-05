# app/services/Scrapers/biospace.py

from typing import Dict, List, Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from .base_scraper import BaseScraper


class BioSpaceScraper(BaseScraper):
    """Scraper for BioSpace job search results."""

    BASE_URL = "https://jobs.biospace.com"
    SEARCH_URL = f"{BASE_URL}/searchjobs/"
    MAX_JOBS = 100

    @property
    def source_name(self) -> str:
        return "biospace"

    def scrape(self) -> List[Dict]:
        print(f"\n=== Scraping {self.source_name} ===")
        jobs: List[Dict] = []

        try:
            response = requests.get(
                self.SEARCH_URL,
                params={"Keywords": "", "Location": ""},
                headers=self.headers,
                timeout=30,
            )
            response.raise_for_status()
            jobs = self._parse_html(response.text)
            print(f"✓ Collected {len(jobs)} jobs from {self.source_name}")
        except Exception as e:
            print(f"✗ Error: {e}")

        return jobs[: self.MAX_JOBS]

    def _parse_html(self, html: str) -> List[Dict]:
        soup = BeautifulSoup(html, "html.parser")
        found: List[Dict] = []
        seen_urls: set[str] = set()

        for heading in soup.select("h3 a[href]"):
            href = heading.get("href", "").strip()
            title = heading.get_text(" ", strip=True)
            if len(title) < 5 or not href:
                continue

            url = urljoin(self.BASE_URL, href)
            if url in seen_urls or url.rstrip("/") == f"{self.BASE_URL}/jobs":
                continue

            company = "BioSpace"
            parent = heading.find_parent(["article", "li", "div"])
            if parent:
                meta = parent.get_text(" ", strip=True)
                if " - " in meta:
                    parts = meta.split(" - ")
                    if len(parts) > 1:
                        company = parts[-1].strip()[:255]

            seen_urls.add(url)
            found.append(
                {
                    "source": self.source_name,
                    "title": title[:255],
                    "company": company,
                    "location": "USA",
                    "description": None,
                    "url": url,
                }
            )

        return found
