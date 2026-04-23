"""
Prediction fetcher for retrieving unreconciled predictions from Firebase
"""

from typing import Dict, Any, List, Optional
from .firebase_client import FirebaseClient


class PredictionFetcher:
    """Fetches predictions from Firebase for processing"""
    
    def __init__(self, firebase_client: FirebaseClient):
        """
        Initialize prediction fetcher
        
        Args:
            firebase_client: Firebase client instance
        """
        self.client = firebase_client
    
    def get_unreconciled_predictions(self, sport: str, tournament_id: str, match_id: str) -> List[Dict[str, Any]]:
        """
        Get all unreconciled predictions for a match
        
        Args:
            sport: Sport type (cricket, football)
            tournament_id: Tournament ID
            match_id: Match ID
            
        Returns:
            List of unreconciled predictions
        """
        path = f"{sport}/{tournament_id}/matches/{match_id}/predictions"
        data = self.client.get(path)
        
        if not data:
            return []
        
        unreconciled = []
        
        # Handle both array structure and legacy object structure
        for username, user_data in data.items():
            if isinstance(user_data, dict) and 'predictions' in user_data:
                # New array structure
                for prediction in user_data['predictions']:
                    if not prediction.get('reconciled', False):
                        unreconciled.append({
                            'username': username,
                            'userId': user_data.get('userId'),
                            **prediction
                        })
            elif isinstance(user_data, dict) and not user_data.get('reconciled', False):
                # Legacy structure
                unreconciled.append({
                    'username': username,
                    'userId': user_data.get('userId'),
                    **user_data
                })
        
        return unreconciled
    
    def get_match_meta(self, sport: str, tournament_id: str, match_id: str) -> Optional[Dict[str, Any]]:
        """
        Get match metadata
        
        Args:
            sport: Sport type
            tournament_id: Tournament ID
            match_id: Match ID
            
        Returns:
            Match metadata dict or None
        """
        path = f"{sport}/{tournament_id}/matches/{match_id}/meta"
        return self.client.get(path)
    
    def get_live_score(self, sport: str, tournament_id: str, match_id: str) -> Optional[Dict[str, Any]]:
        """
        Get live score data
        
        Args:
            sport: Sport type
            tournament_id: Tournament ID
            match_id: Match ID
            
        Returns:
            Live score dict or None
        """
        path = f"{sport}/{tournament_id}/matches/{match_id}/live_score"
        return self.client.get(path)
    
    def get_innings_history(self, sport: str, tournament_id: str, match_id: str, innings: str) -> Optional[Dict[str, Any]]:
        """
        Get innings history
        
        Args:
            sport: Sport type
            tournament_id: Tournament ID
            match_id: Match ID
            innings: '1st' or '2nd'
            
        Returns:
            Innings history dict or None
        """
        path = f"{sport}/{tournament_id}/matches/{match_id}/innings_history/{innings}"
        return self.client.get(path)
