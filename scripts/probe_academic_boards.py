"""Probe HTML structures for academic job board scrapers."""
import json
import re

import requests
from bs4 import BeautifulSoup

H = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
    "Accept-Language": "en-US,en;q=0.9",
}


def json_ld_job_count(html: str) -> int:
    soup = BeautifulSoup(html, "html.parser")
    count = 0
    for tag in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(tag.string or "")
        except json.JSONDecodeError:
            continue
        items = data if isinstance(data, list) else [data]
        for item in items:
            if not isinstance(item, dict):
                continue
            t = item.get("@type", "")
            if t == "JobPosting" or (isinstance(t, list) and "JobPosting" in t):
                count += 1
    return count


def euraxess_jobs(html: str):
    soup = BeautifulSoup(html, "html.parser")
    jobs = []
    seen = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if not re.search(r"/jobs/\d+", href):
            continue
        url = href if href.startswith("http") else f"https://euraxess.ec.europa.eu{href}"
        if url in seen:
            continue
        title = a.get_text(" ", strip=True)
        if len(title) < 8:
            continue
        seen.add(url)
        jobs.append((title[:80], url))
    return jobs


def biospace_jobs(html: str):
    soup = BeautifulSoup(html, "html.parser")
    jobs = []
    seen = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "/job/" not in href.lower() and "/jobs/" not in href.lower():
            continue
        if href.startswith("/"):
            url = f"https://jobs.biospace.com{href}"
        elif href.startswith("http"):
            url = href
        else:
            continue
        if url in seen or "search" in url.lower():
            continue
        title = a.get_text(" ", strip=True)
        if len(title) < 5:
            continue
        seen.add(url)
        jobs.append((title[:80], url))
    return jobs[:20]


if __name__ == "__main__":
    targets = [
        ("euraxess", "https://euraxess.ec.europa.eu/jobs/search"),
        ("biospace", "https://jobs.biospace.com/jobs/"),
        ("nature", "https://www.nature.com/naturecareers/searchjobs/results?keywords=&location="),
        ("academicpositions", "https://academicpositions.com/find-jobs"),
    ]
    for name, url in targets:
        r = requests.get(url, headers=H, timeout=30)
        print(f"\n{name}: {r.status_code} {r.url}")
        print(f"  json-ld JobPosting: {json_ld_job_count(r.text)}")
        if name == "euraxess":
            jobs = euraxess_jobs(r.text)
            print(f"  parsed links: {len(jobs)}", jobs[:2])
        if name == "biospace":
            jobs = biospace_jobs(r.text)
            print(f"  parsed links: {len(jobs)}", jobs[:2])
