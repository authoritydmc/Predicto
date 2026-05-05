#!/usr/bin/env python3
"""
Live Score Scraper for Predictor Manager
Supports cricket and football live score fetching from various sources
"""

import requests
import json
import time
import sys
import re
from typing import Dict, Optional, Any, List
from datetime import datetime
from bs4 import BeautifulSoup

# Setup logging
VERBOSE = True

def log(msg: str, level: str = "INFO"):
    """Print log message with timestamp"""
    if VERBOSE or level in ["ERROR", "WARN"]:
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] [{level}] {msg}", file=sys.stderr if level == "ERROR" else sys.stdout)

def debug(msg: str):
    """Debug log"""
    log(msg, "DEBUG")

def error(msg: str):
    """Error log"""
    log(msg, "ERROR")

def warn(msg: str):
    """Warning log"""
    log(msg, "WARN")


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
        debug(f"[CricAPI] Initialized with API key: {'provided' if api_key else 'not provided'}")
    
    def get_cricket_score(self, match_id: str, team_a: str = None, team_b: str = None) -> Optional[Dict[str, Any]]:
        """Fetch cricket score from CricAPI"""
        log(f"[CricAPI] Starting scraper for match_id: {match_id}")
        
        if not self.api_key:
            warn("[CricAPI] API key not provided - skipping")
            return None
        
        try:
            # Get match info
            url = f"{self.base_url}/match_info?apikey={self.api_key}&id={match_id}"
            debug(f"[CricAPI] Fetching URL: {url.replace(self.api_key, '***')}")
            
            response = self.session.get(url, timeout=10)
            debug(f"[CricAPI] HTTP Status: {response.status_code}")
            response.raise_for_status()
            data = response.json()
            
            debug(f"[CricAPI] API status: {data.get('status')}")
            
            if data.get('status') != 'success':
                warn(f"[CricAPI] API returned non-success status: {data.get('status')}")
                return None
            
            match_data = data.get('data', {})
            debug(f"[CricAPI] Match data received: {json.dumps(match_data, indent=2)[:500]}")
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
        log(f"[Google] Starting scraper for {team_a} vs {team_b}")
        
        if not team_a or not team_b:
            error("[Google] Team names required for scraper")
            return None
        
        try:
            query = f"{team_a} vs {team_b} live score cricket"
            url = f"https://www.google.com/search?q={query}&hl=en"
            debug(f"[Google] Fetching URL: {url}")
            
            response = self.session.get(url, timeout=10)
            debug(f"[Google] HTTP Status: {response.status_code}")
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            debug(f"[Google] Page title: {soup.find('title').get_text(strip=True) if soup.find('title') else 'N/A'}")
            
            # Parse score from Google search results
            # This is a simplified version - actual implementation would need HTML parsing
            # For now, return None as placeholder
            warn("[Google] HTML parsing not fully implemented - needs score extraction logic")
            return None
            
        except Exception as e:
            error(f"[Google] Exception: {e}")
            import traceback
            debug(f"[Google] Traceback: {traceback.format_exc()}")
            return None


