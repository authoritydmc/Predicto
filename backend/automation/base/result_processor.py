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
    
    def process_match(self, sport: str, tournament_id: str, match_id: str, innings: str = 'both', force: bool = False) -> Dict[str, Any]:
        """
        Process a match: calculate scores and update predictions
        
        Args:
            sport: Sport type
            tournament_id: Tournament ID
            match_id: Match ID
            innings: Which innings to process ('1', '2', or 'both')
            force: Force reprocessing even if already reconciled
            
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
        if innings == 'both' and meta.get('reconciled', False) and not force:
            return {'success': True, 'message': 'Match already reconciled', 'processed': 0}
        
        # Get unreconciled predictions
        predictions = fetcher.get_unreconciled_predictions(sport, tournament_id, match_id)
        if not predictions:
            return {'success': True, 'message': 'No unreconciled predictions', 'processed': 0}
        
        # Get innings history
        h1 = fetcher.get_innings_history(sport, tournament_id, match_id, '1st') or {}
        h2 = fetcher.get_innings_history(sport, tournament_id, match_id, '2nd') or {}
        
        print(f"[ResultProcessor] Processing {len(predictions)} predictions for innings: {innings}")
        
        processed_count = 0
        for prediction in predictions:
            username = prediction.get('username', 'unknown')
            print(f"[ResultProcessor] -----------------------------------------------------------")
            print(f"[ResultProcessor] Processing prediction for: {username}")
            print(f"[ResultProcessor] Prediction ID: {prediction.get('predictionId', 'N/A')}")
            try:
                self._process_prediction(
                    prediction, sport, tournament_id, match_id, meta, h1, h2, innings
                )
                processed_count += 1
                print(f"[ResultProcessor] Successfully processed prediction for {username}")
            except Exception as e:
                print(f"[ResultProcessor] Error processing prediction for {username}: {e}")
                import traceback
                traceback.print_exc()
        
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
            print(f"[ResultProcessor] Calculating 1st innings points...")
            p1_result = self._calculate_innings1(prediction, meta, h1)
            if p1_result:
                print(f"[ResultProcessor] 1st innings result: {p1_result.get('points', 0)} points (diff: {p1_result.get('diff', 'N/A')}, mode: {p1_result.get('mode', 'N/A')})")
        
        # Calculate 2nd innings points if processing 2nd innings or both
        p2_result = None
        if innings in ['2', 'both']:
            if h2 or meta.get('actual2ndInningsResult'):
                actual_winner = self._determine_winner(meta, h2)
                actual_result = self._extract_actual_result(meta, h2)
                is_overs = meta.get('isOversFormat', False)
                print(f"[ResultProcessor] Calculating 2nd innings points (winner: {actual_winner}, result: {actual_result}, overs: {is_overs})...")
                if actual_winner and actual_result:
                    p2_result = self._calculate_innings2(prediction, actual_winner, actual_result, meta, is_overs)
                    if p2_result:
                        print(f"[ResultProcessor] 2nd innings result: {p2_result.get('points', 0)} points (diff: {p2_result.get('diff', 'N/A')}, mode: {p2_result.get('mode', 'N/A')})")
        
        # Calculate penalty for each innings processing
        penalty_result = {'total': 0, 'breakdown': {}, 'applied': []}
        
        # Get existing applied penalties from prediction
        existing_penalties = prediction.get('appliedPenalties', {})
        if existing_penalties:
            print(f"[ResultProcessor] Existing penalties: {existing_penalties}")
        
        # Convert placeholder values (true) to actual points from config
        from cricket.cricket_config import CRICKET_CONFIG
        penalty_config = CRICKET_CONFIG['penalty']
        
        # Resolve placeholder values to actual points
        resolved_penalties = {}
        for penalty_type, value in existing_penalties.items():
            if value is True:
                # Frontend placeholder - use config value
                resolved_penalties[penalty_type] = penalty_config.get(penalty_type, 0)
            else:
                # Already has actual value
                resolved_penalties[penalty_type] = value
        
        # Calculate penalties based on innings being processed
        if innings in ['1', 'both']:
            # Calculate 1st innings penalties
            penalty_1st = self.calculator.calculate_penalty(prediction, resolved_penalties)
            # Merge new penalties
            for penalty_type, value in penalty_1st['breakdown'].items():
                if penalty_type not in resolved_penalties:
                    penalty_result['breakdown'][penalty_type] = value
                    penalty_result['applied'].append(penalty_type)
                    penalty_result['total'] += value
        
        if innings in ['2', 'both']:
            # Calculate 2nd innings penalties
            penalty_2nd = self.calculator.calculate_penalty(prediction, resolved_penalties)
            # Merge new penalties
            for penalty_type, value in penalty_2nd['breakdown'].items():
                if penalty_type not in resolved_penalties:
                    penalty_result['breakdown'][penalty_type] = value
                    penalty_result['applied'].append(penalty_type)
                    penalty_result['total'] += value
        
        # Update existing penalties with newly applied ones (using actual points)
        updated_penalties = {**resolved_penalties}
        for penalty_type in penalty_result['applied']:
            updated_penalties[penalty_type] = penalty_result['breakdown'][penalty_type]
        
        if penalty_result['applied']:
            print(f"[ResultProcessor] New penalties applied: {penalty_result['applied']}")
            print(f"[ResultProcessor] Penalty breakdown: {penalty_result['breakdown']}")
            print(f"[ResultProcessor] Total penalty: {penalty_result['total']}")
        
        # Calculate total score
        total = 0
        if p1_result:
            total += p1_result.get('points', 0)
        if p2_result:
            total += p2_result.get('points', 0)
        total += penalty_result['total']
        total = max(0, total)  # Ensure final score cannot go below 0
        
        print(f"[ResultProcessor] Final score calculation:")
        print(f"[ResultProcessor]   1st innings: {p1_result.get('points', 0) if p1_result else 0}")
        print(f"[ResultProcessor]   2nd innings: {p2_result.get('points', 0) if p2_result else 0}")
        print(f"[ResultProcessor]   Penalties: {penalty_result['total']}")
        print(f"[ResultProcessor]   Total: {total}")
        
        # Update prediction in Firebase
        self._update_prediction_reconciliation(
            sport, tournament_id, match_id, username, prediction_id,
            total, penalty_result, updated_penalties, p1_result, p2_result, innings
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
                                         penalty_result: Dict[str, Any], updated_penalties: Dict[str, Any],
                                         p1_result: Dict[str, Any], p2_result: Dict[str, Any], innings: str = 'both') -> bool:
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
                    data['penaltyScore'] = penalty_result['total']
                    data['penaltyBreakdown'] = penalty_result['breakdown']
                    data['appliedPenalties'] = updated_penalties
            
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
                    data['predictions'][i]['penaltyScore'] = penalty_result['total']
                    data['predictions'][i]['penaltyBreakdown'] = penalty_result['breakdown']
                    data['predictions'][i]['appliedPenalties'] = updated_penalties
                    
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
