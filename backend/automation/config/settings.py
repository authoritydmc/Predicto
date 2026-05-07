"""Centralized configuration for automation"""
import os
from typing import Dict, Any

# Environment
ENV = os.getenv('ENVIRONMENT', 'prod')

# Firebase settings
FIREBASE_COLLECTIONS = {
    'tournaments': 'tournaments',
    'matches': 'matches',
    'predictions': 'predictions',
    'results': 'results',
    'cron_jobs': 'automation_config/cron_jobs'
}

# Match status constants
MATCH_STATUSES = {
    'SCHEDULED': 'scheduled',
    'LIVE': 'live',
    'FIRST_INNINGS_LIVE': 'first_innings_live',
    'FIRST_INNINGS_DONE': 'first_innings_done',
    'INNINGS_BREAK': 'innings_break',
    'SECOND_INNINGS_LIVE': 'second_innings_live',
    'SECOND_INNINGS_DONE': 'second_innings_done',
    'COMPLETED': 'completed',
    'ABANDONED': 'abandoned'
}

# Prediction rules
PREDICTION_RULES = {
    'FIRST_INNINGS_CLOSE_OVERS': 3,
    'SECOND_INNINGS_CLOSE_OVERS': 3,
    'EARLY_PREDICTION_ALLOWED': True
}

# Scoring constants
SCORING = {
    'EXACT_MATCH_POINTS': 200,
    'WITHIN_5_RUNS_BONUS': 20,
    'WITHIN_10_RUNS_BONUS': 10,
    'WITHIN_3_BALLS_BONUS': 20,
    'WITHIN_9_BALLS_BONUS': 10,
    'EXACT_BALLS_BONUS': 70,
    'NO_PREDICTION_PENALTY': 50,
    'BASE_SCORE_MAX': 120,
    'RUNS_DIFF_MULTIPLIER': 1.2,
    'BALLS_DIFF_MULTIPLIER': 1.8
}

# Cron job defaults
DEFAULT_CRON_JOBS = {
    'get_live_matches': {
        'name': 'Get Live Matches',
        'script': 'automation.matches.live_matches',
        'schedule': '*/1 * * * *',
        'enabled': True,
        'description': 'Fetch all live matches from Firebase'
    },
    'run_scraper': {
        'name': 'Run Scraper',
        'script': 'automation.scraper.runner',
        'schedule': '*/30 * * * * *',
        'enabled': True,
        'description': 'Scrape live scores for active matches'
    },
    'match_status': {
        'name': 'Match Status Handler',
        'script': 'automation.matches.status_manager',
        'schedule': '*/1 * * * *',
        'enabled': True,
        'description': 'Handle match status transitions'
    },
    'auto_schedule': {
        'name': 'Auto Schedule Matches',
        'script': 'automation.matches.scheduler',
        'schedule': '0 */6 * * *',
        'enabled': True,
        'description': 'Auto-schedule upcoming matches'
    },
    'score_calculator': {
        'name': 'Score Calculator',
        'script': 'automation.scoring.calculator',
        'schedule': '*/5 * * * *',
        'enabled': True,
        'description': 'Calculate scores and penalties'
    },
    'leaderboard_update': {
        'name': 'Update Leaderboard',
        'script': 'automation.scoring.leaderboard',
        'schedule': '*/5 * * * *',
        'enabled': True,
        'description': 'Update match and tournament leaderboards'
    }
}

# Scraper settings
SCRAPER_CONFIG = {
    'cricket': {
        'primary': 'cricbuzz',
        'fallback': ['google', 'cricapi'],
        'timeout': 30
    },
    'football': {
        'primary': 'apifootball',
        'fallback': [],
        'timeout': 30
    }
}

def get_config(key: str = None) -> Any:
    """Get configuration value"""
    if key:
        return globals().get(key)
    return {
        'env': ENV,
        'firebase': FIREBASE_COLLECTIONS,
        'match_statuses': MATCH_STATUSES,
        'prediction_rules': PREDICTION_RULES,
        'scoring': SCORING,
        'cron_jobs': DEFAULT_CRON_JOBS,
        'scraper': SCRAPER_CONFIG
    }
