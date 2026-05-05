"""
Base scraper classes
"""

from .base_scraper import BaseScraper, logger, debug, info, warn, error, VERBOSE
from .base_cricket import BaseCricketScraper, CricketScoreData
from .base_football import BaseFootballScraper, FootballScoreData

__all__ = [
    'BaseScraper', 'logger', 'debug', 'info', 'warn', 'error', 'VERBOSE',
    'BaseCricketScraper', 'CricketScoreData',
    'BaseFootballScraper', 'FootballScoreData'
]
