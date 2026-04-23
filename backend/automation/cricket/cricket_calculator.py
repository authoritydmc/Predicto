"""
Cricket-specific score calculator
Implements cricket scoring rules
"""

from typing import Dict, Any
from ..base.score_calculator import ScoreCalculator
from .cricket_config import CRICKET_CONFIG, overs_to_balls, balls_to_overs_display


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
        
        # Determine which score to use based on disableScore flags
        use_a = not meta.get('disableScoreA', False) and meta.get('disableScoreB', False)
        use_b = not meta.get('disableScoreB', False) and meta.get('disableScoreA', False)
        
        pred_score = 0
        if use_a:
            pred_score = self._get_score(prediction, 'scoreA')
        elif use_b:
            pred_score = self._get_score(prediction, 'scoreB')
        else:
            # Use predicted winner to determine which score to use
            winner = (prediction.get('predictedWinner') or '').lower()
            team_a = (meta.get('teamA') or '').lower()
            team_b = (meta.get('teamB') or '').lower()
            
            if winner == team_a:
                pred_score = self._get_score(prediction, 'scoreA')
            elif winner == team_b:
                pred_score = self._get_score(prediction, 'scoreB')
            else:
                # Use max of both scores
                pred_score = max(
                    self._get_score(prediction, 'scoreA'),
                    self._get_score(prediction, 'scoreB')
                )
        
        diff = abs(actual_score - pred_score)
        
        if diff == 0:
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
        
        Scoring rules:
        - Wrong winner: 0 points
        - Exact match: +70 points
        - Base: 120 - (diff * multiplier)
        - Near thresholds: bonus points
        """
        config = CRICKET_CONFIG['innings2']
        
        # Determine chasing team
        team_a = (meta.get('teamA') or 'Team A').lower()
        team_b = (meta.get('teamB') or 'Team B').lower()
        
        chasing_team = team_b
        if meta.get('disableScoreA') and not meta.get('disableScoreB'):
            chasing_team = team_b
        elif meta.get('disableScoreB') and not meta.get('disableScoreA'):
            chasing_team = team_a
        
        pred_winner = (prediction.get('predictedWinner') or '').lower()
        pred_val = self._get_chasing_prediction(prediction, chasing_team, team_a, team_b)
        
        # Wrong winner prediction
        if pred_winner != actual_winner.lower():
            if is_overs:
                wrong_diff = abs(overs_to_balls(actual_result) - overs_to_balls(str(pred_val or 0)))
            else:
                wrong_diff = abs(int(actual_result) - int(pred_val or 0))
            
            return {
                'points': 0,
                'diff': '---',
                'rawDiff': wrong_diff,
                'guess': pred_val or '---',
                'isExact': False,
                'mode': 'Wrong Winner'
            }
        
        # Correct winner - calculate based on format
        if is_overs:
            actual_balls = overs_to_balls(actual_result)
            pred_balls = overs_to_balls(str(pred_val or 0))
            diff = abs(actual_balls - pred_balls)
            
            accuracy = max(0, round(config['base_points'] - diff * config['diff_multiplier_overs']))
            near_3 = config['near_3_points'] if diff <= config['near_3_threshold'] else 0
            near_9 = config['near_9_points'] if diff <= config['near_9_threshold'] else 0
            exact = config['exact_match_points'] if diff == 0 else 0
            
            return {
                'points': accuracy + near_3 + near_9 + exact,
                'diff': balls_to_overs_display(diff),
                'rawDiff': diff,
                'guess': pred_val,
                'isExact': diff == 0,
                'mode': 'Overs'
            }
        else:
            diff = abs(int(actual_result) - int(pred_val or 0))
            
            base = max(0, round(config['base_points'] - diff * config['diff_multiplier_score']))
            near_5 = config['near_5_points'] if diff <= config['near_5_threshold'] else 0
            near_12 = config['near_12_points'] if diff <= config['near_12_threshold'] else 0
            exact = config['exact_match_points'] if diff == 0 else 0
            
            return {
                'points': base + near_5 + near_12 + exact,
                'diff': f"{diff} runs",
                'rawDiff': diff,
                'guess': int(pred_val or 0),
                'isExact': diff == 0,
                'mode': 'Score'
            }
    
    def calculate_penalty(self, prediction1: Dict[str, Any], prediction2: Dict[str, Any]) -> int:
        """
        Calculate penalty for inconsistent winner predictions
        
        Penalty: -20 points if winner predictions differ
        """
        config = CRICKET_CONFIG['penalty']
        
        winner1 = (prediction1.get('predictedWinner') or '').lower()
        winner2 = (prediction2.get('predictedWinner') or '').lower()
        
        if winner1 and winner2 and winner1 != winner2:
            return config['inconsistent_winner_penalty']
        
        return 0
    
    def get_sport_name(self) -> str:
        """Return sport name"""
        return "cricket"
    
    def _get_score(self, prediction: Dict[str, Any], key: str) -> int:
        """Safely get score from prediction"""
        try:
            return int(prediction.get(key, 0) or 0)
        except (ValueError, TypeError):
            return 0
    
    def _get_chasing_prediction(self, prediction: Dict[str, Any], chasing_team: str,
                                team_a: str, team_b: str) -> int:
        """Get prediction for chasing team"""
        if chasing_team == team_a:
            return self._get_score(prediction, 'scoreA')
        else:
            return self._get_score(prediction, 'scoreB')
