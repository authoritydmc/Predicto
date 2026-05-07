"""Auto-schedule next matches based on scraper data"""
import logging
from typing import List, Dict, Optional
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class MatchScheduler:
    """Auto-schedules upcoming matches"""
    
    def __init__(self, firebase_client, scraper_manager):
        self.firebase = firebase_client
        self.scraper_manager = scraper_manager
    
    def discover_and_schedule(self, sport: str = "cricket", days_ahead: int = 3) -> int:
        """
        Discover upcoming matches and schedule them
        
        Returns: Number of matches scheduled
        """
        try:
            # Get upcoming matches from scraper
            upcoming_matches = self._fetch_upcoming_matches(sport, days_ahead)
            
            scheduled_count = 0
            
            for match_data in upcoming_matches:
                if self._create_match_if_not_exists(sport, match_data):
                    scheduled_count += 1
            
            logger.info(f"Scheduled {scheduled_count} new matches")
            return scheduled_count
            
        except Exception as e:
            logger.error(f"Error discovering matches: {e}")
            return 0
    
    def _fetch_upcoming_matches(self, sport: str, days_ahead: int) -> List[Dict]:
        """Fetch upcoming matches from scraper"""
        try:
            # Use scraper to get upcoming matches
            # This depends on your scraper implementation
            if sport == "cricket":
                from backend.scraper.cricket.cricbuzz_scraper import CricbuzzScraper
                scraper = CricbuzzScraper()
                # Get upcoming matches (you may need to implement this in scraper)
                matches = scraper.get_upcoming_matches(days_ahead) if hasattr(scraper, 'get_upcoming_matches') else []
                return matches
            return []
        except Exception as e:
            logger.error(f"Error fetching upcoming matches: {e}")
            return []
    
    def _create_match_if_not_exists(self, sport: str, match_data: Dict) -> bool:
        """Create match in Firebase if it doesn't exist"""
        try:
            tournament_id = match_data.get('tournament_id') or self._get_or_create_tournament(sport, match_data)
            match_id = match_data.get('match_id') or self._generate_match_id(match_data)
            
            # Check if match exists
            match_ref = self.firebase.db.document(
                f"tournaments/{sport}/{tournament_id}/matches/{match_id}"
            )
            
            if match_ref.get().exists:
                logger.debug(f"Match already exists: {match_id}")
                return False
            
            # Create match document
            match_doc = {
                'id': match_id,
                'tournament_id': tournament_id,
                'team1': match_data.get('team1'),
                'team2': match_data.get('team2'),
                'startTime': match_data.get('start_time', datetime.utcnow().isoformat()),
                'status': 'scheduled',
                'sport': sport,
                'format': match_data.get('format', 'T20'),
                'venue': match_data.get('venue'),
                'live_score': {},
                'predictionStatus': {
                    'firstInningsOpen': False,
                    'secondInningsOpen': False
                },
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            }
            
            match_ref.set(match_doc)
            logger.info(f"Created match: {match_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error creating match: {e}")
            return False
    
    def _get_or_create_tournament(self, sport: str, match_data: Dict) -> str:
        """Get or create tournament"""
        tournament_name = match_data.get('tournament', 'Default')
        
        # Check if tournament exists
        tournaments_ref = self.firebase.db.collection(f"tournaments/{sport}")
        query = tournaments_ref.where("name", "==", tournament_name).limit(1)
        docs = query.stream()
        
        for doc in docs:
            return doc.id
        
        # Create new tournament
        tournament_ref = tournaments_ref.document()
        tournament_ref.set({
            'name': tournament_name,
            'sport': sport,
            'created_at': datetime.utcnow().isoformat()
        })
        
        return tournament_ref.id
    
    def _generate_match_id(self, match_data: Dict) -> str:
        """Generate a unique match ID"""
        team1 = match_data.get('team1', 'unknown')
        team2 = match_data.get('team2', 'unknown')
        start_time = match_data.get('start_time', datetime.utcnow().isoformat())
        
        # Create ID like: team1_vs_team2_YYYYMMDD
        date_str = start_time.split('T')[0].replace('-', '')
        return f"{team1}_vs_{team2}_{date_str}".lower().replace(' ', '_')
