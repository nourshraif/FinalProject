# app/services/Scrapers/wellfound.py

from .base_scraper import BaseScraper
import requests
from bs4 import BeautifulSoup
from typing import List, Dict


class WellfoundScraper(BaseScraper):
    """Scraper for Wellfound.com (formerly AngelList Talent)"""
    
    @property
    def source_name(self) -> str:
        return "wellfound"
    
    def scrape(self) -> List[Dict]:
        """Scrape Wellfound jobs."""
        print(f"\n=== Scraping {self.source_name} ===")
        jobs = []
        
        try:
            url = "https://wellfound.com/jobs"
            response = requests.get(url, headers=self.headers, timeout=15)
            soup = BeautifulSoup(response.text, "html.parser")
            
            # Find job links
            job_links = soup.find_all("a", href=True)
            seen_urls = set()
            
            for link in job_links:
                href = link.get("href", "")
                
                if not href.startswith("/jobs/") or len(href) < 10:
                    continue
                
                full_url = "https://wellfound.com" + href
                if full_url in seen_urls:
                    continue
                seen_urls.add(full_url)
                
                try:
                    title = link.get_text(strip=True)
                    
                    if len(title) > 5 and len(title) < 100:
                        company = "Wellfound"
                        
                        # Try to find company nearby
                        parent = link.parent
                        if parent:
                            siblings = parent.find_all(text=True)
                            for text in siblings:
                                text = str(text).strip()
                                if len(text) > 3 and text != title and text[0].isupper():
                                    company = text
                                    break
                        
                        jobs.append({
                            'source': self.source_name,
                            'title': title[:255],
                            'company': company[:255],
                            'location': 'Remote',
                            'description': None,
                            'url': full_url
                        })
                        
                        if len(jobs) >= 50:  # Limit to 50
                            break
                            
                except Exception:
                    continue
            
            print(f"✓ Collected {len(jobs)} jobs from {self.source_name}")
                    
        except Exception as e:
            print(f"✗ Error: {e}")
        
        return jobs
