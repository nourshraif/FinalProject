import requests
from bs4 import BeautifulSoup
from db import get_connection  # your DB connection

URL = "https://weworkremotely.com/remote-jobs"
HEADERS = {"User-Agent": "Mozilla/5.0"}

conn = get_connection()
cur = conn.cursor()

response = requests.get(URL, headers=HEADERS)
soup = BeautifulSoup(response.text, "html.parser")

jobs = soup.select("section.jobs article li a")
print(f"Found {len(jobs)} jobs")

for job in jobs:
    # Try span.title first
    title_elem = job.select_one("span.title")
    title = title_elem.get_text(strip=True) if title_elem else None

    # Fallback: use the <a> text itself
    if not title:
        title = job.get_text(strip=True)

    company_elem = job.select_one("span.company")
    company = company_elem.get_text(strip=True) if company_elem else None

    link = job.get("href")
    if not link:
        continue
    if not link.startswith("http"):
        link = "https://weworkremotely.com" + link

    print(title, "|", company, "|", link)  # debug print

    cur.execute("""
        INSERT INTO jobs (source, job_title, company, location, description, job_url)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (job_url) DO NOTHING;
    """, ("weworkremotely", title, company, None, None, link))

conn.commit()
conn.close()