class CricbuzzScraper(LiveScoreScraper):
    """Cricket score scraper using Cricbuzz HTML parsing"""
    
    def get_cricket_score(self, match_id: str, team_a: str = None, team_b: str = None, 
                          match_url: str = None) -> Optional[Dict[str, Any]]:
        """Fetch cricket score from Cricbuzz - either from live scores page or direct match URL"""
        log(f"[Cricbuzz] Starting scraper for {team_a} vs {team_b}")
        
        # If direct match URL provided, use that
        if match_url:
            return self._scrape_match_detail_page(match_url, team_a, team_b)
        
        # Otherwise search on live scores page
        return self._scrape_live_scores_page(team_a, team_b)
    
    def _scrape_match_detail_page(self, match_url: str, team_a: str = None, team_b: str = None) -> Optional[Dict[str, Any]]:
        """Scrape detailed match page for full score and match info"""
        log(f"[Cricbuzz] Scraping match detail page: {match_url}")
        
        try:
            response = self.session.get(match_url, timeout=15)
            debug(f"[Cricbuzz] Detail page HTTP Status: {response.status_code}")
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Extract match info
            match_info = self._extract_match_info_from_page(soup, team_a, team_b)
            
            if match_info:
                match_info['matchUrl'] = match_url
                match_info['source'] = 'cricbuzz_detail'
                return match_info
            
            return None
            
        except Exception as e:
            error(f"[Cricbuzz] Error scraping detail page: {e}")
            import traceback
            debug(f"[Cricbuzz] Traceback: {traceback.format_exc()}")
            return None
    
    def _extract_match_info_from_page(self, soup: BeautifulSoup, team_a: str = None, team_b: str = None) -> Optional[Dict[str, Any]]:
        """Extract match info from a detailed match page soup"""
        try:
            # Debug: Print a snippet of HTML to understand the structure
            debug(f"[Cricbuzz] Detail page HTML snippet (first 1000 chars): {str(soup)[:1000]}")
            
            # Look for match header with team names and scores
            # Based on screenshot: team names are in cb-ovr-flo cb-hmscg-tm-nm, scores in cb-ovr-flo
            team_elements = soup.find_all('div', class_='cb-hmscg-tm-nm')
            # Score elements: look for cb-ovr-flo that contains score patterns
            all_ovr_flo = soup.find_all('div', class_='cb-ovr-flo')
            score_elements = []
            for elem in all_ovr_flo:
                text = elem.get_text(strip=True)
                if re.match(r'\d+[/-]\d+', text) or re.match(r'\d+\s*\(', text) or '-' in text and any(c.isdigit() for c in text):
                    score_elements.append(elem)
            
            debug(f"[Cricbuzz] Detail page - Found {len(team_elements)} team elements, {len(score_elements)} score elements")
            debug(f"[Cricbuzz] All cb-ovr-flo elements: {len(all_ovr_flo)}")
            
            teams = []
            scores = []
            
            for elem in team_elements[:2]:
                team_name = elem.get_text(strip=True)
                if team_name and team_name not in teams:
                    teams.append(team_name)
                    debug(f"[Cricbuzz] Team found: {team_name}")
            
            # If no teams found with primary selector, try alternative
            if len(teams) < 2:
                # Try finding in the match header section
                header = soup.find('div', class_='cb-nav-hdr') or soup.find('div', class_='cb-mat-preview')
                if header:
                    # Look for team names in h1 or title
                    h1 = header.find('h1') or soup.find('h1')
                    if h1:
                        h1_text = h1.get_text(strip=True)
                        debug(f"[Cricbuzz] H1 text: {h1_text}")
                        # Try to extract team names from title like "DC vs CSK 48th Match..."
                        match = re.match(r'([A-Za-z\s]+?)\s+vs\s+([A-Za-z\s]+?)(?:\s+\d|$)', h1_text)
                        if match:
                            teams = [match.group(1).strip(), match.group(2).strip()]
                            debug(f"[Cricbuzz] Teams from H1: {teams}")
                
                # If still no teams, try looking at title tag
                if len(teams) < 2:
                    title_elem = soup.find('title')
                    if title_elem:
                        title_text = title_elem.get_text(strip=True)
                        debug(f"[Cricbuzz] Title text: {title_text}")
                        # Extract from title like "Cricket commentary | Delhi Capitals vs Chennai Super Kings, 48th Match..."
                        # Pattern: anything | Team A vs Team B, Match...
                        match = re.search(r'([A-Za-z\s]+?)\s+vs\s+([A-Za-z\s]+?),', title_text)
                        if match:
                            teams = [match.group(1).strip(), match.group(2).strip()]
                            debug(f"[Cricbuzz] Teams from title: {teams}")
                        else:
                            # Try another pattern for titles like "Team A vs Team B 48th Match..."
                            match = re.search(r'([A-Za-z\s]+?)\s+vs\s+([A-Za-z\s]+?)(?:\s+\d+(?:st|nd|rd|th)\s+Match|$)', title_text)
                            if match:
                                teams = [match.group(1).strip(), match.group(2).strip()]
                                debug(f"[Cricbuzz] Teams from title (alt pattern): {teams}")
            
            for elem in score_elements[:2]:  # Only take first 2 scores
                text = elem.get_text(strip=True)
                score_data = self._parse_score_text(text)
                if score_data:
                    scores.append(score_data)
                    debug(f"[Cricbuzz] Score found: {score_data}")
            
            # If no scores found, try alternative: look for text containing score patterns
            if len(scores) == 0:
                all_text = soup.get_text()
                # Find score patterns like "155-7 (20)" or "159/2 (17.3)"
                score_patterns = re.findall(r'(\d+)[/-](\d+)\s*\((\d+(?:\.\d+)?)\)', all_text)
                debug(f"[Cricbuzz] Found score patterns: {score_patterns}")
                for runs, wickets, overs in score_patterns[:2]:
                    scores.append({
                        "runs": int(runs),
                        "wickets": int(wickets),
                        "overs": float(overs),
                        "battingTeam": False
                    })
            
            # Also look for match result text to determine winner
            result_elem = soup.find('div', class_='cb-text-complete') or soup.find('div', class_=lambda x: x and 'won' in str(x).lower())
            result_text = ""
            if result_elem:
                result_text = result_elem.get_text(strip=True)
                debug(f"[Cricbuzz] Result text: {result_text}")
            
            if len(teams) >= 2:
                team_a_score = scores[0] if len(scores) > 0 else {"runs": 0, "wickets": 0, "overs": 0, "battingTeam": False}
                team_b_score = scores[1] if len(scores) > 1 else {"runs": 0, "wickets": 0, "overs": 0, "battingTeam": False}
                
                # Extract match status
                status_elem = soup.find('div', class_='cb-text-live') or soup.find('div', class_='cb-text-complete') or soup.find('div', class_='cb-text-stumps')
                match_status = "scheduled"
                if status_elem:
                    status_text = status_elem.get_text(strip=True).lower()
                    debug(f"[Cricbuzz] Status text: {status_text}")
                    if 'live' in status_text:
                        match_status = "live"
                    elif 'won' in status_text or 'complete' in status_text or 'result' in status_text:
                        match_status = "completed"
                
                # If still scheduled but both teams have scores, it's likely completed
                if match_status == "scheduled" and team_a_score["runs"] > 0 and team_b_score["runs"] > 0:
                    match_status = "completed"
                
                # Extract match info (date, time, venue)
                match_info_elem = soup.find('div', class_='cb-nav-subhdr') or soup.find('div', class_='cb-mat-info')
                match_datetime = ""
                venue = ""
                if match_info_elem:
                    info_text = match_info_elem.get_text(strip=True)
                    debug(f"[Cricbuzz] Match info: {info_text}")
                    match_datetime = info_text
                
                # Extract series name
                series_elem = soup.find('div', class_='cb-nav-hdr') or soup.find('h1')
                series_name = ""
                if series_elem:
                    series_name = series_elem.get_text(strip=True)
                    debug(f"[Cricbuzz] Series: {series_name}")
                
                # Determine which team is batting based on overs
                if team_a_score["overs"] > 0 and team_b_score["overs"] == 0:
                    team_a_score["battingTeam"] = True
                elif team_b_score["overs"] > 0 and team_a_score["overs"] == 0:
                    team_b_score["battingTeam"] = True
                elif team_b_score["overs"] > team_a_score["overs"]:
                    team_b_score["battingTeam"] = True
                elif team_a_score["overs"] > team_b_score["overs"]:
                    team_a_score["battingTeam"] = True
                
                result = {
                    "teamA": {
                        "name": teams[0],
                        "runs": team_a_score["runs"],
                        "wickets": team_a_score["wickets"],
                        "overs": team_a_score["overs"],
                        "battingTeam": team_a_score.get("battingTeam", False)
                    },
                    "teamB": {
                        "name": teams[1],
                        "runs": team_b_score["runs"],
                        "wickets": team_b_score["wickets"],
                        "overs": team_b_score["overs"],
                        "battingTeam": team_b_score.get("battingTeam", False)
                    },
                    "currentInnings": 2 if team_a_score["overs"] > 0 and team_b_score["overs"] > 0 else 1,
                    "matchStatus": match_status,
                    "matchDateTime": match_datetime,
                    "venue": venue,
                    "series": series_name,
                    "lastUpdated": int(time.time() * 1000),
                    "source": "cricbuzz"
                }
                
                log(f"[Cricbuzz] [SUCCESS] Successfully extracted match info from detail page")
                log(f"[Cricbuzz] Teams: {teams[0]} ({team_a_score['runs']}/{team_a_score['wickets']}) vs {teams[1]} ({team_b_score['runs']}/{team_b_score['wickets']})")
                return result
            
            warn(f"[Cricbuzz] Could not extract complete match info - teams: {teams}, scores: {scores}")
            return None
            
        except Exception as e:
            error(f"[Cricbuzz] Error extracting match info: {e}")
            import traceback
            debug(f"[Cricbuzz] Traceback: {traceback.format_exc()}")
            return None
    
    def _scrape_live_scores_page(self, team_a: str, team_b: str) -> Optional[Dict[str, Any]]:
        """Scrape live scores page and find matching match"""
        try:
            # Try to fetch live matches page
            url = "https://www.cricbuzz.com/cricket-match/live-scores"
            debug(f"[Cricbuzz] Fetching URL: {url}")
            
            response = self.session.get(url, timeout=15)
            debug(f"[Cricbuzz] HTTP Status: {response.status_code}")
            debug(f"[Cricbuzz] Response length: {len(response.text)} bytes")
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Log page title for verification
            page_title = soup.find('title')
            debug(f"[Cricbuzz] Page title: {page_title.get_text(strip=True) if page_title else 'N/A'}")
            
            # Find all live match cards - try multiple selectors
            match_cards = soup.find_all('div', class_='cb-mtch-lst') or soup.find_all('a', class_='text-hvr-underline') or soup.find_all('div', class_='cb-col-8')
            debug(f"[Cricbuzz] Found {len(match_cards)} potential match cards with cb-mtch-lst")
            
            if len(match_cards) == 0:
                # Try alternative selectors
                match_cards = soup.find_all('div', class_='cb-col-100 cb-col cb-col-scores')
                debug(f"[Cricbuzz] Found {len(match_cards)} cards with cb-col-100 cb-col cb-col-scores")
            
            if len(match_cards) == 0:
                # Try finding by match links
                match_links = soup.find_all('a', href=re.compile(r'/live-cricket-scores/\d+'))
                debug(f"[Cricbuzz] Found {len(match_links)} match links")
                match_cards = match_links
            
            card_index = 0
            for card in match_cards:
                card_index += 1
                # Extract team names
                team_elements = card.find_all('div', class_='cb-ovr-flo')
                if len(team_elements) < 2:
                    continue
                
                card_team_a = team_elements[0].get_text(strip=True).lower()
                card_team_b = team_elements[1].get_text(strip=True).lower()
                debug(f"[Cricbuzz] Card #{card_index}: Found teams: '{card_team_a}' vs '{card_team_b}'")
                
                # Check if this card matches our teams
                team_a_lower = team_a.lower()
                team_b_lower = team_b.lower()
                debug(f"[Cricbuzz] Looking for: '{team_a_lower}' vs '{team_b_lower}'")
                
                match_found = (
                    (team_a_lower in card_team_a or card_team_a in team_a_lower or 
                     self._team_abbreviation_match(team_a, card_team_a)) and
                    (team_b_lower in card_team_b or card_team_b in team_b_lower or 
                     self._team_abbreviation_match(team_b, card_team_b))
                ) or (
                    (team_a_lower in card_team_b or card_team_b in team_a_lower or 
                     self._team_abbreviation_match(team_a, card_team_b)) and
                    (team_b_lower in card_team_a or card_team_a in team_b_lower or 
                     self._team_abbreviation_match(team_b, card_team_a))
                )
                
                if match_found:
                    log(f"[Cricbuzz] [FOUND] Match found: {card_team_a} vs {card_team_b}")
                    # Extract scores
                    score_elements = card.find_all('div', class_='cb-ovr-flo')
                    
                    team_a_score = {"runs": 0, "wickets": 0, "overs": 0.0, "battingTeam": False}
                    team_b_score = {"runs": 0, "wickets": 0, "overs": 0.0, "battingTeam": False}
                    
                    for elem in score_elements:
                        text = elem.get_text(strip=True)
                        debug(f"[Cricbuzz] Parsing element text: '{text}'")
                        # Parse score format like "145/2 (18.3)" or "145-2 (18.3)"
                        if '/' in text or '-' in text:
                            score_data = self._parse_score_text(text)
                            if score_data:
                                debug(f"[Cricbuzz] Parsed score: runs={score_data['runs']}, wickets={score_data['wickets']}, overs={score_data['overs']}")
                                if team_a_score["runs"] == 0:
                                    team_a_score = score_data
                                else:
                                    team_b_score = score_data
                    
                    # Get match status
                    status_elem = card.find('div', class_='cb-text-live') or card.find('div', class_='cb-text-complete')
                    match_status = "live" if status_elem and 'live' in status_elem.get_text(strip=True).lower() else "scheduled"
                    
                    if card.find('div', class_='cb-text-complete') or 'won' in (status_elem.get_text(strip=True).lower() if status_elem else ''):
                        match_status = "completed"
                    
                    # Determine batting team based on overs
                    if team_a_score["overs"] > 0 and team_b_score["overs"] == 0:
                        team_a_score["battingTeam"] = True
                    elif team_b_score["overs"] > 0 and team_a_score["overs"] == 0:
                        team_b_score["battingTeam"] = True
                    elif team_a_score["overs"] > team_b_score["overs"]:
                        team_a_score["battingTeam"] = True
                    elif team_b_score["overs"] > team_a_score["overs"]:
                        team_b_score["battingTeam"] = True
                    
                    return {
                        "teamA": team_a_score,
                        "teamB": team_b_score,
                        "currentInnings": 2 if team_a_score["overs"] > 0 and team_b_score["overs"] > 0 else 1,
                        "matchStatus": match_status,
                        "lastUpdated": int(time.time() * 1000),
                        "source": "cricbuzz"
                    }
            
            warn(f"[Cricbuzz] Match {team_a} vs {team_b} not found on Cricbuzz")
            debug(f"[Cricbuzz] All team pairs found in cards:")
            for i, card in enumerate(match_cards[:10], 1):
                team_elems = card.find_all('div', class_='cb-ovr-flo')
                if len(team_elems) >= 2:
                    t1 = team_elems[0].get_text(strip=True)
                    t2 = team_elems[1].get_text(strip=True)
                    debug(f"  Card {i}: {t1} vs {t2}")
            return None
            
        except Exception as e:
            error(f"[Cricbuzz] Exception: {e}")
            import traceback
            debug(f"[Cricbuzz] Traceback: {traceback.format_exc()}")
            return None
    
    def _team_abbreviation_match(self, team_input: str, team_found: str) -> bool:
        """Check if team abbreviations match"""
        abbrev_map = {
            'dc': ['delhi', 'capitals'],
            'csk': ['chennai', 'super', 'kings'],
            'rcb': ['royal', 'challengers', 'bangalore'],
            'mi': ['mumbai', 'indians'],
            'kkr': ['kolkata', 'knight', 'riders'],
            'srh': ['sunrisers', 'hyderabad'],
            'pbks': ['punjab', 'kings'],
            'rr': ['rajasthan', 'royals'],
            'gt': ['gujarat', 'titans'],
            'lsg': ['lucknow', 'super', 'giants'],
        }
        
        team_input_lower = team_input.lower()
        team_found_lower = team_found.lower()
        
        if team_input_lower in abbrev_map:
            keywords = abbrev_map[team_input_lower]
            return all(kw in team_found_lower for kw in keywords)
        
        return False
    
    def _parse_score_text(self, text: str) -> Optional[Dict[str, Any]]:
        """Parse score text like '145/2 (18.3)' or '145-2 (18.3 ov)'"""
        try:
            debug(f"[Cricbuzz] Parsing score text: '{text}'")
            # Match patterns like "145/2 (18.3)", "145-2 (18.3 ov)", "145/2 18.3"
            pattern = r'(\d+)[/-](\d+)\s*\(?([\d.]+)'
            match = re.search(pattern, text)
            
            if match:
                runs = int(match.group(1))
                wickets = int(match.group(2))
                overs = float(match.group(3))
                debug(f"[Cricbuzz] Regex match: runs={runs}, wickets={wickets}, overs={overs}")
                return {"runs": runs, "wickets": wickets, "overs": overs, "battingTeam": False}
            
            # Try pattern without wickets: "145 (18.3)" - all out
            pattern_allout = r'(\d+)\s*\(?([\d.]+)'
            match_allout = re.search(pattern_allout, text)
            if match_allout:
                runs = int(match_allout.group(1))
                overs = float(match_allout.group(2))
                debug(f"[Cricbuzz] All-out pattern match: runs={runs}, overs={overs}")
                return {"runs": runs, "wickets": 10, "overs": overs, "battingTeam": False}
            
            debug(f"[Cricbuzz] No score pattern matched in: '{text}'")
            return None
        except Exception as e:
            debug(f"[Cricbuzz] Parse error: {e}")
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
    
    def get_cricket_score_with_fallback(self, match_id: str, team_a: str = None, team_b: str = None, match_url: str = None) -> Optional[Dict[str, Any]]:
        """Try each scraper in order until one succeeds"""
        log(f"[Manager] Starting cricket score fetch for {team_a} vs {team_b}")
        if match_url:
            log(f"[Manager] Using direct match URL: {match_url}")
        log(f"[Manager] Scraper order: {self.scraper_order}")
        
        for scraper_name in self.scraper_order:
            if scraper_name not in self.scrapers:
                warn(f"[Manager] Scraper '{scraper_name}' not available")
                continue
            
            scraper = self.scrapers[scraper_name]
            log(f"[Manager] Trying {scraper_name} scraper...")
            
            try:
                # Pass match_url only to cricbuzz which supports it
                if scraper_name == 'cricbuzz' and match_url:
                    result = scraper.get_cricket_score(match_id, team_a, team_b, match_url=match_url)
                else:
                    result = scraper.get_cricket_score(match_id, team_a, team_b)
                    
                if result:
                    result['source'] = scraper_name
                    log(f"[Manager] [SUCCESS] Successfully fetched score from {scraper_name}")
                    return result
                else:
                    warn(f"[Manager] {scraper_name} returned no data")
            except Exception as e:
                error(f"[Manager] Error with {scraper_name}: {e}")
                import traceback
                debug(f"[Manager] Traceback: {traceback.format_exc()}")
                continue
        
        error("[Manager] All scrapers failed")
        return None
    
    def get_football_score_with_fallback(self, match_id: str, team_a: str = None, team_b: str = None) -> Optional[Dict[str, Any]]:
        """Try each football scraper in order until one succeeds"""
        log(f"[Manager] Starting football score fetch")
        football_scrapers = [s for s in self.scraper_order if s in ['apifootball']]
        log(f"[Manager] Available football scrapers: {football_scrapers}")
        
        for scraper_name in football_scrapers:
            if scraper_name not in self.scrapers:
                warn(f"[Manager] Football scraper '{scraper_name}' not available")
                continue
            
            scraper = self.scrapers[scraper_name]
            log(f"[Manager] Trying {scraper_name} scraper...")
            
            try:
                result = scraper.get_football_score(match_id, team_a, team_b)
                if result:
                    result['source'] = scraper_name
                    log(f"[Manager] [SUCCESS] Successfully fetched football score from {scraper_name}")
                    return result
                else:
                    warn(f"[Manager] {scraper_name} returned no data")
            except Exception as e:
                error(f"[Manager] Error with {scraper_name}: {e}")
                import traceback
                debug(f"[Manager] Traceback: {traceback.format_exc()}")
                continue
        
        error("[Manager] All football scrapers failed")
        return None
    
    def set_scraper_order(self, new_order: List[str]):
        """Update the priority order of scrapers"""
        self.scraper_order = new_order


