"""
Leaderboard updater for tournament scoreboards
"""

from typing import Dict, Any, List, Optional
from .firebase_client import FirebaseClient


class LeaderboardUpdater:
    """Updates tournament leaderboards with aggregated scores"""
    
    def __init__(self, firebase_client: FirebaseClient, db_root: str = 'prod'):
        """
        Initialize leaderboard updater
        
        Args:
            firebase_client: Firebase client instance
            db_root: Database root ('local' or 'prod')
        """
        self.client = firebase_client
        self.db_root = db_root
    
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
        matches_path = f"{self.db_root}/tournaments/{sport}/{tournament_id}/matches"
        matches_data = self.client.get(matches_path)
        
        if not matches_data:
            return {'success': False, 'error': 'No matches found in tournament'}
        
        # Aggregate scores across all matches
        user_scores = {}
        
        print(f"[LeaderboardUpdater] Processing {len(matches_data)} matches for leaderboard")
        
        for match_id, match_data in matches_data.items():
            if not isinstance(match_data, dict):
                continue
            
            predictions_path = f"{self.db_root}/tournaments/{sport}/{tournament_id}/matches/{match_id}/predictions"
            predictions = self.client.get(predictions_path)
            
            if not predictions:
                continue
            
            print(f"[LeaderboardUpdater] Processing match {match_id}: {len(predictions)} predictions")
            
            for username, user_data in predictions.items():
                print(f"[LeaderboardUpdater] Checking user {username}: {list(user_data.keys())}")
                if isinstance(user_data, dict) and 'predictions' in user_data:
                    # Array structure (standard predictions)
                    for prediction in user_data['predictions']:
                        if prediction.get('reconciled', False):
                            score = prediction.get('score', 0)
                            self._add_score(user_scores, username, prediction)
                            print(f"[LeaderboardUpdater]   {username}: +{score} points (from {match_id})")
                elif isinstance(user_data, dict) and 'second_inn' in user_data:
                    # Nested second_inn structure (live 2nd innings predictions)
                    second_inn = user_data['second_inn']
                    print(f"[LeaderboardUpdater]   Found second_inn for {username}: reconciled={second_inn.get('reconciled')}, score={second_inn.get('score')}")
                    if isinstance(second_inn, dict) and second_inn.get('reconciled', True):
                        score = second_inn.get('score', 0)
                        self._add_score(user_scores, username, second_inn)
                        print(f"[LeaderboardUpdater]   {username}: +{score} points (from {match_id}, 2nd innings)")
                elif isinstance(user_data, dict) and 'first_inn' in user_data:
                    # Nested first_inn structure (live 1st innings predictions)
                    first_inn = user_data['first_inn']
                    if isinstance(first_inn, dict) and first_inn.get('reconciled', True):
                        score = first_inn.get('score', 0)
                        self._add_score(user_scores, username, first_inn)
                        print(f"[LeaderboardUpdater]   {username}: +{score} points (from {match_id}, 1st innings)")
                elif isinstance(user_data, dict) and 'early_predict' in user_data:
                    # Early predictions structure
                    early = user_data['early_predict']
                    if isinstance(early, dict):
                        if 'first' in early and isinstance(early['first'], dict) and early['first'].get('reconciled', True):
                            score = early['first'].get('score', 0)
                            self._add_score(user_scores, username, early['first'])
                            print(f"[LeaderboardUpdater]   {username}: +{score} points (from {match_id}, early 1st innings)")
                        if 'second' in early and isinstance(early['second'], dict) and early['second'].get('reconciled', True):
                            score = early['second'].get('score', 0)
                            self._add_score(user_scores, username, early['second'])
                            print(f"[LeaderboardUpdater]   {username}: +{score} points (from {match_id}, early 2nd innings)")
        
        # Convert to sorted leaderboard
        leaderboard = self._create_leaderboard(user_scores)
        
        # Update Firebase with per-user structure
        leaderboard_path = f"{self.db_root}/tournaments/{sport}/{tournament_id}/leaderboard"
        
        # Clear existing leaderboard and set new per-user entries
        self.client.update(leaderboard_path, {})
        
        for entry in leaderboard:
            user_path = f"{leaderboard_path}/{entry['username']}"
            self.client.set(user_path, {
                'rank': entry['rank'],
                'username': entry['username'],
                'totalScore': entry['totalScore'],
                'matchesPlayed': entry['matchesPlayed'],
                'penalties': entry['penalties'],
                'averageScore': entry['averageScore']
            })
        
        # Set metadata separately at _meta path
        meta_path = f"{self.db_root}/tournaments/{sport}/{tournament_id}/leaderboard/_meta"
        self.client.set(meta_path, {
            'updatedAt': self.client.get_timestamp(),
            'totalParticipants': len(leaderboard)
        })
        
        return {
            'success': True,
            'updated': len(leaderboard),
            'leaderboard': leaderboard
        }
    
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
