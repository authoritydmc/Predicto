"""
Football Scraper Module

Contains site-specific football scrapers.
"""

from .apifootball_scraper import APIFootballScraper

# Registry of available football scrapers
FOOTBALL_SCRAPERS = {
    'apifootball': APIFootballScraper,
}

__all__ = ['APIFootballScraper', 'FOOTBALL_SCRAPERS']
