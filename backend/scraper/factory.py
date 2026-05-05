"""
Scraper Factory

Creates scraper instances based on sport and source name.
Implements the Factory pattern for scraper instantiation.
"""

from typing import Optional, Type
from .base import BaseCricketScraper, BaseFootballScraper
from .cricket import CRICKET_SCRAPERS
from .football import FOOTBALL_SCRAPERS


class ScraperFactory:
    """
    Factory for creating scraper instances.
    
    Usage:
        factory = ScraperFactory()
        scraper = factory.create('cricket', 'cricbuzz')
        
        # With API key
        scraper = factory.create('cricket', 'cricapi', api_key='your_key')
    """
    
    # Registry mapping sport -> source -> scraper class
    _registry: dict[str, dict[str, Type]] = {
        'cricket': CRICKET_SCRAPERS,
        'football': FOOTBALL_SCRAPERS,
    }
    
    @classmethod
    def create(cls, sport: str, source: str, 
               api_key: Optional[str] = None, timeout: int = 15) -> Optional[object]:
        """
        Create a scraper instance
        
        Args:
            sport: Sport name (cricket, football)
            source: Source name (cricbuzz, cricapi, google, apifootball)
            api_key: Optional API key for services requiring authentication
            timeout: Request timeout in seconds
            
        Returns:
            Scraper instance or None if not found
        """
        sport = sport.lower()
        source = source.lower()
        
        if sport not in cls._registry:
            raise ValueError(f"Unknown sport: {sport}. Available: {list(cls._registry.keys())}")
        
        if source not in cls._registry[sport]:
            available = list(cls._registry[sport].keys())
            raise ValueError(f"Unknown source '{source}' for {sport}. Available: {available}")
        
        scraper_class = cls._registry[sport][source]
        
        # Create instance
        if api_key:
            return scraper_class(timeout=timeout, api_key=api_key)
        else:
            return scraper_class(timeout=timeout)
    
    @classmethod
    def get_available_sports(cls) -> list[str]:
        """Get list of available sports"""
        return list(cls._registry.keys())
    
    @classmethod
    def get_available_sources(cls, sport: str) -> list[str]:
        """Get list of available sources for a sport"""
        sport = sport.lower()
        if sport not in cls._registry:
            return []
        return list(cls._registry[sport].keys())
    
    @classmethod
    def register_scraper(cls, sport: str, source: str, scraper_class: Type):
        """
        Register a new scraper class
        
        Args:
            sport: Sport name
            source: Source name
            scraper_class: Scraper class to register
        """
        sport = sport.lower()
        source = source.lower()
        
        if sport not in cls._registry:
            cls._registry[sport] = {}
        
        cls._registry[sport][source] = scraper_class
    
    @classmethod
    def is_source_available(cls, sport: str, source: str) -> bool:
        """Check if a source is available for a sport"""
        sport = sport.lower()
        source = source.lower()
        return sport in cls._registry and source in cls._registry[sport]
