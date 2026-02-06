import requests
from bs4 import BeautifulSoup
import time
from db import get_connection

HEADERS = {"User-Agent": "Academic Project"}

def scrape_jobs():
    url = "https://daleel-madani.org/jobs" 
    response = requests.get(url, headers=HEADERS)
    soup = BeautifulSoup(response.text, "html.parser")

    conn = get_connection()
    cur = conn.cursor()

    for job in soup.select("JOB_CARD_SELECTOR"):
        title = job.select_one("TITLE_SELECTOR").get_text(strip=True)
        link = job.get("href")

        cur.execute("""
            INSERT INTO jobs (source, job_title, job_url)
            VALUES (%s, %s, %s)
            ON CONFLICT (job_url) DO NOTHING;
        """, ("daleel_almadane", title, link))

        time.sleep(2)

    conn.commit()
    conn.close()

if __name__ == "__main__":
    scrape_jobs()
url = "https://daleel-madani.org/civil-society-directory/megaphone/jobs"
response = requests.get(url, headers=HEADERS)
soup = BeautifulSoup(response.text, "html.parser")

