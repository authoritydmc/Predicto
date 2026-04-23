#!/usr/bin/env python3
"""
Live Score Scraper for OverlayChat
Supports cricket and football live score fetching from various sources
"""

import requests
import json
import time
from typing import Dict, Optional, Any
from datetime import datetime


class LiveScoreScraper:
    """Base class for live score scraping"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
    
    def get_cricket_score(self, match_id: str) -> Optional[Dict[str, Any]]:
        """
        Fetch live cricket score
        Returns score data in format:
        {
            "teamA": {"runs": 145, "wickets": 2, "overs": 18.3, "battingTeam": True},
            "teamB": {"runs": 0, "wickets": 0, "overs": 0, "battingTeam": False},
            "currentInnings": 1,
            "matchStatus": "live",
            "lastUpdated": timestamp,
            "source": "scraper"
        }
        """
        # Placeholder - implement actual scraping logic
        # This would integrate with APIs like CricAPI, ESPN Cricinfo, etc.
        return None
    
    def get_football_score(self, match_id: str) -> Optional[Dict[str, Any]]:
        """
        Fetch live football score
        Returns score data in format:
        {
            "teamA": {"goals": 2, "battingTeam": False},
            "teamB": {"goals": 1, "battingTeam": True},
            "matchTime": "67",
            "matchStatus": "live",
            "lastUpdated": timestamp,
            "source": "scraper"
        }
        """
        # Placeholder - implement actual scraping logic
        # This would integrate with APIs like API-Football, Football-Data.org, etc.
        return None


class CricAPIScraper(LiveScoreScraper):
    """Cricket score scraper using CricAPI (free tier available)"""
    
    def __init__(self, api_key: str = None):
        super().__init__()
        self.api_key = api_key
        self.base_url = "https://api.cricapi.com/v1"
    
    def get_cricket_score(self, match_id: str) -> Optional[Dict[str, Any]]:
        """Fetch cricket score from CricAPI"""
        if not self.api_key:
            print("CricAPI key not provided")
            return None
        
        try:
            # Get match info
            url = f"{self.base_url}/match_info?apikey={self.api_key}&id={match_id}"
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if data.get('status') != 'success':
                return None
            
            match_data = data.get('data', {})
            status = match_data.get('status', '')
            
            # Parse score
            team_a = match_data.get('t1', {})
            team_b = match_data.get('t2', {})
            
            score_data = {
                "teamA": {
                    "runs": 0,
                    "wickets": 0,
                    "overs": 0,
                    "battingTeam": False
                },
                "teamB": {
                    "runs": 0,
                    "wickets": 0,
                    "overs": 0,
                    "battingTeam": False
                },
                "currentInnings": 1,
                "matchStatus": "live" if status == "Live" else "completed" if status == "Completed" else "scheduled",
                "lastUpdated": int(time.time() * 1000),
                "source": "scraper"
            }
            
            # Parse scores from status string (format: "145/2 (18.3 ov)")
            t1_score = team_a.get('s', '')
            t2_score = team_b.get('s', '')
            
            if t1_score:
                score_data["teamA"] = self._parse_cricket_score(t1_score)
            if t2_score:
                score_data["teamB"] = self._parse_cricket_score(t2_score)
            
            return score_data
            
        except Exception as e:
            print(f"Error fetching cricket score: {e}")
            return None
    
    def _parse_cricket_score(self, score_str: str) -> Dict[str, Any]:
        """Parse cricket score string like '145/2 (18.3 ov)'"""
        parts = score_str.split('/')
        runs = int(parts[0]) if parts[0].isdigit() else 0
        
        wickets = 0
        overs = 0.0
        
        if len(parts) > 1:
            wickets_part = parts[1].split('(')[0].strip()
            wickets = int(wickets_part) if wickets_part.isdigit() else 0
            
            if '(' in score_str:
                overs_part = score_str.split('(')[1].split(')')[0].replace('ov', '').strip()
                overs = float(overs_part) if overs_part else 0.0
        
        return {
            "runs": runs,
            "wickets": wickets,
            "overs": overs,
            "battingTeam": True  # Would need to determine from match state
        }


class APIFootballScraper(LiveScoreScraper):
    """Football score scraper using API-Football"""
    
    def __init__(self, api_key: str = None):
        super().__init__()
        self.api_key = api_key
        self.base_url = "https://api-football-v1.p.rapidapi.com/v3"
    
    def get_football_score(self, match_id: str) -> Optional[Dict[str, Any]]:
        """Fetch football score from API-Football"""
        if not self.api_key:
            print("API-Football key not provided")
            return None
        
        try:
            url = f"{self.base_url}/fixtures"
            headers = {
                'X-RapidAPI-Key': self.api_key,
                'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
            }
            params = {'id': match_id, 'live': 'all'}
            
            response = self.session.get(url, headers=headers, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if not data.get('response'):
                return None
            
            match = data['response'][0]
            teams = match.get('teams', {})
            goals = match.get('goals', {})
            fixture = match.get('fixture', {})
            
            score_data = {
                "teamA": {
                    "goals": goals.get('home', 0),
                    "battingTeam": False
                },
                "teamB": {
                    "goals": goals.get('away', 0),
                    "battingTeam": True
                },
                "matchTime": str(fixture.get('status', {}).get('elapsed', 0)),
                "matchStatus": "live" if fixture.get('status', {}).get('short') == 'LIVE' else "completed",
                "lastUpdated": int(time.time() * 1000),
                "source": "scraper"
            }
            
            return score_data
            
        except Exception as e:
            print(f"Error fetching football score: {e}")
            return None


def main():
    """Test the scraper"""
    # Example usage
    cricket_scraper = CricAPIScraper(api_key="YOUR_API_KEY")
    football_scraper = APIFootballScraper(api_key="YOUR_API_KEY")
    
    # Test cricket score
    cricket_score = cricket_scraper.get_cricket_score("match_id")
    print("Cricket Score:", json.dumps(cricket_score, indent=2))
    
    # Test football score
    football_score = football_scraper.get_football_score("match_id")
    print("Football Score:", json.dumps(football_score, indent=2))


if __name__ == "__main__":
    main()