def main():
    """CLI interface for running scraper"""
    log("=" * 50)
    log("Live Score Scraper Starting")
    log(f"Arguments: {sys.argv[1:]}")
    
    if len(sys.argv) < 2:
        print("Usage: python live_score_scraper.py <sport> <match_id> [team_a] [team_b] [scraper_order] [match_url]")
        print("Examples:")
        print("  python live_score_scraper.py cricket match123 RCB CSK cricbuzz")
        print("  python live_score_scraper.py cricket match123 --match-url https://www.cricbuzz.com/live-cricket-scores/...")
        sys.exit(1)
    
    sport = sys.argv[1].lower()
    match_id = sys.argv[2] if len(sys.argv) > 2 else "unknown"
    
    # Parse optional arguments
    team_a = None
    team_b = None
    scraper_order = None
    match_url = None
    
    # Look for --match-url flag and its value
    skip_next = False
    clean_args = []
    for i, arg in enumerate(sys.argv[3:], start=3):
        if skip_next:
            skip_next = False
            continue
        if arg == '--match-url' and i + 1 < len(sys.argv):
            match_url = sys.argv[i + 1]
            skip_next = True
        else:
            clean_args.append(arg)
    
    # Get team names and scraper order from clean args
    if len(clean_args) >= 1 and not clean_args[0].startswith('http'):
        team_a = clean_args[0]
    if len(clean_args) >= 2 and not clean_args[1].startswith('http'):
        team_b = clean_args[1]
    if len(clean_args) >= 3:
        scraper_order = clean_args[2].split(',')
    
    log(f"[CLI] Parsed args - sport: {sport}, match_id: {match_id}, team_a: {team_a}, team_b: {team_b}, match_url: {match_url}")
    
    manager = ScraperManager(scraper_order)
    
    if sport == 'cricket':
        result = manager.get_cricket_score_with_fallback(match_id, team_a, team_b, match_url=match_url)
    elif sport == 'football':
        result = manager.get_football_score_with_fallback(match_id, team_a, team_b)
    else:
        print(f"Unsupported sport: {sport}")
        sys.exit(1)
    
    if result:
        log(f"[SUCCESS] Score fetched from {result.get('source', 'unknown')}")
        log(f"[RESULT] {json.dumps(result, indent=2)}")
        print(json.dumps(result))
    else:
        error("All scrapers failed - no score data available")
        print(json.dumps({"error": "Failed to fetch score from all sources"}))
        sys.exit(1)


if __name__ == "__main__":
    main()
