# app/services/Scrapers/arbeitnow.py

from .base_scraper import BaseScraper
import requests
from typing import List, Dict


class ArbeitnowScraper(BaseScraper):
    """Scraper for Arbeitnow.com API"""
    
    @property
    def source_name(self) -> str:
        return "arbeitnow"
    
    def scrape(self) -> List[Dict]:
        """Scrape Arbeitnow jobs from API."""
        print(f"\n=== Scraping {self.source_name} ===")
        jobs = []
        
        try:
            url = "https://www.arbeitnow.com/api/job-board-api"
            response = requests.get(url, headers=self.headers, timeout=15)
            data = response.json().get('data', [])
            
            for job in data:
                try:
                    title = job.get('title', '').strip()
                    company = job.get('company_name', 'Arbeitnow').strip()
                    location = job.get('location', 'Remote').strip()
                    tags = ', '.join(job.get('tags', []))
                    job_url = job.get('url', '')
                    
                    if 'remote' in location.lower() or 'remote' in tags.lower() or not location:
                        if len(title) > 5 and job_url:
                            jobs.append({
                                'source': self.source_name,
                                'title': title[:255],
                                'company': company[:255],
                                'location': location[:255] if location else 'Remote',
                                'description': tags[:500] if tags else None,
                                'url': job_url
                            })
                except Exception:
                    continue
            
            print(f"✓ Collected {len(jobs)} jobs from {self.source_name}")
            
        except Exception as e:
            print(f"✗ Error: {e}")
        
        return jobs