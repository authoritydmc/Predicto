"""
Leaderboard updater for tournament scoreboards
"""

from typing import Dict, Any, List, Optional
from .firebase_client import FirebaseClient


class LeaderboardUpdater:
    """Updates tournament leaderboards with aggregated scores"""
    
    def __init__(self, firebase_client: FirebaseClient):
        """
        Initialize leaderboard updater
        
        Args:
            firebase_client: Firebase client instance
        """
        self.client = firebase_client
    
    def update_tournament_leaderboard(self, sport: str, tournament_id: str) -> Dict[str, Any]:
        """
        Update tournament leaderboard by aggregating scores from all matches
        
        Args:
            sport: Sport type
            tournament_id: Tournament ID
            
        Returns:
            Update result summary
        """
        # Get all matches in tournament
        matches_path = f"{sport}/{tournament_id}/matches"
        matches_data = self.client.get(matches_path)
        
        if not matches_data:
            return {'success': False, 'error': 'No matches found in tournament'}
        
        # Aggregate scores across all matches
        user_scores = {}
        
        for match_id, match_data in matches_data.items():
            if not isinstance(match_data, dict):
                continue
            
            predictions_path = f"{sport}/{tournament_id}/matches/{match_id}/predictions"
            predictions = self.client.get(predictions_path)
            
            if not predictions:
                continue
            
            for username, user_data in predictions.items():
                if isinstance(user_data, dict) and 'predictions' in user_data:
                    # Array structure (standard predictions)
                    for prediction in user_data['predictions']:
                        if prediction.get('reconciled', False):
                            self._add_score(user_scores, username, prediction)
                elif isinstance(user_data, dict) and 'second_inn' in user_data:
                    # Nested second_inn structure (live 2nd innings predictions)
                    if user_data.get('reconciled', False):
                        self._add_score(user_scores, username, user_data)
        
        # Convert to sorted leaderboard
        leaderboard = self._create_leaderboard(user_scores)
        
        # Update Firebase
        leaderboard_path = f"{sport}/{tournament_id}/leaderboard"
        success = self.client.set(leaderboard_path, {
            'rankings': leaderboard,
            'updatedAt': self.client.get_timestamp(),
            'totalParticipants': len(leaderboard)
        })
        
        if success:
            return {
                'success': True,
                'updated': len(leaderboard),
                'leaderboard': leaderboard
            }
        else:
            return {'success': False, 'error': 'Failed to update leaderboard'}
    
    def _add_score(self, user_scores: Dict[str, Dict[str, Any]], username: str, prediction: Dict[str, Any]):
        """Add prediction score to user aggregate"""
        if username not in user_scores:
            user_scores[username] = {
                'username': username,
                'totalScore': 0,
                'matchesPlayed': 0,
                'penalties': 0
            }
        
        user_scores[username]['totalScore'] += prediction.get('score', 0)
        user_scores[username]['penalties'] += prediction.get('penaltyScore', 0)
        user_scores[username]['matchesPlayed'] += 1
    
    def _create_leaderboard(self, user_scores: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Create sorted leaderboard from user scores"""
        leaderboard = []
        
        for username, data in user_scores.items():
            leaderboard.append({
                'rank': 0,  # Will be set after sorting
                'username': username,
                'totalScore': data['totalScore'],
                'matchesPlayed': data['matchesPlayed'],
                'penalties': data['penalties'],
                'averageScore': data['totalScore'] / data['matchesPlayed'] if data['matchesPlayed'] > 0 else 0
            })
        
        # Sort by total score descending
        leaderboard.sort(key=lambda x: x['totalScore'], reverse=True)
        
        # Set ranks
        for i, entry in enumerate(leaderboard):
            entry['rank'] = i + 1
        
        return leaderboard
    
    def get_leaderboard(self, sport: str, tournament_id: str) -> Optional[Dict[str, Any]]:
        """
        Get current tournament leaderboard
        
        Args:
            sport: Sport type
            tournament_id: Tournament ID
            
        Returns:
            Leaderboard data or None
        """
        path = f"{sport}/{tournament_id}/leaderboard"
        return self.client.get(path)
