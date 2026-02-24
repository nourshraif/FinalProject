# app/services/Scrapers/weworkremotely.py

from .base_scraper import BaseScraper
import requests
from bs4 import BeautifulSoup
from typing import List, Dict


class WeWorkRemotelyScraper(BaseScraper):
    """Scraper for WeWorkRemotely.com"""
    
    @property
    def source_name(self) -> str:
        return "weworkremotely"
    
    def scrape(self) -> List[Dict]:
        """Scrape WeWorkRemotely jobs."""
        print(f"\n=== Scraping {self.source_name} ===")
        jobs = []
        
        try:
            url = "https://weworkremotely.com/remote-jobs"
            response = requests.get(url, headers=self.headers, timeout=15)
            soup = BeautifulSoup(response.text, "html.parser")
            
            all_links = soup.find_all("a", href=True)
            
            for link in all_links:
                href = link.get("href", "")
                if not href.startswith("/remote-jobs/") or "/remote-jobs/search" in href:
                    continue
                
                try:
                    text_parts = [
                        part.strip() 
                        for part in link.get_text(separator="\n").split("\n") 
                        if part.strip()
                    ]
                    text_parts = [p for p in text_parts if p and len(p) > 2]
                    
                    if len(text_parts) < 2:
                        continue
                    
                    title = text_parts[0]
                    company = text_parts[1]
                    
                    skip_titles = ['remote jobs', 'categories', 'companies', 
                                 'post a job', 'log in', 'sign up']
                    if any(skip in title.lower() for skip in skip_titles):
                        continue
                    
                    full_url = "https://weworkremotely.com" + href
                    
                    if len(title) > 5 and len(company) > 2:
                        jobs.append({
                            'source': self.source_name,
                            'title': title[:255],
                            'company': company[:255],
                            'location': 'Remote',
                            'description': None,
                            'url': full_url
                        })
                        
                except Exception:
                    continue
            
            print(f"✓ Collected {len(jobs)} jobs from {self.source_name}")
            
        except Exception as e:
            print(f"✗ Error: {e}")
        
        return jobs