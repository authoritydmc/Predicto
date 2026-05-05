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
            
            # Try meta description first as it's very reliable
            meta = soup.find('meta', attrs={'name': 'description'})
            team_a, team_b = None, None
            
            if meta and meta.get('content'):
                meta_content = meta['content']
                debug(f"[Cricbuzz] Meta content found: {meta_content[:100]}...")
                
                # Check for teams in title/meta
                team_a, team_b = self.extract_teams_from_title(title_text)
                if not team_a or not team_b:
                     # Try extracting from meta if title fails
                     # Example: "CSK 159/2 (17.3) vs DC 155/7"
                     parts = meta_content.split('|')[0].split(' vs ')
                     if len(parts) >= 2:
                         team_a = parts[0].split(' ')[-1].strip()
                         team_b = parts[1].split(' ')[0].strip()

            if not team_a or not team_b:
                warn(f"[Cricbuzz] Could not extract teams from title or meta")
                return None
            
            debug(f"[Cricbuzz] Teams identified: {team_a} vs {team_b}")
            
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
            
            # Extract series and venue from page text (robust to layout changes)
            page_text = soup.get_text(separator=' ', strip=True)
            series_match = re.search(r'Series:\s*([^,]+?)(?=\s+Venue:|$)', page_text)
            venue_match = re.search(r'Venue:\s*([^,]+?,[^,]+?)(?=\s+Date & Time:|$)', page_text)
            
            series_name = series_match.group(1).strip() if series_match else ""
            venue_name = venue_match.group(1).strip() if venue_match else ""
            
            if not series_name:
                series_elem = soup.find('h1') or soup.find('div', class_='cb-nav-hdr')
                if series_elem:
                    series_name = series_elem.get_text(strip=True)

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
                match_summary=status_text,
                match_datetime="", # Will be set by caller if needed
                venue=venue_name,
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
        
        # Find all match cards/links
        match_cards = []
        
        # 1. Look for match links directly (very robust in new layout)
        match_links = soup.find_all('a', href=re.compile(r'/live-cricket-scores/\d+'))
        if match_links:
            match_cards.extend(match_links)
            debug(f"[Cricbuzz] Found {len(match_links)} match links")
        
        # 2. Add legacy containers if present
        selectors = [
            ('div', 'cb-mtch-lst'),
            ('div', 'cb-col-100 cb-col cb-col-scores'),
            ('div', 'cb-scr-wll-chvrn')
        ]
        for tag, cls in selectors:
            found = soup.find_all(tag, class_=cls)
            if found:
                match_cards.extend(found)
                debug(f"[Cricbuzz] Found {len(found)} cards with class {cls}")

        if not match_cards:
            warn(f"[Cricbuzz] No match cards or links found on live scores page. Site layout might have changed.")
            # Log first 200 chars of page text for debugging
            debug(f"[Cricbuzz] Page text snippet: {soup.get_text()[:200]}...")
            return None
        
        # Remove duplicates while preserving order
        seen = set()
        unique_cards = []
        for card in match_cards:
            cid = str(card.get('href') or card)
            if cid not in seen:
                seen.add(cid)
                unique_cards.append(card)
        
        match_cards = unique_cards
        
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
        # 1. Try new Tailwind layout title attribute
        title = card.get('title', '')
        if ' vs ' in title:
            # Title often like "Delhi Capitals vs Chennai Super Kings, 48th Match..."
            match_part = title.split(',')[0]
            if ' vs ' in match_part:
                teams = match_part.split(' vs ')
                if len(teams) >= 2:
                    return teams[0].strip(), teams[1].strip()
        
        # 2. Try span inside link (Tailwind layout)
        span = card.find('span')
        if span:
            text = span.get_text(strip=True)
            if ' vs ' in text:
                # Text like "DC vs CSK - CSK won"
                match_part = text.split('-')[0]
                if ' vs ' in match_part:
                    parts = match_part.split(' vs ')
                    if len(parts) >= 2:
                        return parts[0].strip(), parts[1].strip()

        # 3. Legacy classes
        team_elements = card.find_all('div', class_=re.compile(r'cb-ovr-flo|cb-hmwkr-tm|cb-hmscg-tm-nm'))
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
