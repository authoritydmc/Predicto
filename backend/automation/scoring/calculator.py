"""Score calculator with penalty calculation"""
import logging
from typing import Dict, List, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

class ScoreCalculator:
    """Calculates scores and penalties for predictions"""
    
    # Scoring constants
    EXACT_MATCH_POINTS = 200
    WITHIN_5_RUNS_BONUS = 20
    WITHIN_10_RUNS_BONUS = 10
    WITHIN_3_BALLS_BONUS = 20
    WITHIN_9_BALLS_BONUS = 10
    EXACT_BALLS_BONUS = 70
    
    def __init__(self, firebase_client):
        self.firebase = firebase_client
    
    def calculate_match_scores(self, sport: str, tournament_id: str, match_id: str) -> bool:
        """
        Calculate scores for all predictions in a match
        
        Returns: True if successful
        """
        try:
            # Get match data
            match = self._get_match(sport, tournament_id, match_id)
            if not match:
                return False
            
            if match.get('status') != 'completed':
                logger.info(f"Match {match_id} not completed, skipping score calculation")
                return False
            
            live_score = match.get('live_score', {})
            
            # Calculate innings scores
            innings1_result = self._calculate_innings1(match, live_score)
            innings2_result = self._calculate_innings2(match, live_score)
            
            # Apply penalties and finalize
            final_result = self._apply_penalties(match, innings1_result, innings2_result)
            
            # Save results
            self._save_results(sport, tournament_id, match_id, final_result)
            
            logger.info(f"Calculated scores for match {match_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error calculating match scores: {e}")
            return False
    
    def _calculate_innings1(self, match: Dict, live_score: Dict) -> Dict:
        """Calculate first innings scores"""
        innings1 = live_score.get('innings1', {})
        actual_runs = innings1.get('runs', 0)
        actual_wickets = innings1.get('wickets', 0)
        
        predictions = self._get_predictions(match, 'first_inn')
        results = {}
        
        for user_id, prediction in predictions.items():
            predicted_runs = prediction.get('runs', 0)
            predicted_wickets = prediction.get('wickets', 0)
            
            # Calculate base score
            runs_diff = abs(actual_runs - predicted_runs)
            score = max(0, 120 - (runs_diff * 1.2))
            
            # Bonuses
            if runs_diff == 0:
                score += self.EXACT_MATCH_POINTS
            elif runs_diff <= 5:
                score += self.WITHIN_5_RUNS_BONUS
            elif runs_diff <= 10:
                score += self.WITHIN_10_RUNS_BONUS
            
            results[user_id] = {
                'score': score,
                'predicted': predicted_runs,
                'actual': actual_runs,
                'diff': runs_diff
            }
        
        return {'results': results, 'total_runs': actual_runs}
    
    def _calculate_innings2(self, match: Dict, live_score: Dict) -> Dict:
        """Calculate second innings scores"""
        innings2 = live_score.get('innings2', {})
        actual_runs = innings2.get('runs', 0)
        actual_overs = innings2.get('overs', '0')
        
        predictions = self._get_predictions(match, 'second_inn')
        results = {}
        
        # Check if chasing
        innings1 = live_score.get('innings1', {})
        target = innings1.get('runs', 0) + 1
        is_chasing = actual_runs < target
        
        for user_id, prediction in predictions.items():
            if is_chasing:
                # Chaser wins - calculate based on balls remaining
                predicted_overs = prediction.get('overs', '0')
                actual_balls = self._overs_to_balls(actual_overs)
                predicted_balls = self._overs_to_balls(predicted_overs)
                balls_diff = abs(actual_balls - predicted_balls)
                
                score = max(0, 120 - (balls_diff * 1.8))
                
                if balls_diff == 0:
                    score += self.EXACT_BALLS_BONUS
                elif balls_diff <= 3:
                    score += self.WITHIN_3_BALLS_BONUS
                elif balls_diff <= 9:
                    score += self.WITHIN_9_BALLS_BONUS
            else:
                # Chaser loses - calculate based on runs
                predicted_runs = prediction.get('runs', 0)
                runs_diff = abs(actual_runs - predicted_runs)
                score = max(0, 120 - (runs_diff * 1.2))
                
                if runs_diff == 0:
                    score += self.EXACT_MATCH_POINTS
                elif runs_diff <= 5:
                    score += self.WITHIN_5_RUNS_BONUS
                elif runs_diff <= 10:
                    score += self.WITHIN_10_RUNS_BONUS
            
            results[user_id] = {
                'score': score,
                'predicted': predicted_runs if not is_chasing else predicted_overs,
                'actual': actual_runs if not is_chasing else actual_overs,
                'diff': runs_diff if not is_chasing else balls_diff
            }
        
        return {'results': results}
    
    def _apply_penalties(self, match: Dict, innings1_result: Dict, innings2_result: Dict) -> Dict:
        """Apply penalties and calculate final scores"""
        final_results = {}
        
        # Get all user IDs
        all_users = set(innings1_result['results'].keys()) | set(innings2_result['results'].keys())
        
        for user_id in all_users:
            p1 = innings1_result['results'].get(user_id, {}).get('score', 0)
            p2 = innings2_result['results'].get(user_id, {}).get('score', 0)
            
            # Calculate penalty
            penalty = self._calculate_penalty(match, user_id)
            
            total = max(0, p1 + p2 - penalty)
            
            final_results[user_id] = {
                'p1Score': p1,
                'p2Score': p2,
                'penalty': penalty,
                'total': total,
                'innings1': innings1_result['results'].get(user_id, {}),
                'innings2': innings2_result['results'].get(user_id, {})
            }
        
        return final_results
    
    def _calculate_penalty(self, match: Dict, user_id: str) -> float:
        """Calculate penalty for a user"""
        penalty = 0.0
        
        predictions = match.get('predictions', {})
        user_pred = predictions.get(user_id, {})
        
        # Penalty for not predicting one innings
        if not user_pred.get('first_inn') and not user_pred.get('early_predict'):
            penalty += 50  # No first innings prediction
        if not user_pred.get('second_inn') and match.get('status') == 'completed':
            penalty += 50  # No second innings prediction
        
        return penalty
    
    def _get_match(self, sport: str, tournament_id: str, match_id: str) -> Optional[Dict]:
        """Get match data from Firebase"""
        try:
            doc = self.firebase.db.document(
                f"tournaments/{sport}/{tournament_id}/matches/{match_id}"
            ).get()
            return doc.to_dict() if doc.exists else None
        except Exception as e:
            logger.error(f"Error getting match: {e}")
            return None
    
    def _get_predictions(self, match: Dict, innings_type: str) -> Dict:
        """Get predictions for an innings"""
        predictions = match.get('predictions', {})
        
        if innings_type == 'first_inn':
            # Check both old and new format
            for user_id, pred in predictions.items():
                if pred.get('first_inn'):
                    return {user_id: pred['first_inn']}
                elif pred.get('early_predict'):
                    return {user_id: pred['early_predict']}
            return {}
        else:
            # second_inn
            results = {}
            for user_id, pred in predictions.items():
                if pred.get('second_inn'):
                    results[user_id] = pred['second_inn']
            return results
    
    def _overs_to_balls(self, overs_str: str) -> int:
        """Convert overs to balls"""
        try:
            if '.' in str(overs_str):
                parts = str(overs_str).split('.')
                return int(parts[0]) * 6 + int(parts[1])
            return int(float(overs_str)) * 6
        except:
            return 0
    
    def _save_results(self, sport: str, tournament_id: str, match_id: str, results: Dict):
        """Save calculation results to Firebase"""
        try:
            match_ref = self.firebase.db.document(
                f"tournaments/{sport}/{tournament_id}/matches/{match_id}"
            )
            
            # Save to subcollection
            for user_id, result in results.items():
                match_ref.collection('results').document(user_id).set({
                    **result,
                    'calculated_at': datetime.utcnow().isoformat()
                })
            
            # Mark as calculated
            match_ref.update({
                'score_calculated': True,
                'score_calculated_at': datetime.utcnow().isoformat()
            })
            
        except Exception as e:
            logger.error(f"Error saving results: {e}")
