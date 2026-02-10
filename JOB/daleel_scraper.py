import requests
from bs4 import BeautifulSoup
import time
from db import get_connection

# Better headers to avoid Cloudflare blocking
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1"
}

def scrape_jobs():
    url = "https://daleel-madani.org/jobs"
    
    try:
        response = requests.get(url, headers=HEADERS, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        # Check if we're being blocked
        if response.status_code == 403:
            print("[ERROR] Website is blocking automated requests (Cloudflare protection)")
            print("[INFO] This website requires browser automation (Selenium/Playwright) to scrape")
            return
        
        if response.status_code != 200:
            print(f"[ERROR] Failed to fetch page. Status code: {response.status_code}")
            return
        
        soup = BeautifulSoup(response.text, "html.parser")
        
        # Check if page loaded correctly
        page_title = soup.title.string if soup.title else ""
        if "Just a moment" in page_title or "Cloudflare" in response.text:
            print("[ERROR] Cloudflare challenge detected. Website requires browser automation.")
            return
        
        print(f"Page loaded: {page_title}")
        
        # TODO: Update these selectors after inspecting the actual HTML structure
        # You need to inspect the website's HTML to find the correct selectors
        job_containers = soup.select("article, .job-listing, .views-row, div[class*='job']")
        
        if not job_containers:
            print("[WARNING] No job containers found. Selectors may need to be updated.")
            print("[INFO] Try inspecting the page HTML to find the correct CSS selectors")
            return
        
        print(f"Found {len(job_containers)} job listings")
        
        conn = get_connection()
        cur = conn.cursor()
        
        jobs_added = 0
        for job in job_containers:
            try:
                # Try to find title and link - these selectors need to be updated
                title_elem = job.select_one("h2, h3, .title, a")
                link_elem = job.select_one("a")
                
                if title_elem:
                    title = title_elem.get_text(strip=True)
                else:
                    title = job.get_text(strip=True)[:100]  # Fallback
                
                if link_elem:
                    link = link_elem.get("href")
                    if link and not link.startswith("http"):
                        link = "https://daleel-madani.org" + link
                else:
                    link = None
                
                if title and link:
                    cur.execute("""
                        INSERT INTO jobs (source, job_title, job_url)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (job_url) DO NOTHING;
                    """, ("daleel_almadane", title, link))
                    jobs_added += 1
                    print(f"  - {title[:50]}...")
                
                time.sleep(1)  # Be respectful with requests
                
            except Exception as e:
                print(f"[WARNING] Error processing job: {e}")
                continue
        
        conn.commit()
        conn.close()
        print(f"\n[SUCCESS] Added {jobs_added} jobs to database")
        
    except requests.exceptions.RequestException as e:
        print(f"[ERROR] Network error: {e}")
    except Exception as e:
        print(f"[ERROR] Unexpected error: {e}")

if __name__ == "__main__":
    scrape_jobs()

