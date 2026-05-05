"""
Cricbuzz Cricket Scraper

Scrapes live cricket scores from Cricbuzz website.
Supports both live scores page search and direct match URL scraping.
"""

import re
from typing import Optional
from bs4 import BeautifulSoup
from ..base import BaseCricketScraper, CricketScoreData, debug, info, warn, error
from ..utils import TeamMatcher


class CricbuzzScraper(BaseCricketScraper):
    """
    Cricbuzz cricket score scraper.
    
    Features:
    - Scrape from live scores page by team names
    - Scrape from direct match URLs
    - Extract match details (date, venue, series)
    """
    
    SOURCE = "cricbuzz"
    LIVE_SCORES_URL = "https://www.cricbuzz.com/cricket-match/live-scores"
    
    def __init__(self, timeout: int = 15):
        super().__init__(timeout, api_key=None)
        info(f"[Cricbuzz] Scraper ready")
    
    @property
    def source_name(self) -> str:
        return self.SOURCE
    
    def get_cricket_score(self, team_a: str, team_b: str, 
                          match_url: Optional[str] = None) -> Optional[CricketScoreData]:
        """
        Get cricket score from Cricbuzz
        
        Args:
            team_a: First team name/abbreviation
            team_b: Second team name/abbreviation
            match_url: Optional direct match URL for detailed scraping
            
        Returns:
            CricketScoreData or None
        """
        info(f"[Cricbuzz] Fetching score for {team_a} vs {team_b}")
        
        if match_url:
            return self._scrape_detail_page(match_url)
        else:
            return self._scrape_live_scores_page(team_a, team_b)
    
    def _scrape_detail_page(self, match_url: str) -> Optional[CricketScoreData]:
        """Scrape detailed match page"""
        debug(f"[Cricbuzz] Scraping detail page: {match_url}")
        
        soup = self.fetch_page(match_url)
        if not soup:
            error(f"[Cricbuzz] Failed to fetch match page")
            return None
        
        return self._extract_match_data(soup, match_url)
    
    def _extract_match_data(self, soup: BeautifulSoup, match_url: str) -> Optional[CricketScoreData]:
        """Extract match data from page soup"""
        try:
            # Get page title for teams
            title_elem = soup.find('title')
            title_text = title_elem.get_text(strip=True) if title_elem else ""
            debug(f"[Cricbuzz] Title: {title_text}")
            
            team_a, team_b = self.extract_teams_from_title(title_text)
            
            if not team_a or not team_b:
                warn(f"[Cricbuzz] Could not extract teams from title")
                return None
            
            debug(f"[Cricbuzz] Teams: {team_a} vs {team_b}")
            
            # Extract scores from page text using regex patterns
            all_text = soup.get_text()
            score_patterns = re.findall(r'(\d+)[/-](\d+)\s*\((\d+(?:\.\d+)?)\)', all_text)
            debug(f"[Cricbuzz] Found score patterns: {score_patterns}")
            
            if len(score_patterns) < 2:
                warn(f"[Cricbuzz] Not enough score data found")
                return None
            
            # Parse first two scores
            team_a_runs, team_a_wickets, team_a_overs = score_patterns[0]
            team_b_runs, team_b_wickets, team_b_overs = score_patterns[1]
            
            # Determine batting teams based on overs
            team_a_batting, team_b_batting = self.determine_batting_team(
                float(team_a_overs), float(team_b_overs)
            )
            
            # Extract match status
            status_elem = (soup.find('div', class_='cb-text-live') or 
                          soup.find('div', class_='cb-text-complete') or
                          soup.find('div', class_='cb-text-stumps'))
            status_text = status_elem.get_text(strip=True) if status_elem else ""
            
            match_status = self.determine_match_status(status_text, both_have_scores=True)
            
            # Extract series name
            series_elem = soup.find('h1') or soup.find('div', class_='cb-nav-hdr')
            series_name = ""
            if series_elem:
                series_name = series_elem.get_text(strip=True)
            
            # Extract match info (date/time/venue)
            info_elem = soup.find('div', class_='cb-nav-subhdr')
            match_info = ""
            if info_elem:
                match_info = info_elem.get_text(strip=True)
            
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
                current_innings=self.determine_innings(float(team_a_overs), float(team_b_overs)),
                match_status=match_status,
                match_datetime=match_info,
                venue="",
                series=series_name,
                match_url=match_url,
                source=self.SOURCE
            )
            
            info(f"[Cricbuzz] [SUCCESS] {team_a} ({team_a_runs}/{team_a_wickets}) vs {team_b} ({team_b_runs}/{team_b_wickets})")
            return result
            
        except Exception as e:
            error(f"[Cricbuzz] Error extracting match data: {e}")
            import traceback
            debug(traceback.format_exc())
            return None
    
    def _scrape_live_scores_page(self, team_a: str, team_b: str) -> Optional[CricketScoreData]:
        """Scrape live scores page and find matching match"""
        debug(f"[Cricbuzz] Searching live scores page for {team_a} vs {team_b}")
        
        soup = self.fetch_page(self.LIVE_SCORES_URL)
        if not soup:
            return None
        
        # Find all match cards using multiple selectors
        selectors = [
            ('div', 'cb-mtch-lst'),
            ('a', 'text-hvr-underline'),
            ('div', 'cb-col-8'),
            ('div', 'cb-col-100 cb-col cb-col-scores')
        ]
        
        match_cards = []
        for tag, class_name in selectors:
            cards = soup.find_all(tag, class_=class_name)
            if cards:
                match_cards = cards
                debug(f"[Cricbuzz] Found {len(cards)} cards with {tag}.{class_name}")
                break
        
        if not match_cards:
            # Try finding by match links
            match_links = soup.find_all('a', href=re.compile(r'/live-cricket-scores/\d+'))
            match_cards = match_links
            debug(f"[Cricbuzz] Found {len(match_links)} match links")
        
        # Search for matching teams
        for card in match_cards:
            team_names = self._extract_teams_from_card(card)
            if not team_names:
                continue
            
            card_team_a, card_team_b = team_names
            debug(f"[Cricbuzz] Checking card: {card_team_a} vs {card_team_b}")
            
            # Check if this card matches our teams
            if (self.team_matches(team_a, card_team_a) and self.team_matches(team_b, card_team_b)) or \
               (self.team_matches(team_a, card_team_b) and self.team_matches(team_b, card_team_a)):
                
                info(f"[Cricbuzz] [FOUND] Match: {card_team_a} vs {card_team_b}")
                
                # Extract scores from card
                scores = self._extract_scores_from_card(card)
                
                # Find match link for detail scraping
                match_link = card.get('href', '') if card.name == 'a' else ''
                if not match_link:
                    link_elem = card.find('a', href=re.compile(r'/live-cricket-scores/\d+'))
                    if link_elem:
                        match_link = link_elem.get('href', '')
                
                if match_link:
                    if not match_link.startswith('http'):
                        match_link = f"https://www.cricbuzz.com{match_link}"
                    debug(f"[Cricbuzz] Found match link: {match_link}")
                    # Scrape detail page for full data
                    return self._scrape_detail_page(match_link)
                
                # Fallback: build score data from card
                if scores:
                    return self._build_score_data(card_team_a, card_team_b, scores, card)
        
        warn(f"[Cricbuzz] Match {team_a} vs {team_b} not found on live scores page")
        return None
    
    def _extract_teams_from_card(self, card) -> Optional[tuple[str, str]]:
        """Extract team names from a match card element"""
        team_elements = card.find_all('div', class_='cb-ovr-flo')
        if len(team_elements) >= 2:
            team_a = team_elements[0].get_text(strip=True)
            team_b = team_elements[1].get_text(strip=True)
            return team_a, team_b
        return None
    
    def _extract_scores_from_card(self, card) -> list[dict]:
        """Extract scores from a match card element"""
        scores = []
        score_elements = card.find_all('div', class_='cb-ovr-flo')
        
        for elem in score_elements:
            text = elem.get_text(strip=True)
            score_data = self.parse_score_pattern(text)
            if score_data:
                scores.append(score_data)
        
        return scores
    
    def _build_score_data(self, team_a: str, team_b: str, 
                          scores: list, card) -> CricketScoreData:
        """Build CricketScoreData from card data"""
        team_a_score = scores[0] if len(scores) > 0 else {"runs": 0, "wickets": 0, "overs": 0}
        team_b_score = scores[1] if len(scores) > 1 else {"runs": 0, "wickets": 0, "overs": 0}
        
        # Determine status
        status_elem = (card.find('div', class_='cb-text-live') or 
                      card.find('div', class_='cb-text-complete'))
        status_text = status_elem.get_text(strip=True) if status_elem else ""
        
        match_status = self.determine_match_status(
            status_text, 
            both_have_scores=(team_a_score.get('overs', 0) > 0 and team_b_score.get('overs', 0) > 0)
        )
        
        team_a_batting, team_b_batting = self.determine_batting_team(
            team_a_score.get('overs', 0),
            team_b_score.get('overs', 0)
        )
        
        return CricketScoreData(
            team_a_name=team_a,
            team_b_name=team_b,
            team_a_runs=team_a_score.get('runs', 0),
            team_a_wickets=team_a_score.get('wickets', 0),
            team_a_overs=team_a_score.get('overs', 0),
            team_b_runs=team_b_score.get('runs', 0),
            team_b_wickets=team_b_score.get('wickets', 0),
            team_b_overs=team_b_score.get('overs', 0),
            team_a_batting=team_a_batting,
            team_b_batting=team_b_batting,
            current_innings=self.determine_innings(
                team_a_score.get('overs', 0), 
                team_b_score.get('overs', 0)
            ),
            match_status=match_status,
            source=self.SOURCE
        )
