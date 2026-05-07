"""Match status manager with rules for status transitions"""
import logging
from typing import Dict, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

class MatchStatusManager:
    """Manages match status transitions based on rules"""
    
    # Prediction close overs
    FIRST_INNINGS_PREDICTION_CLOSE_OVERS = 3
    SECOND_INNINGS_PREDICTION_CLOSE_OVERS = 3
    
    def __init__(self, firebase_client):
        self.firebase = firebase_client
    
    def process_match_status(self, match: Dict) -> Dict:
        """
        Process match status based on current state and rules
        
        Returns updated fields for the match
        """
        sport = match.get('sport', 'cricket')
        status = match.get('status', 'scheduled')
        live_score = match.get('live_score', {})
        
        updates = {}
        
        if sport == 'cricket':
            updates = self._process_cricket_match(match, status, live_score)
        elif sport == 'football':
            updates = self._process_football_match(match, status, live_score)
        
        return updates
    
    def _process_cricket_match(self, match: Dict, status: str, live_score: Dict) -> Dict:
        """Process cricket match status"""
        updates = {}
        
        # Get innings info
        innings1 = live_score.get('innings1', {})
        innings2 = live_score.get('innings2', {})
        
        current_innings = live_score.get('currentInnings', 1)
        match_status_text = live_score.get('status', '').lower()
        
        # Check if match is completed based on scraper data
        if self._is_match_completed(match_status_text):
            updates['status'] = 'completed'
            updates['live_score.status'] = 'done'
            logger.info(f"Match {match.get('id')} marked as completed")
            return updates
        
        # Handle first innings
        if current_innings == 1 or (not innings2.get('runs') and innings1.get('runs')):
            updates.update(self._handle_first_innings(match, innings1))
        
        # Handle second innings
        elif current_innings == 2 or innings2.get('runs'):
            updates.update(self._handle_second_innings(match, innings1, innings2))
        
        return updates
    
    def _handle_first_innings(self, match: Dict, innings1: Dict) -> Dict:
        """Handle first innings rules"""
        updates = {}
        overs = self._parse_overs(innings1.get('overs', '0'))
        
        # Close predictions after 3 overs
        if overs >= self.FIRST_INNINGS_PREDICTION_CLOSE_OVERS:
            if match.get('predictionStatus', {}).get('firstInningsOpen', True):
                updates['predictionStatus.firstInningsOpen'] = False
                updates['predictionStatus.firstInningsClosedAt'] = datetime.utcnow().isoformat()
                logger.info(f"First innings predictions closed for match {match.get('id')}")
        
        # Check if first innings is done
        wickets = innings1.get('wickets', 0)
        if overs >= 19.6 or wickets >= 10:
            updates['status'] = 'first_innings_done'
            updates['predictionStatus.firstInningsOpen'] = False
            logger.info(f"First innings done for match {match.get('id')}")
        
        return updates
    
    def _handle_second_innings(self, match: Dict, innings1: Dict, innings2: Dict) -> Dict:
        """Handle second innings rules"""
        updates = {}
        overs = self._parse_overs(innings2.get('overs', '0'))
        
        # Allow early predictions for second innings
        if match.get('status') == 'first_innings_done':
            updates['status'] = 'second_innings_live'
            if not match.get('predictionStatus', {}).get('secondInningsOpen', False):
                updates['predictionStatus.secondInningsOpen'] = True
                updates['predictionStatus.secondInningsOpenedAt'] = datetime.utcnow().isoformat()
                logger.info(f"Second innings predictions opened for match {match.get('id')}")
        
        # Close predictions after 3 overs in second innings
        if overs >= self.SECOND_INNINGS_PREDICTION_CLOSE_OVERS:
            if match.get('predictionStatus', {}).get('secondInningsOpen', True):
                updates['predictionStatus.secondInningsOpen'] = False
                updates['predictionStatus.secondInningsClosedAt'] = datetime.utcnow().isoformat()
                logger.info(f"Second innings predictions closed for match {match.get('id')}")
        
        # Check if second innings is done (target reached or all out)
        target = innings1.get('runs', 0) + 1
        current_runs = innings2.get('runs', 0)
        wickets = innings2.get('wickets', 0)
        
        if current_runs >= target:
            updates['status'] = 'completed'
            updates['live_score.status'] = 'done'
            logger.info(f"Match {match.get('id')} completed - target reached")
        elif overs >= 19.6 or wickets >= 10:
            updates['status'] = 'completed'
            updates['live_score.status'] = 'done'
            logger.info(f"Match {match.get('id')} completed - innings complete")
        
        return updates
    
    def _process_football_match(self, match: Dict, status: str, live_score: Dict) -> Dict:
        """Process football match status"""
        updates = {}
        
        match_status_text = live_score.get('status', '').lower()
        
        # Check if match is completed
        if self._is_match_completed(match_status_text):
            updates['status'] = 'completed'
            logger.info(f"Football match {match.get('id')} marked as completed")
        
        return updates
    
    def _is_match_completed(self, status_text: str) -> bool:
        """Check if match is completed based on status text"""
        completed_keywords = [
            'won', 'complete', 'result', 'draw', 'tie',
            'match over', 'finished', 'ended', 'done'
        ]
        return any(keyword in status_text for keyword in completed_keywords)
    
    def _parse_overs(self, overs_str: str) -> float:
        """Parse overs string to float (e.g., '3.2' -> 3.333)"""
        try:
            if '.' in str(overs_str):
                parts = str(overs_str).split('.')
                return int(parts[0]) + int(parts[1]) / 6
            return float(overs_str)
        except:
            return 0.0
