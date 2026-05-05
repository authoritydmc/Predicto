"""
Team Name Matcher Module

Provides comprehensive team name normalization and matching.
Handles different abbreviations, nicknames, and variations across sites.

Examples:
    CSK -> Chennai Super Kings
    DC -> Delhi Capitals, Delhi, Capitals
    IND -> India, Indian, Team India
    
Usage:
    from scraper.utils import TeamMatcher
    
    matcher = TeamMatcher()
    
    # Check if names match
    if matcher.matches('CSK', 'Chennai Super Kings'):
        print("Match found!")
    
    # Get canonical name
    canonical = matcher.get_canonical_name('CSK')  # "Chennai Super Kings"
    
    # Find all variations
    variations = matcher.get_variations('Delhi Capitals')
    # ['Delhi Capitals', 'Delhi', 'Capitals', 'DC']
"""

import re
from typing import Dict, List, Set, Optional, Tuple
from difflib import SequenceMatcher


# ============================================================================
# TEAM DATABASE
# ============================================================================

class TeamDatabase:
    """
    Comprehensive database of team names, abbreviations, and variations.
    
    Organized by sport and league for easy maintenance.
    """
    
    # Cricket Teams - IPL
    IPL_TEAMS: Dict[str, Dict] = {
        'chennai_super_kings': {
            'canonical': 'Chennai Super Kings',
            'abbreviations': ['CSK', 'CSKS'],
            'nicknames': ['Super Kings', 'Chennai', 'Yellow Army', 'Whistle Podu'],
            'location': 'Chennai',
            'colors': ['yellow', 'blue'],
        },
        'delhi_capitals': {
            'canonical': 'Delhi Capitals',
            'abbreviations': ['DC', 'DEL'],
            'nicknames': ['Capitals', 'Delhi', 'Dilli'],
            'location': 'Delhi',
            'colors': ['blue', 'red'],
        },
        'mumbai_indians': {
            'canonical': 'Mumbai Indians',
            'abbreviations': ['MI', 'MUM'],
            'nicknames': ['Indians', 'Mumbai', 'Paltan'],
            'location': 'Mumbai',
            'colors': ['blue', 'gold'],
        },
        'royal_challengers_bangalore': {
            'canonical': 'Royal Challengers Bangalore',
            'abbreviations': ['RCB', 'RCBANG'],
            'nicknames': ['Challengers', 'Bangalore', 'RCB', 'Bold Diaries'],
            'location': 'Bangalore',
            'colors': ['red', 'black'],
        },
        'kolkata_knight_riders': {
            'canonical': 'Kolkata Knight Riders',
            'abbreviations': ['KKR', 'KOL'],
            'nicknames': ['Knight Riders', 'Kolkata', 'Knights', 'KKR'],
            'location': 'Kolkata',
            'colors': ['purple', 'gold'],
        },
        'rajasthan_royals': {
            'canonical': 'Rajasthan Royals',
            'abbreviations': ['RR', 'RAJ'],
            'nicknames': ['Royals', 'Rajasthan', 'Pink Army'],
            'location': 'Jaipur',
            'colors': ['pink', 'blue'],
        },
        'punjab_kings': {
            'canonical': 'Punjab Kings',
            'abbreviations': ['PBKS', 'PK', 'KXIP'],
            'nicknames': ['Kings', 'Punjab', 'Sher-e-Punjab'],
            'location': 'Mohali',
            'colors': ['red', 'gold'],
        },
        'sunrisers_hyderabad': {
            'canonical': 'Sunrisers Hyderabad',
            'abbreviations': ['SRH', 'SUN'],
            'nicknames': ['Sunrisers', 'Hyderabad', 'Orange Army'],
            'location': 'Hyderabad',
            'colors': ['orange', 'black'],
        },
        'gujarat_titans': {
            'canonical': 'Gujarat Titans',
            'abbreviations': ['GT', 'GUJ'],
            'nicknames': ['Titans', 'Gujarat', 'Aava De'],
            'location': 'Ahmedabad',
            'colors': ['blue', 'gold'],
        },
        'lucknow_super_giants': {
            'canonical': 'Lucknow Super Giants',
            'abbreviations': ['LSG', 'LUC'],
            'nicknames': ['Super Giants', 'Lucknow', 'LSG'],
            'location': 'Lucknow',
            'colors': ['blue', 'orange'],
        },
    }
    
    # Cricket Teams - International
    INTERNATIONAL_TEAMS: Dict[str, Dict] = {
        'india': {
            'canonical': 'India',
            'abbreviations': ['IND', 'INDIA', 'IN'],
            'nicknames': ['Team India', 'Men in Blue', 'Blues', 'Indian'],
            'location': 'India',
            'colors': ['blue'],
        },
        'australia': {
            'canonical': 'Australia',
            'abbreviations': ['AUS', 'AUSCR', 'AU'],
            'nicknames': ['Aussies', 'Baggy Greens', 'Kangaroos'],
            'location': 'Australia',
            'colors': ['gold', 'green'],
        },
        'england': {
            'canonical': 'England',
            'abbreviations': ['ENG', 'ENGLAND'],
            'nicknames': ['Three Lions', 'Poms', 'English'],
            'location': 'England',
            'colors': ['blue', 'red', 'white'],
        },
        'pakistan': {
            'canonical': 'Pakistan',
            'abbreviations': ['PAK', 'PAKISTAN'],
            'nicknames': ['Men in Green', 'Green Shirts', 'Shaheens', 'Pak'],
            'location': 'Pakistan',
            'colors': ['green'],
        },
        'south_africa': {
            'canonical': 'South Africa',
            'abbreviations': ['SA', 'RSA', 'SAF'],
            'nicknames': ['Proteas', 'Springboks', 'Saffas'],
            'location': 'South Africa',
            'colors': ['green', 'gold'],
        },
        'new_zealand': {
            'canonical': 'New Zealand',
            'abbreviations': ['NZ', 'NZL', 'BLACKCAPS'],
            'nicknames': ['Black Caps', 'Kiwis', 'NZ'],
            'location': 'New Zealand',
            'colors': ['black'],
        },
        'sri_lanka': {
            'canonical': 'Sri Lanka',
            'abbreviations': ['SL', 'SRI', 'SRILANKA'],
            'nicknames': ['Lions', 'Lankan Lions', 'Sri Lankans'],
            'location': 'Sri Lanka',
            'colors': ['blue', 'gold'],
        },
        'west_indies': {
            'canonical': 'West Indies',
            'abbreviations': ['WI', 'WINDIES', 'WEST'],
            'nicknames': ['Windies', 'Caribbeans', 'Calypso Kings'],
            'location': 'West Indies',
            'colors': ['maroon'],
        },
        'bangladesh': {
            'canonical': 'Bangladesh',
            'abbreviations': ['BAN', 'BANGLA', 'BD'],
            'nicknames': ['Tigers', 'Bangla Tigers', 'Bengal Tigers'],
            'location': 'Bangladesh',
            'colors': ['green', 'red'],
        },
        'afghanistan': {
            'canonical': 'Afghanistan',
            'abbreviations': ['AFG', 'AFGHAN'],
            'nicknames': ['Afghan Atalan', 'Afghans'],
            'location': 'Afghanistan',
            'colors': ['blue', 'red'],
        },
        'ireland': {
            'canonical': 'Ireland',
            'abbreviations': ['IRE', 'IRL', 'IRELAND'],
            'nicknames': ['Irish', 'Green and Whites'],
            'location': 'Ireland',
            'colors': ['green', 'white'],
        },
        'zimbabwe': {
            'canonical': 'Zimbabwe',
            'abbreviations': ['ZIM', 'ZIMBABWE', 'ZIMB'],
            'nicknames': ['Chevrons', 'Zims'],
            'location': 'Zimbabwe',
            'colors': ['red', 'green', 'gold'],
        },
    }
    
    # Football - Premier League
    EPL_TEAMS: Dict[str, Dict] = {
        'manchester_united': {
            'canonical': 'Manchester United',
            'abbreviations': ['MUFC', 'MANU', 'MU', 'UNITED'],
            'nicknames': ['Red Devils', 'United', 'Man U', 'Man Utd'],
            'location': 'Manchester',
        },
        'manchester_city': {
            'canonical': 'Manchester City',
            'abbreviations': ['MCFC', 'MANC', 'CITY', 'MC'],
            'nicknames': ['City', 'Citizens', 'Man City', 'Sky Blues'],
            'location': 'Manchester',
        },
        'liverpool': {
            'canonical': 'Liverpool',
            'abbreviations': ['LFC', 'LIV', 'LPOOL'],
            'nicknames': ['Reds', 'Liverpool FC', 'The Reds'],
            'location': 'Liverpool',
        },
        'chelsea': {
            'canonical': 'Chelsea',
            'abbreviations': ['CFC', 'CHE', 'CHEL'],
            'nicknames': ['Blues', 'Pensioners', 'The Blues'],
            'location': 'London',
        },
        'arsenal': {
            'canonical': 'Arsenal',
            'abbreviations': ['AFC', 'ARS', 'GUNNERS'],
            'nicknames': ['Gunners', 'The Arsenal', 'The Gunners'],
            'location': 'London',
        },
        'tottenham': {
            'canonical': 'Tottenham Hotspur',
            'abbreviations': ['THFC', 'TOT', 'SPURS'],
            'nicknames': ['Spurs', 'Tottenham', 'The Spurs', 'Lilywhites'],
            'location': 'London',
        },
    }
    
    @classmethod
    def get_all_cricket_teams(cls) -> Dict[str, Dict]:
        """Get all cricket teams combined"""
        all_teams = {}
        all_teams.update(cls.IPL_TEAMS)
        all_teams.update(cls.INTERNATIONAL_TEAMS)
        return all_teams
    
    @classmethod
    def get_all_football_teams(cls) -> Dict[str, Dict]:
        """Get all football teams"""
        return cls.EPL_TEAMS.copy()
    
    @classmethod
    def get_team_by_canonical(cls, sport: str, canonical_name: str) -> Optional[Dict]:
        """Find team by canonical name"""
        teams = cls.get_all_cricket_teams() if sport == 'cricket' else cls.get_all_football_teams()
        
        for team_id, team_data in teams.items():
            if team_data['canonical'].lower() == canonical_name.lower():
                return team_data
        
        return None


