"""
Scraper Manager

Manages multiple scrapers with fallback mechanism.
Tries scrapers in order until one succeeds.
"""

import json
from typing import Optional, List, Dict, Any
from .factory import ScraperFactory
from .base import logger, info, warn, error, debug


class ScraperManager:
    """
    Manager for scrapers with fallback support.
    
    Usage:
        manager = ScraperManager(['cricbuzz', 'cricapi', 'google'])
        result = manager.get_score('cricket', team_a='RCB', team_b='CSK')
        
        # With direct match URL
        result = manager.get_score('cricket', match_url='https://www.cricbuzz.com/...')
    """
    
    DEFAULT_CRICKET_ORDER = ['cricbuzz', 'google', 'cricapi']
    DEFAULT_FOOTBALL_ORDER = ['apifootball']
    
    def __init__(self, scraper_order: Optional[List[str]] = None, 
                 api_keys: Optional[Dict[str, str]] = None):
        """
        Initialize scraper manager
        
        Args:
            scraper_order: List of scraper names in priority order
            api_keys: Dict mapping scraper names to API keys
                      e.g., {'cricapi': 'key1', 'apifootball': 'key2'}
        """
        self.scraper_order = scraper_order
        self.api_keys = api_keys or {}
        self._cache = {}  # Simple cache for results
        
        info(f"[ScraperManager] Initialized with order: {scraper_order or 'default'}")
    
    def get_score(self, sport: str, 
                  team_a: Optional[str] = None,
                  team_b: Optional[str] = None,
                  match_url: Optional[str] = None,
                  match_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Get score by trying scrapers in order
        
        Args:
            sport: Sport name (cricket, football)
            team_a: First team name/abbreviation
            team_b: Second team name/abbreviation
            match_url: Optional direct match URL
            match_id: Optional match identifier
            
        Returns:
            Score data dict or None if all scrapers fail
        """
        sport = sport.lower()
        
        # Determine scraper order
        if self.scraper_order:
            order = self.scraper_order
        elif sport == 'cricket':
            order = self.DEFAULT_CRICKET_ORDER
        elif sport == 'football':
            order = self.DEFAULT_FOOTBALL_ORDER
        else:
            error(f"[ScraperManager] Unknown sport: {sport}")
            return None
        
        # Filter to available scrapers for this sport
        available_order = [
            source for source in order 
            if ScraperFactory.is_source_available(sport, source)
        ]
        
        if not available_order:
            error(f"[ScraperManager] No available scrapers for {sport}")
            return None
        
        info(f"[ScraperManager] Fetching {sport} score: {team_a} vs {team_b}")
        if match_url:
            info(f"[ScraperManager] Using match URL: {match_url}")
        info(f"[ScraperManager] Will try sources: {available_order}")
        
        # Try each scraper
        for source in available_order:
            info(f"[ScraperManager] Trying {source}...")
            
            try:
                # Create scraper instance
                api_key = self.api_keys.get(source)
                scraper = ScraperFactory.create(sport, source, api_key=api_key)
                
                if not scraper:
                    warn(f"[ScraperManager] Failed to create {source} scraper")
                    continue
                
                # Get score
                result = scraper.get_score(
                    team_a=team_a,
                    team_b=team_b,
                    match_url=match_url
                )
                
                if result:
                    # Add metadata
                    result['_source'] = source
                    result['_sport'] = sport
                    info(f"[ScraperManager] [SUCCESS] Score from {source}")
                    return result
                else:
                    warn(f"[ScraperManager] {source} returned no data")
                
            except Exception as e:
                error(f"[ScraperManager] Error with {source}: {e}")
                import traceback
                debug(traceback.format_exc())
                continue
        
        error(f"[ScraperManager] All scrapers failed for {sport}")
        return None
    
    def get_cricket_score(self, team_a: str, team_b: str, 
                          match_url: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Convenience method for cricket scores"""
        return self.get_score('cricket', team_a=team_a, team_b=team_b, match_url=match_url)
    
    def get_football_score(self, team_a: str, team_b: str,
                           match_url: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Convenience method for football scores"""
        return self.get_score('football', team_a=team_a, team_b=team_b, match_url=match_url)
    
    def get_available_sources(self, sport: str) -> List[str]:
        """Get list of available sources for a sport"""
        return ScraperFactory.get_available_sources(sport)
    
    def set_source_priority(self, sport: str, order: List[str]):
        """Set priority order for scrapers"""
        if sport == 'cricket':
            self.DEFAULT_CRICKET_ORDER = order
        elif sport == 'football':
            self.DEFAULT_FOOTBALL_ORDER = order
        else:
            raise ValueError(f"Unknown sport: {sport}")
    
    def set_api_key(self, source: str, api_key: str):
        """Set API key for a source"""
        self.api_keys[source] = api_key
        info(f"[ScraperManager] API key set for {source}")
