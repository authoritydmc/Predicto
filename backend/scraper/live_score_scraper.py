#!/usr/bin/env python3
"""
Live Score Scraper for Predictor Manager
Supports cricket and football live score fetching from various sources
"""

import requests
import json
import time
import sys
from typing import Dict, Optional, Any, List
from datetime import datetime


class LiveScoreScraper:
    """Base class for live score scraping"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
    
    def get_cricket_score(self, match_id: str, team_a: str = None, team_b: str = None) -> Optional[Dict[str, Any]]:
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
        return None
    
    def get_football_score(self, match_id: str, team_a: str = None, team_b: str = None) -> Optional[Dict[str, Any]]:
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


class GoogleScraper(LiveScoreScraper):
    """Cricket score scraper using Google search results"""
    
    def get_cricket_score(self, match_id: str, team_a: str = None, team_b: str = None) -> Optional[Dict[str, Any]]:
        """Fetch cricket score from Google search"""
        if not team_a or not team_b:
            print("Team names required for Google scraper")
            return None
        
        try:
            query = f"{team_a} vs {team_b} live score cricket"
            url = f"https://www.google.com/search?q={query}&hl=en"
            
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            
            # Parse score from Google search results
            # This is a simplified version - actual implementation would need HTML parsing
            # For now, return None as placeholder
            print("Google scraper: HTML parsing needed")
            return None
            
        except Exception as e:
            print(f"Error fetching cricket score from Google: {e}")
            return None


class CricbuzzScraper(LiveScoreScraper):
    """Cricket score scraper using Cricbuzz"""
    
    def get_cricket_score(self, match_id: str, team_a: str = None, team_b: str = None) -> Optional[Dict[str, Any]]:
        """Fetch cricket score from Cricbuzz"""
        try:
            # Cricbuzz API endpoint for live scores
            url = "https://www.cricbuzz.com/api/v1/matches/live"
            
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if not data.get('matches'):
                return None
            
            # Find matching match by team names
            for match in data['matches']:
                match_info = match.get('matchInfo', {})
                t1 = match_info.get('team1', {}).get('teamName', '').lower()
                t2 = match_info.get('team2', {}).get('teamName', '').lower()
                
                if (team_a and team_a.lower() in t1 and team_b and team_b.lower() in t2) or \
                   (team_a and team_a.lower() in t2 and team_b and team_b.lower() in t1):
                    
                    match_status = match_info.get('status', '')
                    match_score = match.get('matchScore', {})
                    
                    score_data = {
                        "teamA": {"runs": 0, "wickets": 0, "overs": 0, "battingTeam": False},
                        "teamB": {"runs": 0, "wickets": 0, "overs": 0, "battingTeam": False},
                        "currentInnings": 1,
                        "matchStatus": "live" if "live" in match_status.lower() else "completed" if "won" in match_status.lower() else "scheduled",
                        "lastUpdated": int(time.time() * 1000),
                        "source": "cricbuzz"
                    }
                    
                    # Detect second innings from match status
                    if "innings break" in match_status.lower() or "2nd innings" in match_status.lower():
                        score_data["currentInnings"] = 2
                        score_data["secondInningsStart"] = int(time.time() * 1000)
                    
                    # Parse scores
                    for team_score in match_score:
                        team_name = team_score.get('team', {}).get('teamName', '').lower()
                        runs = team_score.get('score', 0)
                        wickets = team_score.get('wickets', 0)
                        overs = team_score.get('overs', 0)
                        
                        if team_name in t1:
                            score_data["teamA"] = {"runs": runs, "wickets": wickets, "overs": overs, "battingTeam": True}
                        elif team_name in t2:
                            score_data["teamB"] = {"runs": runs, "wickets": wickets, "overs": overs, "battingTeam": False}
                    
                    # Determine current innings and batting team
                    # If teamA has more overs than teamB, it's likely 1st innings
                    # If both have overs, it's 2nd innings
                    team_a_overs = score_data["teamA"]["overs"]
                    team_b_overs = score_data["teamB"]["overs"]
                    
                    if team_a_overs > 0 and team_b_overs == 0:
                        score_data["currentInnings"] = 1
                        score_data["teamA"]["battingTeam"] = True
                        score_data["teamB"]["battingTeam"] = False
                    elif team_b_overs > 0:
                        score_data["currentInnings"] = 2
                        # In 2nd innings, the team with more overs is batting
                        if team_b_overs > team_a_overs:
                            score_data["teamB"]["battingTeam"] = True
                            score_data["teamA"]["battingTeam"] = False
                        else:
                            score_data["teamA"]["battingTeam"] = True
                            score_data["teamB"]["battingTeam"] = False
                    else:
                        score_data["currentInnings"] = 1
                    
                    return score_data
            
            return None
            
        except Exception as e:
            print(f"Error fetching cricket score from Cricbuzz: {e}")
            return None


class APIFootballScraper(LiveScoreScraper):
    """Football score scraper using API-Football"""
    
    def __init__(self, api_key: str = None):
        super().__init__()
        self.api_key = api_key
        self.base_url = "https://api-football-v1.p.rapidapi.com/v3"
    
    def get_football_score(self, match_id: str, team_a: str = None, team_b: str = None) -> Optional[Dict[str, Any]]:
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


class ScraperManager:
    """Manages multiple scrapers with fallback mechanism"""
    
    def __init__(self, scraper_order: List[str] = None):
        """
        Initialize scraper manager with ordered list of scrapers
        scraper_order: List of scraper names in priority order (e.g., ['cricbuzz', 'google', 'cricapi'])
        """
        self.scraper_order = scraper_order or ['cricbuzz', 'google', 'cricapi']
        self.scrapers = {
            'cricbuzz': CricbuzzScraper(),
            'google': GoogleScraper(),
            'cricapi': CricAPIScraper(api_key=None),  # Add your API key
            'apifootball': APIFootballScraper(api_key=None)  # Add your API key
        }
    
    def get_cricket_score_with_fallback(self, match_id: str, team_a: str = None, team_b: str = None) -> Optional[Dict[str, Any]]:
        """Try each scraper in order until one succeeds"""
        for scraper_name in self.scraper_order:
            if scraper_name not in self.scrapers:
                print(f"Scraper '{scraper_name}' not available")
                continue
            
            scraper = self.scrapers[scraper_name]
            print(f"Trying {scraper_name} scraper...")
            
            try:
                result = scraper.get_cricket_score(match_id, team_a, team_b)
                if result:
                    result['source'] = scraper_name
                    print(f"Successfully fetched score from {scraper_name}")
                    return result
            except Exception as e:
                print(f"Error with {scraper_name}: {e}")
                continue
        
        print("All scrapers failed")
        return None
    
    def get_football_score_with_fallback(self, match_id: str, team_a: str = None, team_b: str = None) -> Optional[Dict[str, Any]]:
        """Try each football scraper in order until one succeeds"""
        football_scrapers = [s for s in self.scraper_order if s in ['apifootball']]
        
        for scraper_name in football_scrapers:
            if scraper_name not in self.scrapers:
                continue
            
            scraper = self.scrapers[scraper_name]
            print(f"Trying {scraper_name} scraper...")
            
            try:
                result = scraper.get_football_score(match_id, team_a, team_b)
                if result:
                    result['source'] = scraper_name
                    print(f"Successfully fetched score from {scraper_name}")
                    return result
            except Exception as e:
                print(f"Error with {scraper_name}: {e}")
                continue
        
        print("All football scrapers failed")
        return None
    
    def set_scraper_order(self, new_order: List[str]):
        """Update the priority order of scrapers"""
        self.scraper_order = new_order


def main():
    """CLI interface for running scraper"""
    if len(sys.argv) < 4:
        print("Usage: python live_score_scraper.py <sport> <match_id> <team_a> <team_b> [scraper_order]")
        print("Example: python live_score_scraper.py cricket match123 RCB CSK cricbuzz,google,cricapi")
        sys.exit(1)
    
    sport = sys.argv[1].lower()
    match_id = sys.argv[2]
    team_a = sys.argv[3]
    team_b = sys.argv[4]
    scraper_order = sys.argv[5].split(',') if len(sys.argv) > 5 else None
    
    manager = ScraperManager(scraper_order)
    
    if sport == 'cricket':
        result = manager.get_cricket_score_with_fallback(match_id, team_a, team_b)
    elif sport == 'football':
        result = manager.get_football_score_with_fallback(match_id, team_a, team_b)
    else:
        print(f"Unsupported sport: {sport}")
        sys.exit(1)
    
    if result:
        print(json.dumps(result))
    else:
        print(json.dumps({"error": "Failed to fetch score from all sources"}))
        sys.exit(1)


if __name__ == "__main__":
    main()
