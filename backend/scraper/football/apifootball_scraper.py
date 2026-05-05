"""
API-Football Scraper

Uses API-Football service for football scores. Requires API key.
Available on RapidAPI: https://rapidapi.com/api-sports/api/api-football
"""

from typing import Optional
from ..base import BaseFootballScraper, FootballScoreData, debug, info, warn, error


class APIFootballScraper(BaseFootballScraper):
    """
    API-Football score scraper.
    
    Uses API-Football service via RapidAPI.
    Get API key from: https://rapidapi.com/api-sports/api/api-football
    
    Free tier: 100 requests/day
    """
    
    SOURCE = "apifootball"
    BASE_URL = "https://api-football-v1.p.rapidapi.com/v3"
    
    def __init__(self, timeout: int = 10, api_key: Optional[str] = None):
        super().__init__(timeout, api_key)
        
        if not self.api_key:
            warn(f"[APIFootball] No API key provided. Get key at https://rapidapi.com/api-sports/api/api-football")
    
    @property
    def source_name(self) -> str:
        return self.SOURCE
    
    def get_football_score(self, team_a: str, team_b: str, 
                           match_url: Optional[str] = None) -> Optional[FootballScoreData]:
        """
        Get football score from API-Football
        
        Args:
            team_a: First team name
            team_b: Second team name
            match_url: Ignored for API-based scraper
            
        Returns:
            FootballScoreData or None
        """
        if not self.api_key:
            warn(f"[APIFootball] Cannot fetch - no API key")
            return None
        
        info(f"[APIFootball] Fetching score for {team_a} vs {team_b}")
        
        # This would require:
        # 1. Search for fixtures by team names
        # 2. Get fixture ID
        # 3. Fetch fixture details
        
        warn(f"[APIFootball] API integration not fully implemented")
        return None
    
    def _get_live_fixtures(self) -> Optional[list]:
        """Get live fixtures from API"""
        url = f"{self.BASE_URL}/fixtures"
        headers = {
            'X-RapidAPI-Key': self.api_key,
            'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
        }
        params = {'live': 'all'}
        
        data = self.fetch_json(url, headers=headers)
        if not data:
            return None
        
        return data.get('response', [])
