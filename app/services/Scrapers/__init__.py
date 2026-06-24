# app/services/Scrapers/__init__.py

"""Job board scrapers - Most valuable and market-beneficial scrapers."""

from .base_scraper import BaseScraper

# Tier 1: High-volume, high-quality, reliable sources
from .weworkremotely import WeWorkRemotelyScraper
from .linkedin import LinkedInScraper
from .remoteok import RemoteOkScraper

# Tier 2: Reliable, good coverage
from .remotive import RemotiveScraper
from .arbeitnow import ArbeitnowScraper
from .himalayas import HimalayasScraper


def get_all_scrapers():
    """
    Get instances of the most valuable and market-beneficial scrapers.
    
    Selected based on:
    - Market reputation and job volume
    - Reliability and stability
    - Geographic coverage
    - Industry relevance
    """
    return [
        # Tier 1: Major job aggregators and popular remote boards
        WeWorkRemotelyScraper(),  # Very popular, high-quality remote jobs
        LinkedInScraper(),        # Professional network, high-quality jobs
        RemoteOkScraper(),        # Popular remote job board
        
        # Tier 2: Reliable remote job boards
        RemotiveScraper(),         # Good remote job board
        ArbeitnowScraper(),        # API-based, European focus, reliable
        HimalayasScraper(),        # Modern, clean remote job board
    ]


def get_scraper_names():
    """Get list of scraper names."""
    return [scraper.source_name for scraper in get_all_scrapers()]


__all__ = [
    'BaseScraper',
    'get_all_scrapers',
    'get_scraper_names',
    # Tier 1
    'WeWorkRemotelyScraper',
    'LinkedInScraper',
    'RemoteOkScraper',
    # Tier 2
    'RemotiveScraper',
    'ArbeitnowScraper',
    'HimalayasScraper',
]
