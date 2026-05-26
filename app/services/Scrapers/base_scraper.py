# app/services/Scrapers/base_scraper.py

from abc import ABC, abstractmethod
from typing import List, Dict


class BaseScraper(ABC):
    """Base class for all job board scrapers."""
    
    def __init__(self):
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
    
    @abstractmethod
    def scrape(self) -> List[Dict]:
        """
        Scrape jobs from the source.
        
        Returns:
            List of job dictionaries with keys: source, title, company, location, description, url
        """
        pass
    
    @property
    @abstractmethod
    def source_name(self) -> str:
        """Return the name of this scraper's source."""
        pass