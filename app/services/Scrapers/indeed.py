# app/services/Scrapers/indeed.py

from .base_scraper import BaseScraper
import requests
from bs4 import BeautifulSoup
from typing import List, Dict


class IndeedScraper(BaseScraper):
    """Scraper for Indeed.com"""
    
    @property
    def source_name(self) -> str:
        return "indeed"
    
    def scrape(self) -> List[Dict]:
        """Scrape Indeed remote jobs."""
        print(f"\n=== Scraping {self.source_name} ===")
        jobs = []
        
        try:
            url = "https://www.indeed.com/jobs?q=remote&l=&remotejob=032b3046-06a3-4876-8dfd-474eb5e7ed11"
            response = requests.get(url, headers=self.headers, timeout=15)
            soup = BeautifulSoup(response.text, "html.parser")
            
            job_cards = soup.find_all(["div", "td"], class_=lambda x: x and "job" in str(x).lower())
            
            for card in job_cards[:50]:
                try:
                    link = card.find("a", href=True)
                    if not link:
                        continue
                    
                    href = link.get("href", "")
                    if "/rc/clk" in href or "/viewjob" in href or "/pagead" in href:
                        if not href.startswith("http"):
                            href = "https://www.indeed.com" + href
                    else:
                        continue
                    
                    title = link.get_text(strip=True)
                    if len(title) < 5:
                        title_elem = card.find(["h2", "span"])
                        if title_elem:
                            title = title_elem.get_text(strip=True)
                    
                    company = "Indeed"
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