import logging
import time
from datetime import datetime
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


class CareersAndJobsInLebanonScraper:
    """
    Scraper for careersandjobsinlebanon.com.
    Uses publicly available pages and avoids robots-disallowed routes.
    """

    def __init__(self) -> None:
        self.base_url = "https://careersandjobsinlebanon.com"
        self.listing_url = f"{self.base_url}/"
        self.source_name = "CareersAndJobsInLebanon"
        self.delay_seconds = 1.2
        self.max_job_links = 60
        self.headers = {
            "User-Agent": (
                "VertexJobScraper/1.0 (+https://careersandjobsinlebanon.com) "
                "Mozilla/5.0"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Connection": "keep-alive",
        }

    def scrape_jobs(self) -> List[Dict[str, Any]]:
        logger.info("Starting %s scraper", self.source_name)
        links = self._collect_job_links()
        if not links:
            logger.warning("%s: no job links found", self.source_name)
            return []

        jobs: List[Dict[str, Any]] = []
        for idx, job_url in enumerate(links):
            try:
                job = self._parse_job_page(job_url)
                if job:
                    jobs.append(job)
            except Exception as exc:
                logger.error("%s: failed to parse %s (%s)", self.source_name, job_url, exc)
            if idx < len(links) - 1:
                time.sleep(self.delay_seconds)

        logger.info("%s: %d jobs scraped", self.source_name, len(jobs))
        return jobs

    def _collect_job_links(self) -> List[str]:
        html = self._fetch_html(self.listing_url)
        if not html:
            return []

        soup = BeautifulSoup(html, "html.parser")
        candidates: List[str] = []

        # Primary pattern used on homepage cards.
        for anchor in soup.select("article.job_listing a[href]"):
            href = anchor.get("href", "").strip()
            if href:
                candidates.append(href)

        # Fallback: any /job/ links in case card classes change.
        for anchor in soup.select("a[href]"):
            href = anchor.get("href", "").strip()
            if "/job/" in href:
                candidates.append(href)

        normalized: List[str] = []
        seen: set[str] = set()
        for href in candidates:
            full = self._normalize_job_url(href)
            if not full:
                continue
            if full in seen:
                continue
            seen.add(full)
            normalized.append(full)
            if len(normalized) >= self.max_job_links:
                break

        return normalized

    def _parse_job_page(self, job_url: str) -> Optional[Dict[str, Any]]:
        html = self._fetch_html(job_url)
        if not html:
            return None

        soup = BeautifulSoup(html, "html.parser")

        title = self._text(soup.select_one("h1.entry-title")) or self._text(soup.find("h1"))
        if not title:
            return None

        company = (
            self._text(soup.select_one(".company .name"))
            or self._text(soup.select_one(".company"))
            or self._text(soup.select_one(".company-name"))
            or "Unknown"
        )
        location = self._text(soup.select_one("li.location")) or self._text(soup.select_one(".company-address")) or "Lebanon"

        description_node = soup.select_one(".job_description") or soup.select_one(".entry-content")
        description = self._text(description_node, separator=" ")

        # Optional posted date extraction from page text.
        date_posted = (
            self._text(soup.select_one("li.date-posted"))
            or self._text(soup.select_one("time"))
        )
        if date_posted.lower().startswith("posted"):
            date_posted = date_posted[6:].strip()

        return {
            "source": self.source_name,
            "title": title,
            "company": company,
            "location": location,
            "description": description,
            "url": job_url,
            "date_posted": date_posted,
            "scraped_at": datetime.now().isoformat(),
        }

    def _fetch_html(self, url: str) -> str:
        response = requests.get(url, headers=self.headers, timeout=20)
        if response.status_code != 200:
            raise RuntimeError(f"HTTP {response.status_code} for {url}")
        return response.text

    def _normalize_job_url(self, href: str) -> Optional[str]:
        url = urljoin(self.base_url, href)
        parsed = urlparse(url)
        if parsed.netloc and "careersandjobsinlebanon.com" not in parsed.netloc:
            return None
        clean = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
        if "/job/" not in clean:
            return None
        return clean.rstrip("/") + "/"

    @staticmethod
    def _text(node: Optional[Any], separator: str = " ") -> str:
        if not node:
            return ""
        return node.get_text(separator=separator, strip=True)


def scrape_careersandjobsinlebanon() -> List[Dict[str, Any]]:
    scraper = CareersAndJobsInLebanonScraper()
    return scraper.scrape_jobs()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    data = scrape_careersandjobsinlebanon()
    print(f"Scraped {len(data)} jobs")
    if data:
        print(data[0])
