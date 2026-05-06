#!/usr/bin/env python3
"""
Match Creation Script
Creates new matches from external sources
Can be run standalone or triggered by automation system
"""

import sys
import os
import json
import time
import argparse
from typing import Dict, Any, List
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from base.firebase_client import FirebaseClient
from scheduler.websocket_logger import WebSocketLogger


class MatchSource(Enum):
    CRICBUZZ = "cricbuzz"
    CRICAPI = "cricapi"
    MANUAL = "manual"


@dataclass
class MatchData:
    id: str
    team_a: str
    team_b: str
    scheduled_time: int
    venue: str
    sport: str = 'cricket'
    tournament_id: str
    match_type: str = 'ipl'


class MatchCreator:
    """
    Creates matches from various sources with validation
    """
    
    def __init__(self, firebase_client: FirebaseClient, logger: WebSocketLogger):
        self.client = firebase_client
        self.logger = logger
        
        # Match sources configuration
        self.sources = {
            'cricbuzz': {
                'name': 'Cricbuzz',
                'enabled': True,
                'priority': 1
            },
            'cricapi': {
                'name': 'CricAPI',
                'enabled': True,
                'priority': 2
            },
            'manual': {
                'name': 'Manual Entry',
                'enabled': False,
                'priority': 3
            }
        }
        
        # Load source configuration
        self._load_source_config()
    
    def _load_source_config(self):
        """Load match source configuration from Firebase"""
        config_data = self.client.get('automation_config/match_sources') or {}
        
        defaults = {
            'cricbuzz': {'enabled': True, 'priority': 1},
            'cricapi': {'enabled': True, 'priority': 2},
            'manual': {'enabled': False, 'priority': 3}
        }
        
        # Update with saved config
        for source, defaults in defaults.items():
            if source in config_data:
                self.sources[source]['enabled'] = config_data[source].get('enabled', defaults['enabled'])
                self.sources[source]['priority'] = config_data[source].get('priority', defaults['priority'])
            else:
                self.sources[source] = defaults.copy()
        
        self.logger.info('match_creator', f'Loaded match source configuration: {self.sources}')
    
    def _save_source_config(self):
        """Save match source configuration to Firebase"""
        config_data = {}
        for source, config in self.sources.items():
            config_data[source] = {
                'enabled': config['enabled'],
                'priority': config['priority']
            }
        
        self.client.set('automation_config/match_sources', config_data)
        self.logger.info('match_creator', 'Match source configuration saved')
    
    def _create_match_id(self, team_a: str, team_b: str, date_str: str) -> str:
        """Generate consistent match ID"""
        # Create slug from team names
        team_a_slug = team_a.lower().replace(' ', '-').replace(' ', '')
        team_b_slug = team_b.lower().replace(' ', '-').replace(' ', '')
        
        # Get date parts
        date_parts = date_str.split('-')
        if len(date_parts) >= 3:
            date_str = '-'.join(date_parts[:3])  # YYYY-MM-DD
        else:
            date_str = date_str
        
        return f"{team_a_slug}-vs-{team_b_slug}-{date_str}"
    
    def _validate_match_data(self, match: MatchData) -> bool:
        """Validate match data before creation"""
        if not all([match.id, match.team_a, match.team_b, match.scheduled_time]):
            self.logger.error('match_creator', f'Missing required fields for match: {match.id}')
            return False
        
        # Validate team names
        if not match.team_a.strip() or not match.team_b.strip():
            self.logger.error('match_creator', f'Empty team names for match: {match.id}')
            return False
        
        # Validate scheduled time is in future
        current_time = int(time.time() * 1000)
        if match.scheduled_time <= current_time:
            self.logger.error('match_creator', f'Scheduled time is in the past for match: {match.id}')
            return False
        
        # Validate match ID format
        if len(match.id) < 3:
            self.logger.error('match_creator', f'Invalid match ID format: {match.id}')
            return False
        
        return True
    
    def _create_match_in_firebase(self, match: MatchData) -> bool:
        """Create match in Firebase if it doesn't exist"""
        try:
            # Check if match already exists
            existing_path = f"prod/tournaments/{match.sport}/{match.tournament_id}/matches/{match.id}"
            if self.client.get(existing_path):
                self.logger.warning('match_creator', f'Match already exists: {match.id}')
                return False
            
            # Create match structure
            match_data = {
                'id': match.id,
                'teamA': match.team_a,
                'teamB': match.team_b,
                'scheduledTime': match.scheduled_time,
                'venue': match.venue,
                'sport': match.sport,
                'status': 'scheduled',
                'createdAt': int(time.time() * 1000),
                'meta': {
                    'disableScoreA': False,
                    'disableScoreB': False,
                    'predictionsEnabled': True,
                    'predictionsPaused': False,
                    'allowReprediction': True
                }
            }
            
            # Create match
            self.client.set(existing_path, match_data)
            
            self.logger.info('match_creator', f'Created match: {match.id} - {match.team_a} vs {match.team_b}')
            return True
            
        except Exception as e:
            self.logger.error('match_creator', f'Error creating match {match.id}: {str(e)}')
            return False
    
    def scrape_cricbuzz_matches(self) -> List[MatchData]:
        """Scrape upcoming matches from Cricbuzz"""
        try:
            import requests
            from scraper.cricket.cricbuzz_scraper import scrape_cricbuzz_match
            
            self.logger.info('match_creator', 'Scraping Cricbuzz for upcoming matches')
            
            # Get IPL teams mapping
            ipl_teams = {
                "MI": "Mumbai Indians", "CSK": "Chennai Super Kings", 
                "RCB": "Royal Challengers Bengaluru", "KKR": "Kolkata Knight Riders", 
                "SRH": "Sunrisers Hyderabad", "PBKS": "Punjab Kings",
                "DC": "Delhi Capitals", "RR": "Rajasthan Royals", 
                "GT": "Gujarat Titans", "LSG": "Lucknow Super Giants"
            }
            
            # Fetch main page to get match list
            html = requests.get('https://www.cricbuzz.com/cricket-match/live-scores', timeout=15).text
            
            # Extract match links using regex
            import re
            match_pattern = r'href="(/live-cricket-scores/(\d+)/([^"]+))"'
            matches = re.findall(match_pattern, html)
            
            upcoming_matches = []
            for match_path, teams in matches:
                # Extract team names from URL
                url_teams = teams.lower().split('-vs-')
                if len(url_teams) >= 2:
                    team_a = url_teams[0].strip()
                    team_b = url_teams[1].strip()
                    
                    # Map to full team names
                    full_team_a = ipl_teams.get(team_a.upper(), team_a)
                    full_team_b = ipl_teams.get(team_b.upper(), team_b)
                    
                    if full_team_a and full_team_b:
                        # Generate match ID and scheduled time
                        tomorrow = datetime.now() + timedelta(days=1)
                        scheduled_time = int(tomorrow.timestamp() * 1000)
                        
                        match_id = self._create_match_id(full_team_a, full_team_b, tomorrow.strftime('%Y-%m-%d'))
                        
                        match = MatchData(
                            id=match_id,
                            team_a=full_team_a,
                            team_b=full_team_b,
                            scheduled_time=scheduled_time,
                            venue='TBD',  # Will be updated later
                            tournament_id='ipl2026'
                        )
                        
                        if self._validate_match_data(match):
                            upcoming_matches.append(match)
                            self.logger.info('match_creator', f'Found match: {full_team_a} vs {full_team_b}')
                    else:
                        self.logger.warning('match_creator', f'Could not map teams: {team_a} vs {team_b}')
            
            self.logger.info('match_creator', f'Found {len(upcoming_matches)} upcoming matches from Cricbuzz')
            return upcoming_matches
            
        except Exception as e:
            self.logger.error('match_creator', f'Error scraping Cricbuzz: {str(e)}')
            return []
    
    def create_manual_match(self, team_a: str, team_b: str, scheduled_time: int, venue: str = 'TBD') -> bool:
        """Create a manual match entry"""
        match_id = self._create_match_id(team_a, team_b, datetime.fromtimestamp(scheduled_time/1000).strftime('%Y-%m-%d'))
        
        match = MatchData(
            id=match_id,
            team_a=team_a,
            team_b=team_b,
            scheduled_time=scheduled_time,
            venue=venue,
            tournament_id='ipl2026'
        )
        
        return self._create_match_in_firebase(match)
    
    def create_matches_batch(self, matches: List[MatchData]) -> Dict[str, Any]:
        """Create multiple matches in batch"""
        created_count = 0
        updated_count = 0
        
        for match in matches:
            if self._create_match_in_firebase(match):
                created_count += 1
            else:
                updated_count += 1
        
        return {
            'success': True,
            'created': created_count,
            'updated': updated_count,
            'total': len(matches)
        }
    
    def get_available_sources(self) -> Dict[str, Any]:
        """Get available match sources and their status"""
        return {
            'sources': {
                source: {
                    'name': config['name'],
                    'enabled': config['enabled'],
                    'priority': config['priority']
                }
                for source, config in self.sources.items()
            },
            'total_sources': len(self.sources)
        }
    
    def update_source_config(self, source: str, enabled: bool, priority: int) -> Dict[str, Any]:
        """Update match source configuration"""
        if source not in self.sources:
            return {'success': False, 'error': f'Unknown source: {source}'}
        
        self.sources[source]['enabled'] = enabled
        self.sources[source]['priority'] = priority
        self._save_source_config()
        
        return {
            'success': True,
            'source': source,
            'config': {
                'enabled': enabled,
                'priority': priority
            }
        }


