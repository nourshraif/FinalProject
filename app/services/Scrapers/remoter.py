# app/services/Scrapers/remoter.py

from .base_scraper import BaseScraper
import requests
from bs4 import BeautifulSoup
from typing import List, Dict


class RemotersScraper(BaseScraper):
    """Scraper for Remoters.net"""
    
    @property
    def source_name(self) -> str:
        return "remoters"
    
    def scrape(self) -> List[Dict]:
        """Scrape Remoters jobs."""
        print(f"\n=== Scraping {self.source_name} ===")
        jobs = []
        
        try:
            url = "https://remoters.net/jobs/"
            response = requests.get(url, headers=self.headers, timeout=15)
            soup = BeautifulSoup(response.text, "html.parser")
            
            job_links = soup.find_all("a", href=True)
            seen_urls = set()
            
            for link in job_links:
                href = link.get("href", "")
                if "/jobs/" not in href or href == "/jobs/":
                    continue
                
                full_url = "https://remoters.net" + href if href.startswith("/") else href
                if full_url in seen_urls:
                    continue
                seen_urls.add(full_url)
                
                try:
                    title = link.get_text(strip=True)
                    if len(title) < 5 or len(title) > 200:
                        continue
                    
                    company = "Remoters"
                    
                    jobs.append({
                        'source': self.source_name,
                        'title': title[:255],
                        'company': company[:255],
                        'location': 'Remote',
                        'description': None,
                        'url': full_url
                    })
                    
                    if len(jobs) >= 30:
                        break
                except Exception:
                    continue
            
            print(f"✓ Collected {len(jobs)} jobs from {self.source_name}")
            
        except Exception as e:
            print(f"✗ Error: {e}")
        
        return jobs