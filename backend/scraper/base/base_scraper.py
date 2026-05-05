"""
Base Scraper Class

Provides common functionality for all scrapers including:
- HTTP session management
- Logging utilities
- Common parsing helpers
"""

import sys
import time
import re
import requests
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Optional, Dict, Any
from bs4 import BeautifulSoup


# Global logging configuration
VERBOSE = True


def logger(msg: str, level: str = "INFO"):
    """Print log message with timestamp to stderr"""
    if VERBOSE or level in ["ERROR", "WARN"]:
        timestamp = datetime.now().strftime("%H:%M:%S")
        # Always use stderr for logs to keep stdout clean for JSON data
        print(f"[{timestamp}] [{level}] {msg}", file=sys.stderr)
        sys.stderr.flush()


def debug(msg: str):
    """Debug log"""
    logger(msg, "DEBUG")


def info(msg: str):
    """Info log"""
    logger(msg, "INFO")


def warn(msg: str):
    """Warning log"""
    logger(msg, "WARN")


def error(msg: str):
    """Error log"""
    logger(msg, "ERROR")


class BaseScraper(ABC):
    """
    Base class for all scrapers.
    
    Provides:
    - HTTP session with proper headers
    - Logging utilities
    - Common parsing methods
    - Request timeout handling
    """
    
    # Default headers to mimic browser
    DEFAULT_HEADERS = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.0.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
    }
    
    def __init__(self, timeout: int = 15, api_key: Optional[str] = None):
        """
        Initialize base scraper
        
        Args:
            timeout: Request timeout in seconds
            api_key: Optional API key for services requiring authentication
        """
        self.timeout = timeout
        self.api_key = api_key
        self.session = requests.Session()
        self.session.headers.update(self.DEFAULT_HEADERS)
        self._scraper_name = self.__class__.__name__
        
        info(f"[{self._scraper_name}] Initialized")
    
    def log(self, msg: str, level: str = "INFO"):
        """Log with scraper name prefix"""
        logger(f"[{self._scraper_name}] {msg}", level)
    
    def debug(self, msg: str):
        """Debug log with scraper name"""
        debug(f"[{self._scraper_name}] {msg}")
    
    def info(self, msg: str):
        """Info log with scraper name"""
        info(f"[{self._scraper_name}] {msg}")
    
    def warn(self, msg: str):
        """Warning log with scraper name"""
        warn(f"[{self._scraper_name}] {msg}")
    
    def error(self, msg: str):
        """Error log with scraper name"""
        error(f"[{self._scraper_name}] {msg}")
    
    def fetch_page(self, url: str) -> Optional[BeautifulSoup]:
        """
        Fetch and parse a web page
        
        Args:
            url: URL to fetch
            
        Returns:
            BeautifulSoup object or None if failed
        """
        try:
            self.debug(f"Fetching: {url}")
            response = self.session.get(url, timeout=self.timeout)
            self.debug(f"HTTP Status: {response.status_code}")
            
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            self.debug(f"Page parsed successfully ({len(response.text)} bytes)")
            
            return soup
            
        except requests.exceptions.Timeout:
            self.error(f"Request timeout for {url}")
            return None
        except requests.exceptions.RequestException as e:
            self.error(f"Request failed: {e}")
            return None
        except Exception as e:
            self.error(f"Unexpected error fetching page: {e}")
            import traceback
            # Always print traceback to stderr for unexpected errors
            print(traceback.format_exc(), file=sys.stderr)
            return None
    
    def fetch_json(self, url: str, headers: Optional[Dict] = None) -> Optional[Dict]:
        """
        Fetch JSON data from API
        
        Args:
            url: API URL
            headers: Optional additional headers
            
        Returns:
            Parsed JSON dict or None if failed
        """
        try:
            self.debug(f"Fetching JSON: {url[:80]}...")
            
            request_headers = self.session.headers.copy()
            if headers:
                request_headers.update(headers)
            
            response = self.session.get(url, headers=request_headers, timeout=self.timeout)
            self.debug(f"HTTP Status: {response.status_code}")
            
            response.raise_for_status()
            
            data = response.json()
            self.debug(f"JSON received successfully")
            return data
            
        except requests.exceptions.Timeout:
            self.error(f"Request timeout for {url}")
            return None
        except requests.exceptions.RequestException as e:
            self.error(f"Request failed: {e}")
            return None
        except ValueError as e:
            self.error(f"Invalid JSON response: {e}")
            return None
        except Exception as e:
            self.error(f"Unexpected error: {e}")
            import traceback
            self.debug(traceback.format_exc())
            return None
    
    def parse_score_pattern(self, text: str) -> Optional[Dict[str, Any]]:
        """
        Parse cricket score from text like '155/7 (20)' or '155-7 (17.3)'
        
        Args:
            text: Score text to parse
            
        Returns:
            Dict with runs, wickets, overs or None
        """
        if not text:
            return None
            
        try:
            # Pattern: runs/wickets (overs) or runs-wickets (overs)
            pattern = r'(\d+)[/-](\d+)\s*\((\d+(?:\.\d+)?)\)'
            match = re.search(pattern, text)
            
            if match:
                return {
                    "runs": int(match.group(1)),
                    "wickets": int(match.group(2)),
                    "overs": float(match.group(3)),
                    "battingTeam": False
                }
            
            # Pattern for all out: runs (overs)
            pattern_allout = r'(\d+)\s*\((\d+(?:\.\d+)?)\)'
            match_allout = re.search(pattern_allout, text)
            if match_allout:
                return {
                    "runs": int(match_allout.group(1)),
                    "wickets": 10,
                    "overs": float(match_allout.group(2)),
                    "battingTeam": False
                }
            
            return None
            
        except Exception as e:
            self.debug(f"Score parse error: {e}")
            return None
    
    def extract_teams_from_title(self, title: str) -> tuple[Optional[str], Optional[str]]:
        """
        Extract team names from page title
        
        Args:
            title: Page title text
            
        Returns:
            Tuple of (team_a, team_b) or (None, None)
        """
        if not title:
            return None, None
        
        # Pattern: "Team A vs Team B," or "Team A vs Team B Match"
        patterns = [
            r'([A-Za-z\s]+?)\s+vs\s+([A-Za-z\s]+?),',
            r'([A-Za-z\s]+?)\s+vs\s+([A-Za-z\s]+?)(?:\s+\d+(?:st|nd|rd|th)\s+Match|$)',
            r'([A-Za-z\s]+?)\s+v\s+([A-Za-z\s]+?)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, title, re.IGNORECASE)
            if match:
                team_a = match.group(1).strip()
                team_b = match.group(2).strip()
                return team_a, team_b
        
        return None, None
    
    def normalize_team_name(self, name: str) -> str:
        """
        Normalize team name for comparison
        
        Args:
            name: Team name to normalize
            
        Returns:
            Normalized name
        """
        if not name:
            return ""
        return name.lower().strip()
    
    def team_matches(self, input_name: str, found_name: str) -> bool:
        """
        Check if team names match (supports abbreviations)
        
        Args:
            input_name: Input team name/abbreviation
            found_name: Found team name
            
        Returns:
            True if names match
        """
        input_lower = self.normalize_team_name(input_name)
        found_lower = self.normalize_team_name(found_name)
        
        # Direct match
        if input_lower == found_lower:
            return True
        
        # Substring match
        if input_lower in found_lower or found_lower in input_lower:
            return True
        
        # Abbreviation mapping for IPL teams
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
        
        if input_lower in abbrev_map:
            keywords = abbrev_map[input_lower]
            return all(kw in found_lower for kw in keywords)
        
        return False
    
    def get_timestamp(self) -> int:
        """Get current timestamp in milliseconds"""
        return int(time.time() * 1000)
    
    @abstractmethod
    def get_score(self, **kwargs) -> Optional[Dict[str, Any]]:
        """
        Get score data - must be implemented by subclasses
        
        Returns:
            Score data dict or None
        """
        pass
    
    @property
    @abstractmethod
    def source_name(self) -> str:
        """Return the source name for this scraper"""
        pass
