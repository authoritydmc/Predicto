"""
Google Cricket Scraper

Scrapes cricket scores from Google search results.
Note: This is experimental and may break if Google changes their layout.
"""

import re
from typing import Optional
from ..base import BaseCricketScraper, CricketScoreData, debug, info, warn, error


class GoogleCricketScraper(BaseCricketScraper):
    """
    Google search-based cricket score scraper.
    
    Searches Google for "Team A vs Team B live score" and parses results.
    
    Note: This scraper may be fragile as it depends on Google's HTML structure
    which can change frequently. Use as fallback only.
    """
    
    SOURCE = "google"
    SEARCH_URL = "https://www.google.com/search"
    
    def __init__(self, timeout: int = 10):
        super().__init__(timeout, api_key=None)
        info(f"[Google] Scraper ready (experimental)")
    
    @property
    def source_name(self) -> str:
        return self.SOURCE
    
    def get_cricket_score(self, team_a: str, team_b: str, 
                          match_url: Optional[str] = None) -> Optional[CricketScoreData]:
        """
        Get cricket score from Google search
        
        Args:
            team_a: First team name
            team_b: Second team name
            match_url: Ignored - Google scraper searches by team names
            
        Returns:
            CricketScoreData or None
        """
        info(f"[Google] Searching for {team_a} vs {team_b}")
        
        query = f"{team_a} vs {team_b} live score cricket"
        url = f"{self.SEARCH_URL}?q={query.replace(' ', '+')}&hl=en"
        
        soup = self.fetch_page(url)
        if not soup:
            warn(f"[Google] Failed to fetch search results")
            return None
        
        return self._parse_search_results(soup, team_a, team_b)
    
    def _parse_search_results(self, soup, team_a: str, team_b: str) -> Optional[CricketScoreData]:
        """Parse Google search results for score data"""
        try:
            # Get text with space separator to avoid merging elements
            page_text = soup.get_text(separator=' ', strip=True)
            
            # Improved regex: matches "runs/wickets (overs)" or just "runs (overs)"
            # Group 1: Runs, Group 2: Wickets (optional), Group 3: Overs
            pattern = r'(\d+)(?:\s*[/-]\s*(\d+))?\s*\(\s*([\d.]+)\s*\)'
            score_patterns = re.findall(pattern, page_text)
            
            if len(score_patterns) >= 2:
                debug(f"[Google] Found score patterns: {score_patterns[:2]}")
                
                # First team in pattern list
                s1_runs, s1_wickets, s1_overs = score_patterns[0]
                # Second team in pattern list
                s2_runs, s2_wickets, s2_overs = score_patterns[1]
                
                # Default wickets to 0 if not found
                s1_wickets = int(s1_wickets) if s1_wickets else 0
                s2_wickets = int(s2_wickets) if s2_wickets else 0
                
                # Determine batting teams
                team_a_batting, team_b_batting = self.determine_batting_team(
                    float(s1_overs), float(s2_overs)
                )
                
                result = CricketScoreData(
                    team_a_name=team_a,
                    team_b_name=team_b,
                    team_a_runs=int(s1_runs),
                    team_a_wickets=s1_wickets,
                    team_a_overs=float(s1_overs),
                    team_b_runs=int(s2_runs),
                    team_b_wickets=s2_wickets,
                    team_b_overs=float(s2_overs),
                    team_a_batting=team_a_batting,
                    team_b_batting=team_b_batting,
                    current_innings=self.determine_innings(
                        float(s1_overs), float(s2_overs)
                    ),
                    match_status="live",
                    source=self.SOURCE
                )
                
                info(f"[Google] [SUCCESS] Score extracted: {s1_runs}/{s1_wickets} & {s2_runs}/{s2_wickets}")
                return result
            
            # Fallback: Look for "Team A X/Y" patterns
            # This is more complex but more robust
            warn(f"[Google] Could not find standard score patterns in search results")
            return None
            
        except Exception as e:
            error(f"[Google] Error parsing results: {e}")
            import traceback
            debug(traceback.format_exc())
            return None
