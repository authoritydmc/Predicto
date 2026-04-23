"""
Result processor for calculating scores and updating predictions
"""

from typing import Dict, Any, List
from .firebase_client import FirebaseClient
from .score_calculator import ScoreCalculator


class ResultProcessor:
    """Processes match results and calculates scores"""
    
    def __init__(self, firebase_client: FirebaseClient, calculator: ScoreCalculator):
        """
        Initialize result processor
        
        Args:
            firebase_client: Firebase client instance
            calculator: Sport-specific score calculator
        """
        self.client = firebase_client
        self.calculator = calculator
    
    def process_match(self, sport: str, tournament_id: str, match_id: str) -> Dict[str, Any]:
        """
        Process a match: calculate scores and update predictions
        
        Args:
            sport: Sport type
            tournament_id: Tournament ID
            match_id: Match ID
            
        Returns:
            Processing result summary
        """
        from .prediction_fetcher import PredictionFetcher
        
        fetcher = PredictionFetcher(self.client)
        
        # Get match metadata
        meta = fetcher.get_match_meta(sport, tournament_id, match_id)
        if not meta:
            return {'success': False, 'error': 'Match meta not found'}
        
        # Check if already reconciled
        if meta.get('reconciled', False):
            return {'success': True, 'message': 'Match already reconciled', 'processed': 0}
        
        # Get unreconciled predictions
        predictions = fetcher.get_unreconciled_predictions(sport, tournament_id, match_id)
        if not predictions:
            return {'success': True, 'message': 'No unreconciled predictions', 'processed': 0}
        
        # Get innings history
        h1 = fetcher.get_innings_history(sport, tournament_id, match_id, '1st') or {}
        h2 = fetcher.get_innings_history(sport, tournament_id, match_id, '2nd') or {}
        
        # Process each prediction
        processed_count = 0
        for prediction in predictions:
            try:
                self._process_prediction(
                    prediction, sport, tournament_id, match_id, meta, h1, h2
                )
                processed_count += 1
            except Exception as e:
                print(f"[ResultProcessor] Error processing prediction for {prediction.get('username')}: {e}")
        
        # Mark match as reconciled
        self.client.update(
            f"{sport}/{tournament_id}/matches/{match_id}/meta",
            {
                'reconciled': True,
                'reconciledAt': self.client.get_timestamp(),
                'reconciledBy': 'scheduler'
            }
        )
        
        return {
            'success': True,
            'processed': processed_count,
            'total': len(predictions)
        }
    
    def _process_prediction(self, prediction: Dict[str, Any], sport: str, 
                          tournament_id: str, match_id: str, meta: Dict[str, Any],
                          h1: Dict[str, Any], h2: Dict[str, Any]) -> bool:
        """
        Process a single prediction
        
        Args:
            prediction: Prediction data
            sport: Sport type
            tournament_id: Tournament ID
            match_id: Match ID
            meta: Match metadata
            h1: 1st innings history
            h2: 2nd innings history
            
        Returns:
            True if successful
        """
        username = prediction.get('username')
        prediction_id = prediction.get('predictionId')
        
        if not username or not prediction_id:
            return False
        
        # Calculate 1st innings points
        p1_result = self._calculate_innings1(prediction, meta, h1)
        
        # Calculate 2nd innings points if available
        p2_result = None
        if h2:
            actual_winner = meta.get('actualWinner') or self._determine_winner(meta, h2)
            actual_result = meta.get('actual2ndInningsResult') or self._extract_actual_result(h2)
            is_overs = meta.get('isOversFormat', False)
            p2_result = self._calculate_innings2(prediction, actual_winner, actual_result, meta, is_overs)
        
        # Calculate penalty
        penalty = 0
        if p1_result and p2_result:
            penalty = self.calculator.calculate_penalty(prediction, prediction)
        
        # Calculate total score
        total = 0
        if p1_result:
            total += p1_result.get('points', 0)
        if p2_result:
            total += p2_result.get('points', 0)
        total += penalty
        total = max(0, total)  # Ensure non-negative
        
        # Update prediction in Firebase
        self._update_prediction_reconciliation(
            sport, tournament_id, match_id, username, prediction_id,
            total, penalty, p1_result, p2_result
        )
        
        return True
    
    def _calculate_innings1(self, prediction: Dict[str, Any], meta: Dict[str, Any], 
                           h1: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate 1st innings points"""
        # Extract actual score from history or meta
        actual_score = meta.get('actual1stInningsScore')
        if not actual_score and h1:
            # Try to get from first entry in history
            first_entry = next(iter(h1.values()), {})
            actual_score = first_entry.get('actualScore')
        
        if not actual_score:
            return {}
        
        return self.calculator.calculate_innings1_points(prediction, actual_score, meta)
    
    def _calculate_innings2(self, prediction: Dict[str, Any], actual_winner: str,
                           actual_result: str, meta: Dict[str, Any], is_overs: bool) -> Dict[str, Any]:
        """Calculate 2nd innings points"""
        if not actual_winner or not actual_result:
            return {}
        
        return self.calculator.calculate_innings2_points(
            prediction, actual_winner, actual_result, meta, is_overs
        )
    
    def _determine_winner(self, meta: Dict[str, Any], h2: Dict[str, Any]) -> str:
        """Determine actual winner from match data"""
        # This is a simplified version - implement based on your data structure
        return meta.get('actualWinner', '')
    
    def _extract_actual_result(self, h2: Dict[str, Any]) -> str:
        """Extract actual 2nd innings result"""
        # This is a simplified version - implement based on your data structure
        first_entry = next(iter(h2.values()), {})
        return first_entry.get('actualResult', '')
    
    def _update_prediction_reconciliation(self, sport: str, tournament_id: str, match_id: str,
                                         username: str, prediction_id: int, total: int,
                                         penalty: int, p1_result: Dict[str, Any],
                                         p2_result: Dict[str, Any]) -> bool:
        """Update prediction with reconciliation data"""
        # For array structure, we need to find and update the specific prediction
        path = f"{sport}/{tournament_id}/matches/{match_id}/predictions/{username}"
        data = self.client.get(path)
        
        if not data:
            return False
        
        if isinstance(data, dict) and 'predictions' in data:
            # Array structure - find and update
            for i, pred in enumerate(data['predictions']):
                if pred.get('predictionId') == prediction_id:
                    data['predictions'][i]['reconciled'] = True
                    data['predictions'][i]['reconciledAt'] = self.client.get_timestamp()
                    data['predictions'][i]['score'] = total
                    data['predictions'][i]['penaltyScore'] = penalty
                    data['predictions'][i]['p1Result'] = p1_result
                    data['predictions'][i]['p2Result'] = p2_result
                    break
            
            return self.client.update(path, {
                'predictions': data['predictions'],
                'updatedAt': self.client.get_timestamp()
            })
        else:
            # Legacy structure
            return self.client.update(path, {
                'reconciled': True,
                'reconciledAt': self.client.get_timestamp(),
                'score': total,
                'penaltyScore': penalty
            })
