# app/services/Scrapers/justremote.py

from .base_scraper import BaseScraper
import requests
from bs4 import BeautifulSoup
from typing import List, Dict


class JustRemoteScraper(BaseScraper):
    """Scraper for JustRemote.co"""
    
    @property
    def source_name(self) -> str:
        return "justremote"
    
    def scrape(self) -> List[Dict]:
        """Scrape JustRemote jobs."""
        print(f"\n=== Scraping {self.source_name} ===")
        jobs = []
        
        try:
            url = "https://justremote.co/remote-jobs"
            response = requests.get(url, headers=self.headers, timeout=15)
            soup = BeautifulSoup(response.text, "html.parser")
            
            job_links = soup.find_all("a", href=True)
            seen_urls = set()
            
            for link in job_links:
                href = link.get("href", "")
                if "/remote-" not in href or len(href) < 15:
                    continue
                
                if href.startswith("/"):
                    full_url = "https://justremote.co" + href
                else:
                    full_url = href
                
                if full_url in seen_urls or "remote-jobs" == href.strip("/"):
                    continue
                seen_urls.add(full_url)
                
                try:
                    title = link.get_text(strip=True)
                    if len(title) < 5 or len(title) > 200:
                        continue
                    
                    company = "JustRemote"
                    parent = link.parent
                    if parent:
                        text_parts = parent.get_text(separator="|").split("|")
                        for part in text_parts:
                            cleaned = part.strip()
                            if len(cleaned) > 2 and len(cleaned) < 100 and cleaned != title:
                                company = cleaned
                                break
                    
                    jobs.append({
                        'source': self.source_name,
                        'title': title[:255],
                        'company': company[:255],
                        'location': 'Remote',
                        'description': None,
                        'url': full_url
                    })
                    
                    if len(jobs) >= 50:
                        break
                except Exception:
                    continue
            
            print(f"✓ Collected {len(jobs)} jobs from {self.source_name}")
            
        except Exception as e:
            print(f"✗ Error: {e}")
        
        return jobs