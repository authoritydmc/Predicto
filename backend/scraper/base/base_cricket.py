"""
Base Cricket Scraper Class

Defines the interface and common functionality for all cricket score scrapers.
"""

from abc import abstractmethod
from dataclasses import dataclass
from typing import Optional, Dict, Any
from .base_scraper import BaseScraper, debug, info, warn, error


@dataclass
class CricketScoreData:
    """Standardized cricket score data structure"""
    team_a_name: str
    team_b_name: str
    team_a_runs: int = 0
    team_a_wickets: int = 0
    team_a_overs: float = 0.0
    team_b_runs: int = 0
    team_b_wickets: int = 0
    team_b_overs: float = 0.0
    team_a_batting: bool = False
    team_b_batting: bool = False
    current_innings: int = 1
    match_status: str = "scheduled"  # live, completed, scheduled
    match_datetime: str = ""
    venue: str = ""
    series: str = ""
    match_url: str = ""
    source: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary format for JSON serialization"""
        return {
            "teamA": {
                "name": self.team_a_name,
                "runs": self.team_a_runs,
                "wickets": self.team_a_wickets,
                "overs": self.team_a_overs,
                "battingTeam": self.team_a_batting
            },
            "teamB": {
                "name": self.team_b_name,
                "runs": self.team_b_runs,
                "wickets": self.team_b_wickets,
                "overs": self.team_b_overs,
                "battingTeam": self.team_b_batting
            },
            "currentInnings": self.current_innings,
            "matchStatus": self.match_status,
            "matchDateTime": self.match_datetime,
            "venue": self.venue,
            "series": self.series,
            "matchUrl": self.match_url,
            "source": self.source,
            "lastUpdated": int(__import__('time').time() * 1000)
        }


class BaseCricketScraper(BaseScraper):
    """
    Base class for all cricket score scrapers.
    
    Provides cricket-specific functionality:
    - Standardized score format
    - Match status detection
    - Innings tracking
    """
    
    SPORT = "cricket"
    
    def __init__(self, timeout: int = 15, api_key: Optional[str] = None):
        super().__init__(timeout, api_key)
        self.info(f"Cricket scraper initialized")
    
    @abstractmethod
    def get_cricket_score(self, team_a: str, team_b: str, match_url: Optional[str] = None) -> Optional[CricketScoreData]:
        """
        Get cricket score for a match
        
        Args:
            team_a: First team name/abbreviation
            team_b: Second team name/abbreviation
            match_url: Optional direct match URL
            
        Returns:
            CricketScoreData or None if not found
        """
        pass
    
    def get_score(self, **kwargs) -> Optional[Dict[str, Any]]:
        """
        Generic get_score implementation for cricket
        
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
        
        result = self.get_cricket_score(team_a, team_b, match_url)
        return result.to_dict() if result else None
    
    def determine_match_status(self, status_text: str, both_have_scores: bool = False) -> str:
        """
        Determine match status from status text
        
        Args:
            status_text: Status text from page
            both_have_scores: Whether both teams have scores
            
        Returns:
            Status string: live, completed, scheduled
        """
        status_lower = status_text.lower() if status_text else ""
        
        if 'live' in status_lower:
            return "live"
        if any(word in status_lower for word in ['won', 'complete', 'result', 'draw', 'tie']):
            return "completed"
        if 'stumps' in status_lower or 'rain' in status_lower or 'abandon' in status_lower:
            return "completed"
        
        # If both teams have scores and no "live" indicator, likely completed
        if both_have_scores:
            return "completed"
        
        return "scheduled"
    
    def determine_batting_team(self, team_a_overs: float, team_b_overs: float) -> tuple[bool, bool]:
        """
        Determine which team is currently batting
        
        Args:
            team_a_overs: Team A overs
            team_b_overs: Team B overs
            
        Returns:
            Tuple of (team_a_batting, team_b_batting)
        """
        if team_a_overs > 0 and team_b_overs == 0:
            return True, False
        elif team_b_overs > 0 and team_a_overs == 0:
            return False, True
        elif team_b_overs > team_a_overs:
            return False, True
        elif team_a_overs > team_b_overs:
            return True, False
        else:
            # Equal overs - could be innings break or just started
            return False, False
    
    def determine_innings(self, team_a_overs: float, team_b_overs: float) -> int:
        """
        Determine current innings number
        
        Args:
            team_a_overs: Team A overs
            team_b_overs: Team B overs
            
        Returns:
            Innings number (1 or 2)
        """
        if team_a_overs > 0 and team_b_overs > 0:
            return 2
        return 1
