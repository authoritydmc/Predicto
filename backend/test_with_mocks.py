#!/usr/bin/env python
"""Test automation scripts with mocks (no Firebase needed)"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from unittest.mock import Mock, MagicMock, patch
from automation.logging_config import setup_logging

logger = setup_logging()
logger.info("="*50)
logger.info("Starting Automation Tests with Mocks")
logger.info("="*50)

# Mock Firebase
mock_db = MagicMock()
mock_firebase = Mock()
mock_firebase.db = mock_db

# Test 1: Match Creation
logger.info("\n" + "="*50)
logger.info("Test 1: Match Creation")
logger.info("="*50)

try:
    from automation.matches.scheduler import MatchScheduler
    from automation.matches.live_matches import get_live_matches
    
    # Mock scraper
    mock_scraper = Mock()
    mock_scraper.get_cricket_score.return_value = None
    
    # Create scheduler with mock
    scheduler = MatchScheduler(mock_firebase, mock_scraper)
    logger.info("MatchScheduler created successfully")
    
    logger.info("PASSED: Match Creation structure is correct")
except Exception as e:
    logger.error(f"FAILED: {e}", exc_info=True)

# Test 2: Scraper Runner
logger.info("\n" + "="*50)
logger.info("Test 2: Scraper Runner")
logger.info("="*50)

try:
    from automation.scraper.runner import run_scraper_for_live_matches
    
    # Mock get_live_matches
    with patch('automation.scraper.runner.get_live_matches', return_value=[]):
        with patch('automation.scraper.runner.update_match_status'):
            result = run_scraper_for_live_matches(mock_firebase, mock_scraper)
            logger.info(f"Scraper run completed: {result} matches updated")
    
    logger.info("PASSED: Scraper Runner structure is correct")
except Exception as e:
    logger.error(f"FAILED: {e}", exc_info=True)

# Test 3: Match Status Manager
logger.info("\n" + "="*50)
logger.info("Test 3: Match Status Manager")
logger.info("="*50)

try:
    from automation.matches.status_manager import MatchStatusManager
    
    status_mgr = MatchStatusManager(mock_firebase)
    
    # Test with a mock match
    mock_match = {
        'id': 'test_match',
        'sport': 'cricket',
        'status': 'live',
        'live_score': {
            'currentInnings': 1,
            'innings1': {'runs': 50, 'wickets': 2, 'overs': '3.2'},
            'status': 'live'
        }
    }
    
    updates = status_mgr.process_match_status(mock_match)
    logger.info(f"Status updates: {updates}")
    
    logger.info("PASSED: Match Status Manager structure is correct")
except Exception as e:
    logger.error(f"FAILED: {e}", exc_info=True)

# Test 4: Score Calculator
logger.info("\n" + "="*50)
logger.info("Test 4: Score Calculator")
logger.info("="*50)

try:
    from automation.scoring.calculator import ScoreCalculator
    
    calc = ScoreCalculator(mock_firebase)
    logger.info("ScoreCalculator created successfully")
    
    logger.info("PASSED: Score Calculator structure is correct")
except Exception as e:
    logger.error(f"FAILED: {e}", exc_info=True)

# Test 5: Leaderboard Manager
logger.info("\n" + "="*50)
logger.info("Test 5: Leaderboard Manager")
logger.info("="*50)

try:
    from automation.scoring.leaderboard import LeaderboardManager
    
    lb_mgr = LeaderboardManager(mock_firebase)
    logger.info("LeaderboardManager created successfully")
    
    logger.info("PASSED: Leaderboard Manager structure is correct")
except Exception as e:
    logger.error(f"FAILED: {e}", exc_info=True)

# Test 6: Cron Manager
logger.info("\n" + "="*50)
logger.info("Test 6: Cron Manager")
logger.info("="*50)

try:
    from automation.cron.manager import CronManager
    
    cron_mgr = CronManager(mock_firebase)
    logger.info("CronManager created successfully")
    
    logger.info("PASSED: Cron Manager structure is correct")
except Exception as e:
    logger.error(f"FAILED: {e}", exc_info=True)

logger.info("\n" + "="*50)
logger.info("All Tests Completed")
logger.info("="*50)
