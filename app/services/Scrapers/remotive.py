# app/services/Scrapers/remotive.py

from .base_scraper import BaseScraper
import requests
from bs4 import BeautifulSoup
from typing import List, Dict


class RemotiveScraper(BaseScraper):
    """Scraper for Remotive.com"""
    
    @property
    def source_name(self) -> str:
        return "remotive"
    
    def scrape(self) -> List[Dict]:
        """Scrape Remotive jobs."""
        print(f"\n=== Scraping {self.source_name} ===")
        jobs = []
        
        try:
            url = "https://remotive.com/remote-jobs"
            response = requests.get(url, headers=self.headers, timeout=15)
            soup = BeautifulSoup(response.text, "html.parser")
            
            all_links = soup.find_all("a", href=True)
            seen_urls = set()
            
            for link in all_links:
                href = link.get("href", "")
                
                if not href.startswith("/remote-jobs/") or href == "/remote-jobs":
                    continue
                
                full_url = "https://remotive.com" + href
                if full_url in seen_urls:
                    continue
                seen_urls.add(full_url)
                
                try:
                    link_text = link.get_text(strip=True)
                    
                    if len(link_text) < 5 or link_text.lower() in ['view job', 'apply now', 'remote jobs']:
                        continue
                    
                    parent = link.parent
                    company = "Remotive"
                    
                    if parent:
                        parent_text = parent.get_text(separator="|").split("|")
                        for text in parent_text:
                            text = text.strip()
                            if len(text) > 3 and text != link_text and text[0].isupper():
                                company = text
                                break
                    
                    title = link_text
                    
                    if len(title) > 5:
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