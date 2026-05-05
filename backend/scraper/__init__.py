"""
Live Score Scraper Package

Modular scraper supporting multiple sports and sources.
"""

from .manager import ScraperManager
from .factory import ScraperFactory
from .utils import TeamMatcher, TeamDatabase

__all__ = ['ScraperManager', 'ScraperFactory', 'TeamMatcher', 'TeamDatabase']
