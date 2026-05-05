"""
Live Score Scraper Package

Modular scraper supporting multiple sports and sources.
"""

from .manager import ScraperManager
from .factory import ScraperFactory

__all__ = ['ScraperManager', 'ScraperFactory']
