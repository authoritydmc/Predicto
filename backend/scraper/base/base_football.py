"""
Base Football Scraper Class

Defines the interface and common functionality for all football score scrapers.
"""

from abc import abstractmethod
from dataclasses import dataclass
from typing import Optional, Dict, Any
from .base_scraper import BaseScraper


@dataclass
class FootballScoreData:
    """Standardized football score data structure"""
    team_a_name: str
    team_b_name: str
    team_a_goals: int = 0
    team_b_goals: int = 0
    team_a_batting: bool = False  # For compatibility with cricket structure
    team_b_batting: bool = True
    match_time: str = "0"
    match_status: str = "scheduled"
    match_datetime: str = ""
    venue: str = ""
    league: str = ""
    match_url: str = ""
    source: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary format"""
        return {
            "teamA": {
                "name": self.team_a_name,
                "goals": self.team_a_goals,
                "battingTeam": self.team_a_batting  # For compatibility
            },
            "teamB": {
                "name": self.team_b_name,
                "goals": self.team_b_goals,
                "battingTeam": self.team_b_batting
            },
            "matchTime": self.match_time,
            "matchStatus": self.match_status,
            "matchDateTime": self.match_datetime,
            "venue": self.venue,
            "league": self.league,
            "matchUrl": self.match_url,
            "source": self.source,
            "lastUpdated": int(__import__('time').time() * 1000)
        }


class BaseFootballScraper(BaseScraper):
    """
    Base class for all football score scrapers.
    """
    
    SPORT = "football"
    
    def __init__(self, timeout: int = 15, api_key: Optional[str] = None):
        super().__init__(timeout, api_key)
        self.info(f"Football scraper initialized")
    
    @abstractmethod
    def get_football_score(self, team_a: str, team_b: str, match_url: Optional[str] = None) -> Optional[FootballScoreData]:
        """
        Get football score for a match
        
        Args:
            team_a: First team name
            team_b: Second team name
            match_url: Optional direct match URL
            
        Returns:
            FootballScoreData or None
        """
        pass
    
    def get_score(self, **kwargs) -> Optional[Dict[str, Any]]:
        """
        Generic get_score implementation for football
        
        Args:
            team_a: First team name
            team_b: Second team name
            match_url: Optional match URL
            
        Returns:
            Score dict or None
        """
        team_a = kwargs.get('team_a')
        team_b = kwargs.get('team_b')
        match_url = kwargs.get('match_url')
        
        if not team_a or not team_b:
            self.error("team_a and team_b are required")
            return None
        
        result = self.get_football_score(team_a, team_b, match_url)
        return result.to_dict() if result else None
    
    def determine_match_status(self, status_text: str, elapsed: int = 0) -> str:
        """
        Determine football match status
        
        Args:
            status_text: Status text
            elapsed: Minutes elapsed
            
        Returns:
            Status string
        """
        status_lower = status_text.lower() if status_text else ""
        
        if any(word in status_lower for word in ['live', '1h', '2h', 'ht']):
            return "live"
        if elapsed > 0 and elapsed < 90:
            return "live"
        if any(word in status_lower for word in ['ft', 'finished', 'ended', 'pen']):
            return "completed"
        
        return "scheduled"
