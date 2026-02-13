"""
Job scraping service for RemoteOK.

This module scrapes remote developer jobs from RemoteOK
and stores them in the database.

Responsibilities:
- Fetch page
- Parse jobs
- Insert jobs into database
- Handle errors safely
"""

import time
import requests
from bs4 import BeautifulSoup

from app.database.db import get_connection


# Browser-like headers (important to avoid blocking)
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Connection": "keep-alive",
}


def scrape_jobs():
    """Scrape jobs from RemoteOK and store them in the database."""

    url = "https://remoteok.com/remote-dev-jobs"

    try:
        print("[INFO] Fetching jobs from RemoteOK...")

        response = requests.get(url, headers=HEADERS, timeout=15)
        print(f"[INFO] Status Code: {response.status_code}")

        # Check for blocking
        if response.status_code == 403:
            print("[ERROR] Website is blocking automated requests.")
            return

        if response.status_code != 200:
            print(f"[ERROR] Failed to fetch page. Status code: {response.status_code}")
            return

        soup = BeautifulSoup(response.text, "html.parser")

        # Check page loaded correctly
        page_title = soup.title.string if soup.title else ""
        print(f"[INFO] Page loaded: {page_title}")

        # RemoteOK job listings
        job_containers = soup.select("tr.job")

        if not job_containers:
            print("[WARNING] No job containers found. Selectors may need updating.")
            return

        print(f"[INFO] Found {len(job_containers)} job listings")

        # Connect to database
        conn = get_connection()
        cur = conn.cursor()

        jobs_added = 0

        for job in job_containers:
            try:
                # Extract title
                title_elem = job.select_one("h2")

                # Extract job link
                link_elem = job.select_one("a.preventLink")

                title = title_elem.get_text(strip=True) if title_elem else None

                link = None
                if link_elem and link_elem.get("href"):
                    link = "https://remoteok.com" + link_elem["href"]

                if not title or not link:
                    continue

                # Insert job
                cur.execute(
                    """
                    INSERT INTO jobs (source, job_title, job_url)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (job_url) DO NOTHING;
                    """,
                    ("remoteok", title, link),
                )

                # Only count if inserted
                if cur.rowcount > 0:
                    jobs_added += 1
                    print(f"[ADDED] {title[:60]}")

                # Be respectful to server
                time.sleep(1)

            except Exception as e:
                print(f"[WARNING] Error processing job: {e}")
                continue

        conn.commit()
        conn.close()

        print(f"\n[SUCCESS] Added {jobs_added} new jobs to database")

    except requests.exceptions.RequestException as e:
        print(f"[ERROR] Network error: {e}")

    except Exception as e:
        print(f"[ERROR] Unexpected error: {e}")
