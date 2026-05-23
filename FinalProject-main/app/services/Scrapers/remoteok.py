# app/services/Scrapers/remoteok.py

from .base_scraper import BaseScraper
import requests
from bs4 import BeautifulSoup
from typing import List, Dict
import warnings
from bs4 import XMLParsedAsHTMLWarning

warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)


class RemoteOkScraper(BaseScraper):
    """Scraper for RemoteOK.com"""
    
    @property
    def source_name(self) -> str:
        return "remoteok"
    
    def scrape(self) -> List[Dict]:
        """Scrape RemoteOK jobs."""
        print(f"\n=== Scraping {self.source_name} ===")
        jobs = []
        
        try:
            url = "https://remoteok.com/"
            response = requests.get(url, headers=self.headers, timeout=15)
            soup = BeautifulSoup(response.text, "html.parser")
            
            all_rows = soup.find_all("tr")
            
            for row in all_rows:
                try:
                    row_class = row.get("class", [])
                    if not any("job" in str(c).lower() for c in row_class):
                        continue
                    
                    if "placeholder" in str(row_class):
                        continue
                    
                    job_id = row.get("data-id") or row.get("data-job-id")
                    if not job_id:
                        continue
                    
                    text_parts = [
                        p.strip() 
                        for p in row.get_text(separator="|").split("|") 
                        if p.strip()
                    ]
                    text_parts = [p for p in text_parts if len(p) > 3 and not p.isdigit()]
                    
                    if len(text_parts) >= 2:
                        title = text_parts[0]
                        
                        company = "Remote OK"
                        for part in text_parts[1:5]:
                            if part[0].isupper() and len(part) > 3:
                                company = part
                                break
                        
                        job_url = f"https://remoteok.com/remote-jobs/{job_id}"
                        tags = ", ".join(text_parts[1:6])
                        
                        if len(title) > 5:
                            jobs.append({
                                'source': self.source_name,
                                'title': title[:255],
                                'company': company[:255],
                                'location': 'Remote',
                                'description': tags[:500],
                                'url': job_url
                            })
                            
                except Exception:
                    continue
            
            print(f"✓ Collected {len(jobs)} jobs from {self.source_name}")
            
        except Exception as e:
            print(f"✗ Error: {e}")
        
        return jobs