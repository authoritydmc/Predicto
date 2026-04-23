"""
Result processor for calculating scores and updating predictions
"""

from typing import Dict, Any, List
from .firebase_client import FirebaseClient
from .score_calculator import ScoreCalculator


class ResultProcessor:
    """Processes match results and calculates scores"""
    
    def __init__(self, firebase_client: FirebaseClient, calculator: ScoreCalculator, db_root: str = 'prod'):
        """
        Initialize result processor
        
        Args:
            firebase_client: Firebase client instance
            calculator: Sport-specific score calculator
            db_root: Database root ('local' or 'prod')
        """
        self.client = firebase_client
        self.calculator = calculator
        self.db_root = db_root
    
    def process_match(self, sport: str, tournament_id: str, match_id: str, innings: str = 'both') -> Dict[str, Any]:
        """
        Process a match: calculate scores and update predictions
        
        Args:
            sport: Sport type
            tournament_id: Tournament ID
            match_id: Match ID
            innings: Which innings to process ('1', '2', or 'both')
            
        Returns:
            Processing result summary
        """
        from .prediction_fetcher import PredictionFetcher
        
        fetcher = PredictionFetcher(self.client, self.db_root)
        
        # Get match metadata
        meta = fetcher.get_match_meta(sport, tournament_id, match_id)
        if not meta:
            return {'success': False, 'error': 'Match meta not found'}
        
        # For partial innings processing, don't check reconciled status
        # Only check for full match processing
        if innings == 'both' and meta.get('reconciled', False):
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
                    prediction, sport, tournament_id, match_id, meta, h1, h2, innings
                )
                processed_count += 1
            except Exception as e:
                print(f"[ResultProcessor] Error processing prediction for {prediction.get('username')}: {e}")
        
        # Only mark match as reconciled on full processing
        if innings == 'both':
            self.client.update(
                f"{self.db_root}/tournaments/{sport}/{tournament_id}/matches/{match_id}/meta",
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
                          h1: Dict[str, Any], h2: Dict[str, Any], innings: str = 'both') -> bool:
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
            innings: Which innings to process ('1', '2', or 'both')
            
        Returns:
            True if successful
        """
        username = prediction.get('username')
        prediction_id = prediction.get('predictionId')
        
        if not username or not prediction_id:
            return False
        
        # Calculate 1st innings points if processing 1st innings or both
        p1_result = None
        if innings in ['1', 'both']:
            p1_result = self._calculate_innings1(prediction, meta, h1)
        
        # Calculate 2nd innings points if processing 2nd innings or both
        p2_result = None
        if innings in ['2', 'both']:
            if h2 or meta.get('actual2ndInningsResult'):
                actual_winner = self._determine_winner(meta, h2)
                actual_result = self._extract_actual_result(meta, h2)
                is_overs = meta.get('isOversFormat', False)
                if actual_winner and actual_result:
                    p2_result = self._calculate_innings2(prediction, actual_winner, actual_result, meta, is_overs)
        
        # Calculate penalty only on full processing
        penalty = 0
        if innings == 'both' and p1_result and p2_result:
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
            total, penalty, p1_result, p2_result, innings
        )
        
        return True
    
    def _calculate_innings1(self, prediction: Dict[str, Any], meta: Dict[str, Any], 
                           h1: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate 1st innings points"""
        # Extract actual score from meta (saved by ControlPanel) first
        actual_score = meta.get('actual1stInningsScore')
        
        # Fallback to history if not in meta
        if not actual_score and h1:
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
        # First try to get from meta (saved by ControlPanel)
        actual_winner = meta.get('actualWinner')
        if actual_winner:
            return actual_winner
        
        # Fallback to history if not in meta
        if h2:
            first_entry = next(iter(h2.values()), {})
            return first_entry.get('actualWinner', '')
        
        return ''
    
    def _extract_actual_result(self, meta: Dict[str, Any], h2: Dict[str, Any]) -> str:
        """Extract actual 2nd innings result"""
        # First try to get from meta (saved by ControlPanel)
        actual_result = meta.get('actual2ndInningsResult')
        if actual_result:
            return str(actual_result)
        
        # Fallback to history if not in meta
        if h2:
            first_entry = next(iter(h2.values()), {})
            return first_entry.get('actualResult', '')
        
        return ''
    
    def _update_prediction_reconciliation(self, sport: str, tournament_id: str, match_id: str,
                                         username: str, prediction_id: int, total: int,
                                         penalty: int, p1_result: Dict[str, Any],
                                         p2_result: Dict[str, Any], innings: str = 'both') -> bool:
        """Update prediction with reconciliation data"""
        path = f"{self.db_root}/tournaments/{sport}/{tournament_id}/matches/{match_id}/predictions/{username}"
        data = self.client.get(path)
        
        if not data:
            return False
        
        # Handle nested second_inn structure (live 2nd innings predictions)
        if isinstance(data, dict) and 'second_inn' in data:
            # Update second_inn prediction for 2nd innings
            if innings in ['2', 'both'] and p2_result:
                data['second_inn']['reconciled'] = innings == 'both'
                data['second_inn']['score'] = p2_result.get('points', 0)
                data['second_inn']['updatedAt'] = self.client.get_timestamp()
            
            # For 1st innings, update top-level
            if innings in ['1', 'both'] and p1_result:
                data['p1Result'] = p1_result
                if innings == 'both':
                    data['reconciled'] = True
                    data['reconciledAt'] = self.client.get_timestamp()
                    data['score'] = total
                    data['penaltyScore'] = penalty
            
            return self.client.update(path, {
                'updatedAt': self.client.get_timestamp()
            })
        
        # Handle array structure (standard predictions)
        if isinstance(data, dict) and 'predictions' in data:
            for i, pred in enumerate(data['predictions']):
                if pred.get('predictionId') == prediction_id:
                    # Only mark as reconciled on full processing
                    if innings == 'both':
                        data['predictions'][i]['reconciled'] = True
                        data['predictions'][i]['reconciledAt'] = self.client.get_timestamp()
                    
                    # Update score and results
                    data['predictions'][i]['score'] = total
                    data['predictions'][i]['penaltyScore'] = penalty
                    
                    # Update innings-specific results
                    if p1_result:
                        data['predictions'][i]['p1Result'] = p1_result
                    if p2_result:
                        data['predictions'][i]['p2Result'] = p2_result
                    
                    # Track which innings were processed
                    if 'processedInnings' not in data['predictions'][i]:
                        data['predictions'][i]['processedInnings'] = []
                    if innings == '1' and '1' not in data['predictions'][i]['processedInnings']:
                        data['predictions'][i]['processedInnings'].append('1')
                    if innings == '2' and '2' not in data['predictions'][i]['processedInnings']:
                        data['predictions'][i]['processedInnings'].append('2')
                    if innings == 'both':
                        data['predictions'][i]['processedInnings'] = ['1', '2']
                    
                    break
            
            return self.client.update(path, {
                'predictions': data['predictions'],
                'updatedAt': self.client.get_timestamp()
            })
        
        return False
