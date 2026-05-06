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
    
    def _extract_both_team_scores(self, soup: BeautifulSoup, team_a_name: str, team_b_name: str) -> Optional[tuple]:
        """
        Extract scores for both teams from the page
        For ongoing matches: batting team score + first innings score
        
        Returns:
            Tuple of (team_a_score, team_b_score) where each is (runs, wickets, overs) or None if can't find both
        """
        try:
            # Get all text with structure
            page_text = soup.get_text(separator='\n', strip=True)
            
            # Find all score patterns in order of appearance
            all_scores = re.findall(r'(\d+)[/-](\d+)\s*\((\d+(?:\.\d+)?)\)', page_text)
            debug(f"[Cricbuzz] Total score patterns found: {len(all_scores)}")
            
            if len(all_scores) < 1:
                debug(f"[Cricbuzz] Found no score patterns")
                return None
            
            # Get unique scores
            unique_scores = []
            seen_scores = set()
            
            for score in all_scores:
                score_tuple = (score[0], score[1], score[2])
                if score_tuple not in seen_scores:
                    seen_scores.add(score_tuple)
                    unique_scores.append(score)
                    debug(f"[Cricbuzz] Unique score #{len(unique_scores)}: {score[0]}/{score[1]} ({score[2]})")
            
            # If we have 2 unique scores, return them
            if len(unique_scores) >= 2:
                debug(f"[Cricbuzz] Found 2 different scores, using them")
                return (unique_scores[0], unique_scores[1])
            
            # If we only have 1 unique score, try to find the first innings score
            if len(unique_scores) == 1:
                debug(f"[Cricbuzz] Only 1 unique score found, looking for first innings score...")
                
                # Look for first innings information
                # Pattern: "Innings 1" or "First Innings" or team name followed by score
                first_innings_match = re.search(
                    r'(?:First\s+Innings|Innings\s+1|Innings\s+1st)[:\s]+(.+?)(?:runs?|balls?|wickets?)',
                    page_text,
                    re.IGNORECASE
                )
                
                if first_innings_match:
                    debug(f"[Cricbuzz] Found First Innings text")
                    # Look for score pattern in this section
                    first_inn_text = page_text[max(0, first_innings_match.start()-200):first_innings_match.end()+200]
                    first_inn_scores = re.findall(r'(\d+)[/-](\d+)\s*\((\d+(?:\.\d+)?)\)', first_inn_text)
                    if first_inn_scores:
                        # Filter out the score we already have
                        for score in first_inn_scores:
                            if score != unique_scores[0]:
                                debug(f"[Cricbuzz] Found first innings score: {score[0]}/{score[1]} ({score[2]})")
                                return (unique_scores[0], score)
                
                # Try alternative: look for "all out" patterns which indicate first innings end
                allout_match = re.search(r'(\d+)\s+all\s+out|all\s+out\s+(\d+)', page_text, re.IGNORECASE)
                if allout_match:
                    debug(f"[Cricbuzz] Found 'all out' pattern")
                
                # Look for section breaks or scorecard sections
                for separator in ['scorecard', 'innings', 'final score', 'first inning', 'second inning']:
                    if separator.lower() in page_text.lower():
                        # Find context around this separator
                        idx = page_text.lower().find(separator.lower())
                        section = page_text[max(0, idx-300):idx+300]
                        section_scores = re.findall(r'(\d+)[/-](\d+)\s*\((\d+(?:\.\d+)?)\)', section)
                        
                        for score in section_scores:
                            if score != unique_scores[0]:
                                debug(f"[Cricbuzz] Found score in '{separator}' section: {score[0]}/{score[1]} ({score[2]})")
                                return (unique_scores[0], score)
            
            debug(f"[Cricbuzz] Could not find 2 different scores")
            return None
            
        except Exception as e:
            debug(f"[Cricbuzz] Error in _extract_both_team_scores: {e}")
            import traceback
            debug(traceback.format_exc())
            return None
    
    def _extract_match_data(self, soup: BeautifulSoup, match_url: str) -> Optional[CricketScoreData]:

        """
        Try to extract two different scores from HTML structure
        This is more reliable than global text regex as it looks at specific elements
        
        Returns:
            List of two score tuples or None
        """
        try:
            # Strategy: Look for scorecard containers and extract scores from specific areas
            # Cricbuzz typically has main scorecard on the page
            
            scores_found = []
            
            # 1. Look for div elements that contain score patterns
            # Try to find divs with specific score patterns
            for elem in soup.find_all('div'):
                text = elem.get_text(strip=True)
                # Look for score pattern like "54/1 (3.3)" 
                if re.search(r'\d+[/-]\d+\s*\(\d+(?:\.\d+)?\)', text):
                    score = self.parse_score_pattern(text)
                    if score:
                        score_info = (str(score['runs']), str(score['wickets']), str(score['overs']))
                        
                        # Check if we already have this exact score
                        already_added = any(
                            s == score_info for s in scores_found
                        )
                        if not already_added:
                            scores_found.append(score_info)
                            debug(f"[Cricbuzz] Found score: {score_info[0]}/{score_info[1]} ({score_info[2]})")
                            if len(scores_found) >= 2:
                                break
            
            # 2. If we found 2 different scores, return them
            if len(scores_found) >= 2:
                debug(f"[Cricbuzz] Extracted 2 different scores from HTML structure")
                return scores_found[:2]
            
            # 3. Fallback: Look in span elements
            if len(scores_found) < 2:
                for elem in soup.find_all('span'):
                    text = elem.get_text(strip=True)
                    if re.search(r'\d+[/-]\d+\s*\(\d+(?:\.\d+)?\)', text):
                        score = self.parse_score_pattern(text)
                        if score:
                            score_info = (str(score['runs']), str(score['wickets']), str(score['overs']))
                            already_added = any(s == score_info for s in scores_found)
                            if not already_added:
                                scores_found.append(score_info)
                                debug(f"[Cricbuzz] Found score in span: {score_info[0]}/{score_info[1]} ({score_info[2]})")
                                if len(scores_found) >= 2:
                                    break
            
            if len(scores_found) >= 2:
                debug(f"[Cricbuzz] Extracted 2 different scores from spans")
                return scores_found[:2]
            
            debug(f"[Cricbuzz] Structure extraction found only {len(scores_found)} unique scores")
            return None if len(scores_found) < 2 else scores_found
            
        except Exception as e:
            debug(f"[Cricbuzz] Error extracting from structure: {e}")
            return None
    
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
            
            # First, try to extract both team scores from the HTML structure
            both_scores = self._extract_both_team_scores(soup, team_a, team_b)
            
            if both_scores:
                team_a_score, team_b_score = both_scores
                team_a_runs, team_a_wickets, team_a_overs = team_a_score
                team_b_runs, team_b_wickets, team_b_overs = team_b_score
                debug(f"[Cricbuzz] Successfully extracted both team scores from structure")
            else:
                # Fallback: Extract scores from page text using regex patterns
                all_text = soup.get_text()
                score_patterns = re.findall(r'(\d+)[/-](\d+)\s*\((\d+(?:\.\d+)?)\)', all_text)
                debug(f"[Cricbuzz] Found score patterns from text: {score_patterns}")
                
                if len(score_patterns) < 1:
                    warn(f"[Cricbuzz] No score patterns found at all")
                    return None
                
                # Get unique scores
                unique_scores = []
                seen_scores = set()
                for score in score_patterns:
                    score_tuple = (score[0], score[1], score[2])
                    if score_tuple not in seen_scores:
                        seen_scores.add(score_tuple)
                        unique_scores.append(score)
                
                if len(unique_scores) < 1:
                    warn(f"[Cricbuzz] No unique scores found")
                    return None
                elif len(unique_scores) == 1:
                    # Only found one unique score - this is likely a live match where only batting team's score is shown
                    warn(f"[Cricbuzz] Only 1 unique score found: {unique_scores[0][0]}/{unique_scores[0][1]} ({unique_scores[0][2]})")
                    warn(f"[Cricbuzz] Using it for team A and setting team B to 0/0 (0) as fallback")
                    team_a_runs, team_a_wickets, team_a_overs = unique_scores[0]
                    # For team B, we don't have data, so set to 0
                    team_b_runs, team_b_wickets, team_b_overs = ('0', '0', '0')
                else:
                    # Multiple unique scores found
                    team_a_runs, team_a_wickets, team_a_overs = unique_scores[0]
                    team_b_runs, team_b_wickets, team_b_overs = unique_scores[1]
            
            # Determine batting teams based on overs
            team_a_batting, team_b_batting = self.determine_batting_team(
                float(team_a_overs), float(team_b_overs)
            )
            
            # Extract match status
            status_elem = (soup.find('div', class_='cb-text-live') or 
                          soup.find('div', class_='cb-text-complete') or
                          soup.find('div', class_='cb-text-stumps'))
            status_text = status_elem.get_text(strip=True) if status_elem else ""
            
            # Determine match status: if any team has overs>0, it's live; otherwise check status text
            if float(team_a_overs) > 0 or float(team_b_overs) > 0:
                match_status = "live"  # If either team is batting, match is live
                debug(f"[Cricbuzz] Determined match status as LIVE based on team overs")
            else:
                match_status = self.determine_match_status(status_text, both_have_scores=False)
                debug(f"[Cricbuzz] Determined match status as {match_status} from status text")
            
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
