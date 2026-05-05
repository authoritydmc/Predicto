"""
Match Creation and Management System
Handles match creation, updates, and lifecycle management
"""

import requests
import json
import time
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from dataclasses import dataclass

from ..base.firebase_client import FirebaseClient
from ..scheduler.websocket_logger import WebSocketLogger


@dataclass
class MatchInfo:
    """Match information structure"""
    id: str
    tournament_id: str
    team_a: str
    team_b: str
    scheduled_time: int
    venue: str
    match_type: str  # 't20', 'odi', 'test'
    status: str = 'scheduled'
    live_score: Optional[Dict[str, Any]] = None
    meta: Optional[Dict[str, Any]] = None

    def __post_init__(self):
        if self.meta is None:
            self.meta = {}


class MatchManager:
    """
    Manages match creation, updates, and lifecycle
    Integrates with external sources for match schedules
    """
    
    def __init__(self, firebase_client: FirebaseClient, logger: WebSocketLogger):
        self.client = firebase_client
        self.logger = logger
        self.running = False
        
        # External API configurations
        self.api_configs = self._load_api_configs()
        
        # Match sources
        self.match_sources = {
            'cricapi': self._fetch_from_cricapi,
            'cricbuzz': self._fetch_from_cricbuzz,
            'manual': self._fetch_manual_matches
        }
    
    def _load_api_configs(self) -> Dict[str, Any]:
        """Load API configurations from Firebase"""
        return self.client.get('automation_config/match_sources') or {}
    
    def start(self):
        """Start the match manager"""
        self.running = True
        self.logger.info('match_manager', 'Match manager started')
    
    def stop(self):
        """Stop the match manager"""
        self.running = False
        self.logger.info('match_manager', 'Match manager stopped')
    
    def fetch_upcoming_matches(self) -> List[MatchInfo]:
        """
        Fetch upcoming matches from various sources
        
        Returns:
            List of upcoming matches
        """
        all_matches = []
        
        for source_name, fetch_func in self.match_sources.items():
            try:
                self.logger.info('match_manager', f'Fetching matches from {source_name}')
                matches = fetch_func()
                all_matches.extend(matches)
                self.logger.info('match_manager', f'Fetched {len(matches)} matches from {source_name}')
            except Exception as e:
                self.logger.error('match_manager', f'Failed to fetch from {source_name}: {str(e)}')
        
        # Remove duplicates and sort by scheduled time
        unique_matches = self._deduplicate_matches(all_matches)
        unique_matches.sort(key=lambda m: m.scheduled_time)
        
        return unique_matches
    
    def _fetch_from_cricapi(self) -> List[MatchInfo]:
        """Fetch matches from CricAPI"""
        api_key = self.api_configs.get('cricapi', {}).get('api_key')
        if not api_key:
            return []
        
        try:
            url = "https://api.cricapi.com/v1/matches"
            params = {'apikey': api_key, 'status': 'upcoming'}
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            if data.get('status') != 'success':
                return []
            
            matches = []
            for match_data in data.get('data', []):
                match_info = self._parse_cricapi_match(match_data)
                if match_info:
                    matches.append(match_info)
            
            return matches
            
        except Exception as e:
            self.logger.error('match_manager', f'CricAPI fetch error: {str(e)}')
            return []
    
    def _parse_cricapi_match(self, match_data: Dict[str, Any]) -> Optional[MatchInfo]:
        """Parse CricAPI match data"""
        try:
            teams = match_data.get('teams', [])
            if len(teams) < 2:
                return None
            
            return MatchInfo(
                id=match_data.get('id', ''),
                tournament_id='cricapi_default',
                team_a=teams[0],
                team_b=teams[1],
                scheduled_time=int(datetime.strptime(match_data.get('date', ''), '%Y-%m-%d').timestamp() * 1000) if match_data.get('date') else 0,
                venue=match_data.get('venue', ''),
                match_type=self._determine_match_type(match_data.get('series', '')),
                status=match_data.get('status', 'scheduled')
            )
        except Exception as e:
            self.logger.error('match_manager', f'Error parsing CricAPI match: {str(e)}')
            return None
    
    def _fetch_from_cricbuzz(self) -> List[MatchInfo]:
        """Fetch matches from Cricbuzz (web scraping)"""
        try:
            url = "https://www.cricbuzz.com/api/v1/matches/schedule"
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            matches = []
            
            for match_data in data.get('matches', []):
                match_info = self._parse_cricbuzz_match(match_data)
                if match_info:
                    matches.append(match_info)
            
            return matches
            
        except Exception as e:
            self.logger.error('match_manager', f'Cricbuzz fetch error: {str(e)}')
            return []
    
    def _parse_cricbuzz_match(self, match_data: Dict[str, Any]) -> Optional[MatchInfo]:
        """Parse Cricbuzz match data"""
        try:
            match_info = match_data.get('matchInfo', {})
            
            return MatchInfo(
                id=match_info.get('id', ''),
                tournament_id=match_info.get('series', {}).get('id', ''),
                team_a=match_info.get('team1', {}).get('teamName', ''),
                team_b=match_info.get('team2', {}).get('teamName', ''),
                scheduled_time=int(match_info.get('startDate', 0)),
                venue=match_info.get('venue', ''),
                match_type=self._determine_match_type(match_info.get('series', '')),
                status='scheduled'
            )
        except Exception as e:
            self.logger.error('match_manager', f'Error parsing Cricbuzz match: {str(e)}')
            return None
    
    def _fetch_manual_matches(self) -> List[MatchInfo]:
        """Fetch manually configured matches"""
        manual_matches = self.client.get('automation_config/manual_matches') or []
        
        matches = []
        for match_data in manual_matches:
            try:
                match_info = MatchInfo(
                    id=match_data['id'],
                    tournament_id=match_data['tournament_id'],
                    team_a=match_data['team_a'],
                    team_b=match_data['team_b'],
                    scheduled_time=match_data['scheduled_time'],
                    venue=match_data.get('venue', ''),
                    match_type=match_data.get('match_type', 't20'),
                    status='scheduled'
                )
                matches.append(match_info)
            except Exception as e:
                self.logger.error('match_manager', f'Error parsing manual match: {str(e)}')
        
        return matches
    
    def _determine_match_type(self, series_info: str) -> str:
        """Determine match type from series information"""
        series_lower = series_info.lower()
        
        if 't20' in series_lower or 'twenty' in series_lower:
            return 't20'
        elif 'odi' in series_lower or 'one day' in series_lower:
            return 'odi'
        elif 'test' in series_lower:
            return 'test'
        else:
            return 't20'  # Default
    
    def _deduplicate_matches(self, matches: List[MatchInfo]) -> List[MatchInfo]:
        """Remove duplicate matches based on team names and time"""
        seen = set()
        unique_matches = []
        
        for match in matches:
            # Create a key based on team names and scheduled time (within 1 hour window)
            time_window = int(match.scheduled_time / 3600000)  # Hour window
            key = f"{match.team_a.lower()}_{match.team_b.lower()}_{time_window}"
            
            if key not in seen:
                seen.add(key)
                unique_matches.append(match)
        
        return unique_matches
    
    def create_match_if_not_exists(self, match: MatchInfo) -> bool:
        """
        Create match in Firebase if it doesn't exist
        
        Args:
            match: Match information
            
        Returns:
            True if match was created, False if it already existed
        """
        # Check if match already exists
        existing_path = f"tournaments/{match.tournament_id}/matches/{match.id}"
        existing_match = self.client.get(existing_path)
        
        if existing_match:
            return False
        
        # Create match structure
        match_data = {
            'id': match.id,
            'teamA': match.team_a,
            'teamB': match.team_b,
            'scheduledTime': match.scheduled_time,
            'venue': match.venue,
            'matchType': match.match_type,
            'status': match.status,
            'meta': match.meta,
            'predictions': {},
            'createdAt': int(time.time() * 1000)
        }
        
        # Save to Firebase
        success = self.client.set(existing_path, match_data)
        
        if success:
            self.logger.info('match_manager', f'Created match: {match.team_a} vs {match.team_b}')
            
            # Broadcast match creation
            self._broadcast_match_event('match_created', match_data)
        else:
            self.logger.error('match_manager', f'Failed to create match: {match.id}')
        
        return success
    
    def get_active_matches(self) -> List[Dict[str, Any]]:
        """
        Get matches that are currently active (live or about to start)
        
        Returns:
            List of active matches
        """
        current_time = int(time.time() * 1000)
        active_matches = []
        
        # Get all tournaments
        tournaments = self.client.get('tournaments') or {}
        
        for tournament_id, tournament_data in tournaments.items():
            matches = tournament_data.get('matches', {})
            
            for match_id, match_data in matches.items():
                match_status = match_data.get('status', '')
                scheduled_time = match_data.get('scheduledTime', 0)
                
                # Include matches that are:
                # 1. Currently live
                # 2. Starting within the next 2 hours
                # 3. Recently completed (within last hour)
                time_diff = abs(current_time - scheduled_time)
                
                if (match_status == 'live' or 
                    match_status == 'live-ball-by-ball' or
                    (match_status == 'scheduled' and scheduled_time - current_time <= 7200000) or  # 2 hours
                    (match_status in ['completed', 'done'] and current_time - scheduled_time <= 3600000)):  # 1 hour
                    
                    match_data['tournamentId'] = tournament_id
                    match_data['matchId'] = match_id
                    active_matches.append(match_data)
        
        return active_matches
    
    def update_match_score(self, match_id: str, score_data: Dict[str, Any]) -> bool:
        """
        Update match with live score data
        
        Args:
            match_id: Match ID
            score_data: Live score data
            
        Returns:
            True if successful
        """
        try:
            # Find the match in tournaments
            match_path = self._find_match_path(match_id)
            if not match_path:
                self.logger.error('match_manager', f'Match not found: {match_id}')
                return False
            
            # Update match with score data
            update_data = {
                'liveScore': score_data,
                'lastScoreUpdate': int(time.time() * 1000),
                'status': self._determine_match_status(score_data)
            }
            
            # Add toss information if available
            if 'tossWinner' in score_data:
                update_data['tossWinner'] = score_data['tossWinner']
            
            success = self.client.update(match_path, update_data)
            
            if success:
                self.logger.info('match_manager', f'Updated score for match: {match_id}')
                
                # Broadcast score update
                self._broadcast_match_event('score_updated', {
                    'matchId': match_id,
                    'scoreData': score_data,
                    'timestamp': int(time.time() * 1000)
                })
            
            return success
            
        except Exception as e:
            self.logger.error('match_manager', f'Error updating match score: {str(e)}')
            return False
    
    def _find_match_path(self, match_id: str) -> Optional[str]:
        """Find the Firebase path for a match"""
        tournaments = self.client.get('tournaments') or {}
        
        for tournament_id, tournament_data in tournaments.items():
            matches = tournament_data.get('matches', {})
            if match_id in matches:
                return f"tournaments/{tournament_id}/matches/{match_id}"
        
        return None
    
    def _determine_match_status(self, score_data: Dict[str, Any]) -> str:
        """Determine match status from score data"""
        match_status = score_data.get('matchStatus', '').lower()
        
        if 'live' in match_status:
            return 'live'
        elif 'completed' in match_status or 'won' in match_status:
            return 'completed'
        elif 'scheduled' in match_status:
            return 'scheduled'
        else:
            return 'live'  # Default to live for safety
    
    def _broadcast_match_event(self, event_type: str, data: Dict[str, Any]):
        """Broadcast match event via WebSocket"""
        message = {
            'type': 'match_event',
            'eventType': event_type,
            'data': data,
            'timestamp': int(time.time() * 1000)
        }
        
        self.logger.broadcast('match_manager', json.dumps(message))
    
    def get_status(self) -> Dict[str, Any]:
        """Get match manager status"""
        return {
            'running': self.running,
            'active_matches_count': len(self.get_active_matches()),
            'api_configs': self.api_configs,
            'last_fetch_time': int(time.time() * 1000)
        }