# ============================================================================
# TEAM MATCHER
# ============================================================================

class TeamMatcher:
    """
    Intelligent team name matcher with fuzzy matching capabilities.
    
    Features:
    - Exact matching
    - Abbreviation expansion
    - Fuzzy matching with similarity threshold
    - Multi-word token matching
    - Alias/shortcut recognition
    """
    
    def __init__(self, sport: str = 'cricket', similarity_threshold: float = 0.6):
        """
        Initialize team matcher
        
        Args:
            sport: 'cricket' or 'football'
            similarity_threshold: Minimum similarity for fuzzy matching (0.0-1.0)
        """
        self.sport = sport.lower()
        self.similarity_threshold = similarity_threshold
        
        # Load team database
        if self.sport == 'cricket':
            self.teams = TeamDatabase.get_all_cricket_teams()
        elif self.sport == 'football':
            self.teams = TeamDatabase.get_all_football_teams()
        else:
            raise ValueError(f"Unknown sport: {sport}")
        
        # Build lookup indexes for fast matching
        self._build_indexes()
    
    def _build_indexes(self):
        """Build lookup indexes for fast matching"""
        # Canonical name -> team_id
        self.canonical_index: Dict[str, str] = {}
        
        # Abbreviation -> team_id
        self.abbrev_index: Dict[str, str] = {}
        
        # Nickname/variant -> team_id
        self.nickname_index: Dict[str, str] = {}
        
        for team_id, team_data in self.teams.items():
            canonical = team_data['canonical'].lower()
            self.canonical_index[canonical] = team_id
            
            # Index abbreviations
            for abbrev in team_data.get('abbreviations', []):
                self.abbrev_index[abbrev.lower()] = team_id
            
            # Index nicknames
            for nickname in team_data.get('nicknames', []):
                self.nickname_index[nickname.lower()] = team_id
    
    def normalize(self, name: str) -> str:
        """
        Normalize team name for comparison
        
        - Lowercase
        - Remove extra spaces
        - Remove common suffixes like "FC", "Club"
        """
        if not name:
            return ""
        
        # Lowercase and strip
        normalized = name.lower().strip()
        
        # Remove extra spaces
        normalized = ' '.join(normalized.split())
        
        # Remove common suffixes
        suffixes_to_remove = [' fc', ' club', ' cricket', ' team']
        for suffix in suffixes_to_remove:
            if normalized.endswith(suffix):
                normalized = normalized[:-len(suffix)]
        
        return normalized.strip()
    
    def matches(self, name1: str, name2: str) -> bool:
        """
        Check if two team names refer to the same team
        
        Args:
            name1: First team name
            name2: Second team name
            
        Returns:
            True if names match
        """
        if not name1 or not name2:
            return False
        
        # Normalize both names
        norm1 = self.normalize(name1)
        norm2 = self.normalize(name2)
        
        # Direct match after normalization
        if norm1 == norm2:
            return True
        
        # Check if both map to same team
        team1_id = self._lookup_team(norm1)
        team2_id = self._lookup_team(norm2)
        
        if team1_id and team2_id:
            return team1_id == team2_id
        
        # Fuzzy matching
        similarity = self._calculate_similarity(norm1, norm2)
        if similarity >= self.similarity_threshold:
            return True
        
        # Token matching (for partial matches like "Delhi" matching "Delhi Capitals")
        if self._token_match(norm1, norm2):
            return True
        
        return False
    
    def _lookup_team(self, normalized_name: str) -> Optional[str]:
        """Look up team ID by normalized name"""
        # Check canonical
        if normalized_name in self.canonical_index:
            return self.canonical_index[normalized_name]
        
        # Check abbreviations
        if normalized_name in self.abbrev_index:
            return self.abbrev_index[normalized_name]
        
        # Check nicknames
        if normalized_name in self.nickname_index:
            return self.nickname_index[normalized_name]
        
        return None
    
    def _calculate_similarity(self, str1: str, str2: str) -> float:
        """Calculate string similarity using SequenceMatcher"""
        return SequenceMatcher(None, str1, str2).ratio()
    
    def _token_match(self, str1: str, str2: str) -> bool:
        """
        Check if tokens from one string match tokens from another
        Useful for partial matches
        """
        tokens1 = set(str1.split())
        tokens2 = set(str2.split())
        
        # Check if any significant token matches
        common_tokens = tokens1 & tokens2
        
        # If at least one meaningful token matches
        for token in common_tokens:
            # Ignore very short tokens
            if len(token) >= 3:
                # Check if this token uniquely identifies a team
                matching_teams = self._find_teams_with_token(token)
                if len(matching_teams) == 1:
                    return True
        
        return False
    
    def _find_teams_with_token(self, token: str) -> List[str]:
        """Find all team IDs that contain a specific token"""
        matching = []
        for team_id, team_data in self.teams.items():
            canonical = team_data['canonical'].lower()
            if token in canonical:
                matching.append(team_id)
            else:
                for nickname in team_data.get('nicknames', []):
                    if token in nickname.lower():
                        matching.append(team_id)
                        break
        return matching
    
    def get_canonical_name(self, name: str) -> Optional[str]:
        """
        Get canonical name for a team
        
        Args:
            name: Any variation of team name
            
        Returns:
            Canonical name or None if not found
        """
        normalized = self.normalize(name)
        team_id = self._lookup_team(normalized)
        
        if team_id:
            return self.teams[team_id]['canonical']
        
        # Try fuzzy match
        best_match = None
        best_similarity = 0.0
        
        for team_id, team_data in self.teams.items():
            canonical = team_data['canonical'].lower()
            similarity = self._calculate_similarity(normalized, canonical)
            
            if similarity > best_similarity and similarity >= self.similarity_threshold:
                best_similarity = similarity
                best_match = team_id
        
        if best_match:
            return self.teams[best_match]['canonical']
        
        return None
    
    def get_variations(self, name: str) -> List[str]:
        """
        Get all variations of a team name
        
        Args:
            name: Team name (any variation)
            
        Returns:
            List of all known variations including abbreviations and nicknames
        """
        canonical = self.get_canonical_name(name)
        if not canonical:
            return [name]
        
        team_id = self._lookup_team(canonical.lower())
        if not team_id:
            return [name]
        
        team_data = self.teams[team_id]
        
        variations = [team_data['canonical']]
        variations.extend(team_data.get('abbreviations', []))
        variations.extend(team_data.get('nicknames', []))
        variations.append(team_data.get('location', ''))
        
        # Remove duplicates and empty strings
        return list(set(v for v in variations if v))
    
    def find_best_match(self, query: str, candidates: List[str]) -> Tuple[Optional[str], float]:
        """
        Find best matching team name from a list of candidates
        
        Args:
            query: Team name to match
            candidates: List of candidate names to match against
            
        Returns:
            Tuple of (best_match, similarity_score)
        """
        best_match = None
        best_score = 0.0
        
        query_canonical = self.get_canonical_name(query)
        
        for candidate in candidates:
            # Check if they match
            if self.matches(query, candidate):
                candidate_canonical = self.get_canonical_name(candidate)
                
                if query_canonical and candidate_canonical:
                    if query_canonical == candidate_canonical:
                        return candidate, 1.0
                
                score = self._calculate_similarity(
                    self.normalize(query),
                    self.normalize(candidate)
                )
                
                if score > best_score:
                    best_score = score
                    best_match = candidate
        
        return best_match, best_score
    
    def extract_teams_from_text(self, text: str) -> List[Dict]:
        """
        Extract team mentions from text
        
        Args:
            text: Text to search for team names
            
        Returns:
            List of dicts with 'name', 'canonical', 'position'
        """
        found_teams = []
        text_lower = text.lower()
        
        for team_id, team_data in self.teams.items():
            canonical = team_data['canonical']
            
            # Check canonical name
            if canonical.lower() in text_lower:
                pos = text_lower.find(canonical.lower())
                found_teams.append({
                    'name': canonical,
                    'canonical': canonical,
                    'position': pos,
                    'team_id': team_id
                })
                continue
            
            # Check abbreviations
            for abbrev in team_data.get('abbreviations', []):
                # Use word boundary matching for abbreviations
                pattern = r'\b' + re.escape(abbrev.lower()) + r'\b'
                match = re.search(pattern, text_lower)
                if match:
                    found_teams.append({
                        'name': abbrev,
                        'canonical': canonical,
                        'position': match.start(),
                        'team_id': team_id
                    })
                    break
            
            # Check nicknames
            for nickname in team_data.get('nicknames', []):
                if nickname.lower() in text_lower:
                    pos = text_lower.find(nickname.lower())
                    found_teams.append({
                        'name': nickname,
                        'canonical': canonical,
                        'position': pos,
                        'team_id': team_id
                    })
                    break
        
        # Sort by position in text
        found_teams.sort(key=lambda x: x['position'])
        
        return found_teams


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def quick_match(name1: str, name2: str, sport: str = 'cricket') -> bool:
    """
    Quick one-off team name match check
    
    Usage:
        if quick_match('CSK', 'Chennai Super Kings'):
            print("Match!")
    """
    matcher = TeamMatcher(sport)
    return matcher.matches(name1, name2)


def get_all_variations(name: str, sport: str = 'cricket') -> List[str]:
    """
    Get all variations of a team name
    
    Usage:
        variations = get_all_variations('DC')
        # ['Delhi Capitals', 'DC', 'Delhi', 'Capitals']
    """
    matcher = TeamMatcher(sport)
    return matcher.get_variations(name)


def find_in_text(text: str, sport: str = 'cricket') -> List[str]:
    """
    Find all team names mentioned in text
    
    Usage:
        teams = find_in_text("RCB vs CSK match today")
        # ['Royal Challengers Bangalore', 'Chennai Super Kings']
    """
    matcher = TeamMatcher(sport)
    found = matcher.extract_teams_from_text(text)
    return [t['canonical'] for t in found]
