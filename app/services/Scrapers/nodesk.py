# app/services/Scrapers/nodesk.py

from .base_scraper import BaseScraper
import requests
from bs4 import BeautifulSoup
from typing import List, Dict


class NoDeskScraper(BaseScraper):
    """Scraper for NoDesk.co"""
    
    @property
    def source_name(self) -> str:
        return "nodesk"
    
    def scrape(self) -> List[Dict]:
        """Scrape NoDesk jobs."""
        print(f"\n=== Scraping {self.source_name} ===")
        jobs = []
        
        try:
            url = "https://nodesk.co/remote-jobs/"
            response = requests.get(url, headers=self.headers, timeout=15)
            soup = BeautifulSoup(response.text, "html.parser")
            
            job_cards = soup.find_all(["div", "article"], class_=lambda x: x and "job" in str(x).lower())
            
            for card in job_cards[:50]:
                try:
                    link = card.find("a", href=True)
                    if not link:
                        continue
                    
                    href = link.get("href", "")
                    if not href.startswith("http"):
                        href = "https://nodesk.co" + href
                    
                    title = link.get_text(strip=True)
                    if len(title) < 5:
                        continue
                    
                    company = "NoDesk"
                    company_elem = card.find(class_="company")
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
                        'url': href
                    })
                except Exception:
                    continue
            
            print(f"✓ Collected {len(jobs)} jobs from {self.source_name}")
            
        except Exception as e:
            print(f"✗ Error: {e}")
        
        return jobs