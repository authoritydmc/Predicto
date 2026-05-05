"""
Cricket Scraper Module

Contains site-specific cricket scrapers.
"""

from .cricbuzz_scraper import CricbuzzScraper
from .cricapi_scraper import CricAPIScraper
from .google_scraper import GoogleCricketScraper

# Registry of available cricket scrapers
CRICKET_SCRAPERS = {
    'cricbuzz': CricbuzzScraper,
    'cricapi': CricAPIScraper,
    'google': GoogleCricketScraper,
}

__all__ = ['CricbuzzScraper', 'CricAPIScraper', 'GoogleCricketScraper', 'CRICKET_SCRAPERS']