def main():
    """Main CLI interface"""
    parser = argparse.ArgumentParser(description='Match Creation Script')
    parser.add_argument('--action', type=str, choices=['scrape', 'create-manual', 'create-batch'], 
                       required=True, help='Action to perform')
    parser.add_argument('--team-a', type=str, help='Team A name')
    parser.add_argument('--team-b', type=str, help='Team B name')
    parser.add_argument('--date', type=str, help='Match date (YYYY-MM-DD)')
    parser.add_argument('--time', type=int, help='Scheduled time (timestamp)')
    parser.add_argument('--venue', type=str, default='TBD', help='Match venue')
    parser.add_argument('--env', type=str, choices=['local', 'prod'], default='prod',
                       help='Environment mode')
    
    args = parser.parse_args()
    
    try:
        # Initialize Firebase client
        firebase_client = FirebaseClient()
        logger = WebSocketLogger(firebase_client)
        
        # Initialize match creator
        creator = MatchCreator(firebase_client, logger)
        
        if args.action == 'scrape':
            # Scrape upcoming matches
            matches = creator.scrape_cricbuzz_matches()
            result = creator.create_matches_batch(matches)
            
        elif args.action == 'create-manual':
            # Create single manual match
            if not all([args.team_a, args.team_b, args.date, args.time]):
                parser.error('Missing required arguments: --team-a, --team-b, --date, --time')
                sys.exit(1)
            
            match = creator.create_manual_match(
                args.team_a, args.team_b, args.time, args.venue
            )
            
            result = {
                'success': True,
                'created': 1,
                'match_id': match.id,
                'match': f'{match.team_a} vs {match.team_b}'
            }
            
        elif args.action == 'create-batch':
            # Would load matches from file (future feature)
            parser.error('Batch creation not yet implemented')
            sys.exit(1)
            
        else:
            parser.print_help()
            sys.exit(1)
        
        # Display result
        print(f"\n=== Result ===")
        print(f"Success: {result['success']}")
        if 'created' in result:
            print(f"Matches Created: {result['created']}")
        if 'updated' in result:
            print(f"Matches Updated: {result['updated']}")
        if 'total' in result:
            print(f"Total Matches: {result['total']}")
        
        firebase_client.set('automation_config/last_match_creation', int(time.time() * 1000))
        
    except Exception as e:
        print(f"Error: {str(e)}")
        sys.exit(1)


if __name__ == '__main__':
    main()
