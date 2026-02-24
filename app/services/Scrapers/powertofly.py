# app/services/Scrapers/powertofly.py

from .base_scraper import BaseScraper
import requests
from bs4 import BeautifulSoup
from typing import List, Dict


class PowerToFlyScraper(BaseScraper):
    """Scraper for PowerToFly.com"""
    
    @property
    def source_name(self) -> str:
        return "powertofly"
    
    def scrape(self) -> List[Dict]:
        """Scrape PowerToFly jobs."""
        print(f"\n=== Scraping {self.source_name} ===")
        jobs = []
        
        try:
            url = "https://powertofly.com/jobs/"
            response = requests.get(url, headers=self.headers, timeout=15)
            soup = BeautifulSoup(response.text, "html.parser")
            
            job_links = soup.find_all("a", href=True)
            seen_urls = set()
            
            for link in job_links:
                href = link.get("href", "")
                if "/jobs/" not in href or len(href) < 15:
                    continue
                
                full_url = "https://powertofly.com" + href if href.startswith("/") else href
                if full_url in seen_urls:
                    continue
                seen_urls.add(full_url)
                
                try:
                    title = link.get_text(strip=True)
                    if len(title) < 5 or len(title) > 200:
                        continue
                    
                    company = "PowerToFly"
                    parent = link.parent
                    if parent:
                        company_elem = parent.find(class_=lambda x: x and "company" in str(x).lower())
                        if company_elem:
                            comp_text = company_elem.get_text(strip=True)
                            if len(comp_text) > 2 and len(comp_text) < 100:
                                company = comp_text
                    
                    jobs.append({
                        'source': self.source_name,
                        'title': title[:255],
                        'company': company[:255],
                        'location': 'Remote',
                        'description': None,
                        'url': full_url
                    })
                    
                    if len(jobs) >= 40:
                        break
                except Exception:
                    continue
            
            print(f"✓ Collected {len(jobs)} jobs from {self.source_name}")
            
        except Exception as e:
            print(f"✗ Error: {e}")
        
        return jobs