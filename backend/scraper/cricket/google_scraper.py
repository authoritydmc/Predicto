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
            # Look for score patterns in the page
            page_text = soup.get_text()
            
            # Google often shows scores in format like:
            # "155/7 (20.0)" or "155-7 (20)"
            score_patterns = re.findall(r'(\d+)[/-](\d+)\s*\((\d+(?:\.\d+)?)\)', page_text)
            
            if len(score_patterns) >= 2:
                debug(f"[Google] Found score patterns: {score_patterns[:2]}")
                
                team_a_runs, team_a_wickets, team_a_overs = score_patterns[0]
                team_b_runs, team_b_wickets, team_b_overs = score_patterns[1]
                
                team_a_batting, team_b_batting = self.determine_batting_team(
                    float(team_a_overs), float(team_b_overs)
                )
                
                result = CricketScoreData(
                    team_a_name=team_a,
                    team_b_name=team_b,
                    team_a_runs=int(team_a_runs),
                    team_a_wickets=int(team_a_wickets),
                    team_a_overs=float(team_a_overs),
                    team_b_runs=int(team_b_runs),
                    team_b_wickets=int(team_b_wickets),
                    team_b_overs=float(team_b_overs),
                    team_a_batting=team_a_batting,
                    team_b_batting=team_b_batting,
                    current_innings=self.determine_innings(
                        float(team_a_overs), float(team_b_overs)
                    ),
                    match_status="live",  # Assume live if found
                    source=self.SOURCE
                )
                
                info(f"[Google] [SUCCESS] Score extracted from search")
                return result
            
            warn(f"[Google] Could not find score patterns in search results")
            return None
            
        except Exception as e:
            error(f"[Google] Error parsing results: {e}")
            import traceback
            debug(traceback.format_exc())
            return None
