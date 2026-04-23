"""
Football-specific score calculator
Implements football scoring rules
"""

from typing import Dict, Any
from ..base.score_calculator import ScoreCalculator
from .football_config import FOOTBALL_CONFIG


class FootballCalculator(ScoreCalculator):
    """Football score calculator implementing football-specific scoring rules"""
    
    def calculate_innings1_points(self, prediction: Dict[str, Any], actual_score: int,
                                  meta: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculate points for score prediction (football doesn't have innings)
        
        Scoring rules:
        - Exact match: 200 points
        - Base: 120 - (diff * 1.5)
        - Within 1 goal: +20 points
        - Within 2 goals: +10 points
        """
        config = FOOTBALL_CONFIG['score_prediction']
        
        # For football, scoreA and scoreB represent goals
        pred_score_a = self._get_score(prediction, 'scoreA')
        pred_score_b = self._get_score(prediction, 'scoreB')
        
        # Calculate total predicted score
        pred_total = pred_score_a + pred_score_b
        
        # Calculate difference from actual total
        diff = abs(actual_score - pred_total)
        
        if diff == 0:
            return {
                'points': config['exact_match_points'],
                'diff': diff,
                'rawDiff': 0,
                'isExact': True,
                'guess': pred_total,
                'mode': 'Score'
            }
        
        base = max(0, round(config['base_points'] - diff * config['diff_multiplier']))
        near_1 = config['near_1_points'] if diff <= config['near_1_threshold'] else 0
        near_2 = config['near_2_points'] if diff <= config['near_2_threshold'] else 0
        
        return {
            'points': base + near_1 + near_2,
            'diff': diff,
            'rawDiff': diff,
            'isExact': False,
            'isNear1': diff <= config['near_1_threshold'],
            'isNear2': diff <= config['near_2_threshold'],
            'guess': pred_total,
            'mode': 'Score'
        }
    
    def calculate_innings2_points(self, prediction: Dict[str, Any], actual_winner: str,
                                  actual_result: str, meta: Dict[str, Any], is_overs: bool) -> Dict[str, Any]:
        """
        Calculate points for winner prediction (football doesn't have 2nd innings)
        
        This is used for winner prediction scoring
        """
        config = FOOTBALL_CONFIG['winner_prediction']
        
        pred_winner = (prediction.get('predictedWinner') or '').lower()
        actual_winner_lower = actual_winner.lower()
        
        if pred_winner == actual_winner_lower:
            return {
                'points': config['correct_winner_points'],
                'diff': 0,
                'rawDiff': 0,
                'isExact': True,
                'guess': pred_winner,
                'mode': 'Winner'
            }
        else:
            return {
                'points': config['wrong_winner_points'],
                'diff': '---',
                'rawDiff': 0,
                'isExact': False,
                'guess': pred_winner,
                'mode': 'Wrong Winner'
            }
    
    def calculate_penalty(self, prediction1: Dict[str, Any], prediction2: Dict[str, Any]) -> int:
        """
        Calculate penalty for inconsistent predictions
        
        For football, this could apply if there are multiple prediction rounds
        """
        config = FOOTBALL_CONFIG['penalty']
        
        winner1 = (prediction1.get('predictedWinner') or '').lower()
        winner2 = (prediction2.get('predictedWinner') or '').lower()
        
        if winner1 and winner2 and winner1 != winner2:
            return config['inconsistent_winner_penalty']
        
        return 0
    
    def get_sport_name(self) -> str:
        """Return sport name"""
        return "football"
    
    def _get_score(self, prediction: Dict[str, Any], key: str) -> int:
        """Safely get score from prediction"""
        try:
            return int(prediction.get(key, 0) or 0)
        except (ValueError, TypeError):
            return 0
