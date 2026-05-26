# app/services/Scrapers/bayt.py

from .base_scraper import BaseScraper
import requests
from bs4 import BeautifulSoup
from typing import List, Dict


class BaytScraper(BaseScraper):
    """Scraper for Bayt.com"""
    
    @property
    def source_name(self) -> str:
        return "bayt"
    
    def scrape(self) -> List[Dict]:
        """Scrape Bayt.com jobs."""
        print(f"\n=== Scraping {self.source_name} ===")
        jobs = []
        
        try:
            url = "https://www.bayt.com/en/international/jobs/remote-jobs/"
            response = requests.get(url, headers=self.headers, timeout=15)
            soup = BeautifulSoup(response.text, "html.parser")
            
            job_cards = soup.find_all(["li", "div"], class_=lambda x: x and "job" in str(x).lower())
            
            for card in job_cards[:60]:
                try:
                    link = card.find("a", href=True)
                    if not link:
                        continue
                    
                    href = link.get("href", "")
                    if not href or "bayt.com" not in href:
                        if href.startswith("/"):
                            href = "https://www.bayt.com" + href
                        else:
                            continue
                    
                    title = link.get_text(strip=True)
                    if len(title) < 5:
                        title_elem = card.find(["h2", "h3"])
                        if title_elem:
                            title = title_elem.get_text(strip=True)
                    
                    company = "Bayt.com"
                    company_elem = card.find(class_=lambda x: x and "company" in str(x).lower())
                    if company_elem:
                        comp_text = company_elem.get_text(strip=True)
                        if len(comp_text) > 2 and len(comp_text) < 100:
                            company = comp_text
                    
                    if len(title) > 5:
                        jobs.append({
                            'source': self.source_name,
                            'title': title[:255],
                            'company': company[:255],
                            'location': 'Middle East/Remote',
                            'description': None,
                            'url': href
                        })
                except Exception:
                    continue
            
            print(f"✓ Collected {len(jobs)} jobs from {self.source_name}")
            
        except Exception as e:
            print(f"✗ Error: {e}")
        
        return jobs