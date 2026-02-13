import requests
from bs4 import BeautifulSoup

from app.database.db import get_connection  # PostgreSQL connection function

# URL of Python.org jobs
URL = "https://www.python.org/jobs/"

HEADERS = {"User-Agent": "Mozilla/5.0"}

# Connect to database
conn = get_connection()
cur = conn.cursor()

# Fetch the page
response = requests.get(URL, headers=HEADERS)
soup = BeautifulSoup(response.text, "html.parser")

# Find all job listings
jobs = soup.select("ol.list-recent-jobs li")  # job container
print(f"Found {len(jobs)} jobs")

for job in jobs:
    title_elem = job.select_one("h2")  # job title
    company_elem = job.select_one("span.company")  # company
    location_elem = job.select_one("span.location")  # location
    link_elem = job.select_one("a")  # job link

    title = title_elem.get_text(strip=True) if title_elem else None
    company = company_elem.get_text(strip=True) if company_elem else None
    location = location_elem.get_text(strip=True) if location_elem else None
    link = link_elem.get("href") if link_elem else None

    if link and not link.startswith("http"):
        link = "https://www.python.org" + link

    if title and link:
        print(title, "|", company, "|", location, "|", link)
        cur.execute(
            """
            INSERT INTO jobs (source, job_title, company, location, description, job_url)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (job_url) DO NOTHING;
        """,
            ("python.org", title, company, location, None, link),
        )

conn.commit()
conn.close()

