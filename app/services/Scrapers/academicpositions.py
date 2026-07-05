# app/services/Scrapers/academicpositions.py

import re
from typing import Dict, List, Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from .base_scraper import BaseScraper


class AcademicPositionsScraper(BaseScraper):
    """Scraper for AcademicPositions.com listings."""

    BASE_URL = "https://academicpositions.com"
    LISTING_URL = f"{BASE_URL}/find-jobs"
    MAX_JOBS = 80

    @property
    def source_name(self) -> str:
        return "academicpositions"

    def scrape(self) -> List[Dict]:
        print(f"\n=== Scraping {self.source_name} ===")
        jobs: List[Dict] = []
        headers = {
            **self.headers,
            "Accept-Language": "en-US,en;q=0.9",
        }

        try:
            response = requests.get(self.LISTING_URL, headers=headers, timeout=30)
            if response.status_code == 403:
                print("✗ AcademicPositions blocked this server (403). Try from VPS.")
                return jobs
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

        for anchor in soup.find_all("a", href=True):
            href = anchor["href"].strip()
            if not re.search(r"academicpositions\.com/(jobs/|hiring/|position/)", href):
                continue
            if "/jobs/position/" in href:
                continue

            url = href if href.startswith("http") else urljoin(self.BASE_URL, href)
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
                    "company": "Academic Positions",
                    "location": "International",
                    "description": None,
                    "url": url,
                }
            )

        return found
