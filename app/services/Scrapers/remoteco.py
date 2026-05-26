# app/services/Scrapers/remoteco.py

from .base_scraper import BaseScraper
import requests
from bs4 import BeautifulSoup
from typing import List, Dict


class RemoteCoScraper(BaseScraper):
    """Scraper for Remote.co"""
    
    @property
    def source_name(self) -> str:
        return "remoteco"
    
    def scrape(self) -> List[Dict]:
        """Scrape Remote.co jobs."""
        print(f"\n=== Scraping {self.source_name} ===")
        jobs = []
        
        try:
            url = "https://remote.co/remote-jobs/"
            response = requests.get(url, headers=self.headers, timeout=15)
            soup = BeautifulSoup(response.text, "html.parser")
            
            job_links = soup.find_all("a", href=True)
            seen_urls = set()
            
            for link in job_links:
                if len(jobs) >= 50:  # Limit to 50 jobs
                    break
                    
                href = link.get("href", "")
                
                if "remote.co" not in href and not href.startswith("/"):
                    continue
                
                if "/remote-jobs/" not in href or href.endswith("/remote-jobs/"):
                    continue
                
                if href.startswith("http"):
                    full_url = href
                else:
                    full_url = "https://remote.co" + href
                
                if full_url in seen_urls:
                    continue
                seen_urls.add(full_url)
                
                try:
                    title = link.get_text(strip=True)
                    
                    if len(title) > 5 and len(title) < 150:
                        company = "Remote.co"
                        
                        parent = link.parent
                        if parent:
                            all_text = parent.get_text(separator="|").split("|")
                            for text in all_text:
                                text = text.strip()
                                if len(text) > 3 and text != title and not text.isdigit():
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
                        
                except Exception:
                    continue
            
            print(f"✓ Collected {len(jobs)} jobs from {self.source_name}")
            
        except Exception as e:
            print(f"✗ Error: {e}")
        
        return jobs