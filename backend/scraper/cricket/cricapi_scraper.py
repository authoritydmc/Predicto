"""
CricAPI Cricket Scraper

Uses CricAPI service for cricket scores. Requires API key.
Free tier available: https://www.cricapi.com/
"""

from typing import Optional
from ..base import BaseCricketScraper, CricketScoreData, debug, info, warn, error


class CricAPIScraper(BaseCricketScraper):
    """
    CricAPI cricket score scraper.
    
    Uses official CricAPI service. Get free API key from:
    https://www.cricapi.com/
    
    Free tier: 100,000 requests/hour
    """
    
    SOURCE = "cricapi"
    BASE_URL = "https://api.cricapi.com/v1"
    
    def __init__(self, timeout: int = 10, api_key: Optional[str] = None):
        super().__init__(timeout, api_key)
        
        if not self.api_key:
            warn(f"[CricAPI] No API key provided. Get free key at https://www.cricapi.com/")
        else:
            debug(f"[CricAPI] Initialized with API key")
    
    @property
    def source_name(self) -> str:
        return self.SOURCE
    
    def get_cricket_score(self, team_a: str, team_b: str, 
                          match_url: Optional[str] = None) -> Optional[CricketScoreData]:
        """
        Get cricket score from CricAPI
        
        Args:
            team_a: First team name
            team_b: Second team name  
            match_url: Ignored for API-based scraper
            
        Returns:
            CricketScoreData or None
        """
        if not self.api_key:
            warn(f"[CricAPI] Cannot fetch - no API key")
            return None
        
        info(f"[CricAPI] Fetching score for {team_a} vs {team_b}")
        
        # For CricAPI, we would need to:
        # 1. Search for matches by team names
        # 2. Get match ID
        # 3. Fetch match details
        
        # This is a placeholder implementation
        # Full implementation would require API exploration
        
        warn(f"[CricAPI] API integration not fully implemented - needs match search logic")
        return None
    
    def _search_matches(self, team_a: str, team_b: str) -> Optional[list]:
        """Search for matches by team names"""
        url = f"{self.BASE_URL}/matches?apikey={self.api_key}&offset=0"
        
        data = self.fetch_json(url)
        if not data or data.get('status') != 'success':
            return None
        
        matches = data.get('data', [])
        debug(f"[CricAPI] Found {len(matches)} total matches")
        
        # Filter matches by team names
        matching = []
        for match in matches:
            t1 = match.get('teams', ['', ''])[0].lower()
            t2 = match.get('teams', ['', ''])[1].lower()
            
            if (self.team_matches(team_a, t1) and self.team_matches(team_b, t2)) or \
               (self.team_matches(team_a, t2) and self.team_matches(team_b, t1)):
                matching.append(match)
        
        return matching
    
    def _get_match_score(self, match_id: str) -> Optional[CricketScoreData]:
        """Get score for specific match ID"""
        url = f"{self.BASE_URL}/match_scorecard?apikey={self.api_key}&id={match_id}"
        
        data = self.fetch_json(url)
        if not data or data.get('status') != 'success':
            return None
        
        match_data = data.get('data', {})
        
        # Parse scorecard data
        # This would need to be implemented based on actual API response format
        
        debug(f"[CricAPI] Match data: {match_data}")
        return None
