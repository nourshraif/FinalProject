import requests
from bs4 import BeautifulSoup
import time
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class HireLebaneseScraper:
    def __init__(self):
        self.base_url = "https://www.hirelebanese.com"
        self.search_url = (
            "https://www.hirelebanese.com"
            "/searchresults.aspx"
            "?resume=1&top={offset}"
            "&category=&company=&country=241"
        )
        self.headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,"
                      "application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Connection": "keep-alive",
        }
        self.source_name = "HireLebanese"
        self.jobs_per_page = 10
        self.max_pages = 20
        self.delay = 2

    def scrape_jobs(self) -> List[Dict[str, Any]]:
        all_jobs = []
        logger.info(f"Starting {self.source_name} scraper")

        for page in range(self.max_pages):
            offset = page * self.jobs_per_page
            url = self.search_url.format(offset=offset)

            try:
                response = requests.get(
                    url,
                    headers=self.headers,
                    timeout=15
                )

                if response.status_code != 200:
                    break

                soup = BeautifulSoup(
                    response.text, "html.parser"
                )

                job_cards = soup.find_all(
                    "div", class_="panel-heading"
                )

                if not job_cards:
                    break

                for card in job_cards:
                    job = self._parse_job_card(card)
                    if job:
                        all_jobs.append(job)

                if len(job_cards) < self.jobs_per_page:
                    break

                time.sleep(self.delay)

            except Exception as e:
                logger.error(f"Error on page {page + 1}: {e}")
                break

        logger.info(
            f"HireLebanese: {len(all_jobs)} jobs scraped"
        )
        return all_jobs

    def _parse_job_card(self, card) -> Optional[Dict[str, Any]]:
        try:
            title_tag = card.find("h4")
            if not title_tag:
                return None

            link_tag = title_tag.find("a")
            if not link_tag:
                return None

            job_title = link_tag.get_text(strip=True)

            href = link_tag.get("href", "")
            if href.startswith("../"):
                href = href.replace("../", "/")
            job_url = self.base_url + href

            company = "Unknown"
            location = "Lebanon"

            info_div = card.find("div", class_="col-xs-9")
            if info_div:
                info_text = info_div.get_text(strip=True)
                parts = [
                    p.strip()
                    for p in info_text.split("-")
                    if p.strip()
                ]
                if len(parts) >= 1:
                    company = parts[0].strip()
                if len(parts) >= 3:
                    location = (
                        parts[1].strip()
                        + " - "
                        + parts[2].strip()
                    )
                elif len(parts) >= 2:
                    location = parts[1].strip()

            description = ""
            date_posted = ""
            desc_divs = card.find_all("div", class_="col-xs-12")

            for div in desc_divs:
                style = div.get("style", "")
                if "color" in style:
                    date_text = div.get_text(strip=True)
                    date_posted = date_text.replace(
                        "Posted at ", ""
                    ).strip()
                else:
                    desc_text = div.get_text(
                        strip=True, separator=" "
                    )
                    if desc_text:
                        description = desc_text

            if not job_title or not job_url:
                return None

            # Keys title/url match ScraperService.save_job and other scrapers.
            return {
                "source": self.source_name,
                "title": job_title,
                "company": company,
                "location": location,
                "description": description,
                "url": job_url,
                "date_posted": date_posted,
                "scraped_at": datetime.now().isoformat(),
            }

        except Exception as e:
            logger.error(f"Error parsing card: {e}")
            return None


def scrape_hirelebanese() -> List[Dict[str, Any]]:
    scraper = HireLebaneseScraper()
    return scraper.scrape_jobs()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    jobs = scrape_hirelebanese()
    print(f"\nTotal jobs scraped: {len(jobs)}")
    if jobs:
        print("\nFirst job:")
        for key, value in jobs[0].items():
            print(f"  {key}: {value}")
