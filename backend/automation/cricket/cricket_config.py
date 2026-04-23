"""
Cricket scoring configuration and constants
"""

# Scoring constants for cricket
CRICKET_CONFIG = {
    'innings1': {
        'exact_match_points': 200,
        'base_points': 120,
        'diff_multiplier': 1.2,
        'near_5_threshold': 5,
        'near_5_points': 20,
        'near_10_threshold': 10,
        'near_10_points': 10
    },
    'innings2': {
        'base_points': 120,
        'diff_multiplier_score': 1.2,
        'diff_multiplier_overs': 1.8,
        'near_5_threshold': 5,
        'near_5_points': 20,
        'near_12_threshold': 12,
        'near_12_points': 10,
        'near_3_threshold': 3,
        'near_3_points': 20,
        'near_9_threshold': 9,
        'near_9_points': 10,
        'exact_match_points': 70
    },
    'penalty': {
        'inconsistent_winner_penalty': -20,
        'first_inn_1st_over': -5,
        'first_inn_2nd_over': -10,
        'first_inn_3rd_over': -30,
        'second_inn_1st_over': -5
    }
}


def overs_to_balls(overs_str: str) -> int:
    """
    Convert overs string to total balls
    
    Args:
        overs_str: Overs string like "15.2" (15 overs, 2 balls)
        
    Returns:
        Total balls (e.g., 15.2 -> 92 balls)
    """
    try:
        parts = overs_str.split('.')
        overs = int(parts[0])
        balls = int(parts[1]) if len(parts) > 1 else 0
        return overs * 6 + balls
    except (ValueError, IndexError):
        return 0


def balls_to_overs_display(balls: int) -> str:
    """
    Convert total balls to overs display string
    
    Args:
        balls: Total balls
        
    Returns:
        Overs string like "15.2"
    """
    overs = balls // 6
    remaining_balls = balls % 6
    return f"{overs}.{remaining_balls}"
