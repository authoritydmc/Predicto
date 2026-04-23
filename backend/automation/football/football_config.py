"""
Football scoring configuration and constants
"""

# Scoring constants for football
FOOTBALL_CONFIG = {
    'score_prediction': {
        'exact_match_points': 200,
        'base_points': 120,
        'diff_multiplier': 1.5,
        'near_1_threshold': 1,
        'near_1_points': 20,
        'near_2_threshold': 2,
        'near_2_points': 10
    },
    'winner_prediction': {
        'correct_winner_points': 50,
        'wrong_winner_points': 0
    },
    'penalty': {
        'inconsistent_winner_penalty': -20
    }
}
