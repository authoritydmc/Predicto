"""
Cricket-specific score calculator
Implements cricket scoring rules
"""

from typing import Dict, Any
from base.score_calculator import ScoreCalculator
from cricket.cricket_config import CRICKET_CONFIG, overs_to_balls, balls_to_overs_display


class CricketCalculator(ScoreCalculator):
    """Cricket score calculator implementing cricket-specific scoring rules"""
    
    def calculate_innings1_points(self, prediction: Dict[str, Any], actual_score: int, 
                                  meta: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculate points for 1st innings prediction
        
        Scoring rules:
        - Exact match: 200 points
        - Base: 120 - (diff * 1.2)
        - Within 5 runs: +20 points
        - Within 10 runs: +10 points
        """
        config = CRICKET_CONFIG['innings1']
        
        # Get predicted runs from simplified schema
        pred_score = self._get_score(prediction, 'runs')
        
        diff = abs(actual_score - pred_score)
        print(f"[CricketCalculator] 1st innings: predicted={pred_score}, actual={actual_score}, diff={diff}")
        
        if diff == 0:
            print(f"[CricketCalculator]   Exact match! {config['exact_match_points']} points")
            return {
                'points': config['exact_match_points'],
                'diff': diff,
                'rawDiff': 0,
                'isExact': True,
                'guess': pred_score,
                'mode': 'Score'
            }
        
        base = max(0, round(config['base_points'] - diff * config['diff_multiplier']))
        near_5 = config['near_5_points'] if diff <= config['near_5_threshold'] else 0
        near_10 = config['near_10_points'] if diff <= config['near_10_threshold'] else 0
        
        print(f"[CricketCalculator]   Base: {base} (120 - {diff}*1.2)")
        print(f"[CricketCalculator]   Near 5 bonus: {near_5}")
        print(f"[CricketCalculator]   Near 10 bonus: {near_10}")
        print(f"[CricketCalculator]   Total: {base + near_5 + near_10}")
        
        return {
            'points': base + near_5 + near_10,
            'diff': diff,
            'rawDiff': diff,
            'isExact': False,
            'isNear5': diff <= config['near_5_threshold'],
            'isNear10': diff <= config['near_10_threshold'],
            'guess': pred_score,
            'mode': 'Score'
        }
    
    def calculate_innings2_points(self, prediction: Dict[str, Any], actual_winner: str,
                                  actual_result: str, meta: Dict[str, Any], is_overs: bool) -> Dict[str, Any]:
        """
        Calculate points for 2nd innings prediction

        Prediction format:
        - winnerTeam: The team that will win the match (e.g., "CSK")
        - runsOrOvers: The predicted value
          - If overs format (e.g., "15.2"): Predicted overs to win
          - If score format (e.g., "102"): Predicted final score of the batting (losing) team

        Scoring rules:
        - Wrong winner: 0 points
        - Exact match: +70 points
        - Base: 120 - (diff * multiplier)
        - Near thresholds: bonus points
        """
        config = CRICKET_CONFIG['innings2']

        # Get predicted winner and value from simplified schema
        pred_winner = (prediction.get('winnerTeam') or '').lower()
        pred_val_str = str(prediction.get('runsOrOvers', '0'))

        # Determine if prediction is overs format (contains decimal point)
        pred_is_overs = '.' in pred_val_str

        print(f"[CricketCalculator] 2nd innings: predicted_winner={pred_winner}, actual_winner={actual_winner}, predicted_val={pred_val_str}, actual_result={actual_result}, is_overs={is_overs}, pred_is_overs={pred_is_overs}")
        print(f"[CricketCalculator]   Interpretation: User predicted {pred_winner} to win, with {'overs to win' if pred_is_overs else 'losing team score of'} {pred_val_str}")

        # Wrong winner prediction
        if pred_winner != actual_winner.lower():
            print(f"[CricketCalculator]   Wrong winner! 0 points")
            return {
                'points': 0,
                'diff': '---',
                'rawDiff': 0,
                'guess': pred_val_str,
                'isExact': False,
                'mode': 'Wrong Winner'
            }

        # Correct winner - calculate based on format
        if is_overs:
            actual_balls = overs_to_balls(actual_result)
            pred_balls = overs_to_balls(pred_val_str)
            diff = abs(actual_balls - pred_balls)

            accuracy = max(0, round(config['base_points'] - diff * config['diff_multiplier_overs']))
            near_3 = config['near_3_points'] if diff <= config['near_3_threshold'] else 0
            near_9 = config['near_9_points'] if diff <= config['near_9_threshold'] else 0
            exact = config['exact_match_points'] if diff == 0 else 0

            print(f"[CricketCalculator]   Correct winner (overs format)")
            print(f"[CricketCalculator]   Actual balls: {actual_balls}, Predicted balls: {pred_balls}, Diff: {diff}")
            print(f"[CricketCalculator]   Base: {accuracy} (120 - {diff}*1.8)")
            print(f"[CricketCalculator]   Near 3 bonus: {near_3}")
            print(f"[CricketCalculator]   Near 9 bonus: {near_9}")
            print(f"[CricketCalculator]   Exact bonus: {exact}")
            print(f"[CricketCalculator]   Total: {accuracy + near_3 + near_9 + exact}")

            return {
                'points': accuracy + near_3 + near_9 + exact,
                'diff': balls_to_overs_display(diff),
                'rawDiff': diff,
                'guess': pred_val_str,
                'isExact': diff == 0,
                'mode': 'Overs'
            }
        else:
            # Score format: actual_result is the losing team's final score
            # User predicted the losing team would score pred_val_str
            diff = abs(int(actual_result) - int(pred_val_str or 0))

            base = max(0, round(config['base_points'] - diff * config['diff_multiplier_score']))
            near_5 = config['near_5_points'] if diff <= config['near_5_threshold'] else 0
            near_12 = config['near_12_points'] if diff <= config['near_12_threshold'] else 0
            exact = config['exact_match_points'] if diff == 0 else 0

            print(f"[CricketCalculator]   Correct winner (score format)")
            print(f"[CricketCalculator]   Actual losing team score: {actual_result}, Predicted losing team score: {pred_val_str}, Diff: {diff}")
            print(f"[CricketCalculator]   Base: {base} (120 - {diff}*1.2)")
            print(f"[CricketCalculator]   Near 5 bonus: {near_5}")
            print(f"[CricketCalculator]   Near 12 bonus: {near_12}")
            print(f"[CricketCalculator]   Exact bonus: {exact}")
            print(f"[CricketCalculator]   Total: {base + near_5 + near_12 + exact}")

            return {
                'points': base + near_5 + near_12 + exact,
                'diff': f"{diff} runs",
                'rawDiff': diff,
                'guess': int(pred_val_str or 0),
                'isExact': diff == 0,
                'mode': 'Score'
            }
    
    def calculate_penalty(self, prediction: Dict[str, Any], existing_penalties: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Calculate penalties for various prediction errors
        
        Returns a dict with penalty breakdown:
        {
            'total': -30,
            'breakdown': {
                'inconsistent_winner': -20,
                'first_inn_1st_over': -5,
                'first_inn_2nd_over': -10,
                ...
            },
            'applied': ['inconsistent_winner', 'first_inn_1st_over', ...]
        }
        """
        config = CRICKET_CONFIG['penalty']
        existing_penalties = existing_penalties or {}
        
        penalties = {}
        applied = []
        total = 0
        
        # Check for inconsistent winner prediction (if both innings have predictions)
        # Note: winnerTeam now stores real team names
        winner1 = (prediction.get('winnerTeam') or '').lower()
        
        # The penalty is applied on the frontend when user changes their prediction
        # Backend just checks if penalty was already applied
        
        # Check for first innings over-based penalties
        # This would need to be determined from prediction data - placeholder for now
        # These would be applied based on specific prediction errors
        
        return {
            'total': total,
            'breakdown': penalties,
            'applied': applied
        }
    
    def get_sport_name(self) -> str:
        """Return sport name"""
        return "cricket"
    
    def _get_score(self, prediction: Dict[str, Any], key: str) -> int:
        """Safely get score from prediction"""
        try:
            return int(prediction.get(key, 0) or 0)
        except (ValueError, TypeError):
            return 0
