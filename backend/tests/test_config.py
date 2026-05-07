"""Tests for config module"""
import unittest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from automation.config.settings import (
    FIREBASE_COLLECTIONS, MATCH_STATUSES, PREDICTION_RULES,
    SCORING, DEFAULT_CRON_JOBS, get_config
)

class TestConfig(unittest.TestCase):
    
    def test_firebase_collections(self):
        """Test Firebase collections config"""
        self.assertIn('tournaments', FIREBASE_COLLECTIONS)
        self.assertIn('matches', FIREBASE_COLLECTIONS)
        self.assertIn('cron_jobs', FIREBASE_COLLECTIONS)
    
    def test_match_statuses(self):
        """Test match status constants"""
        self.assertEqual(MATCH_STATUSES['SCHEDULED'], 'scheduled')
        self.assertEqual(MATCH_STATUSES['LIVE'], 'live')
        self.assertEqual(MATCH_STATUSES['COMPLETED'], 'completed')
    
    def test_prediction_rules(self):
        """Test prediction rules"""
        self.assertEqual(PREDICTION_RULES['FIRST_INNINGS_CLOSE_OVERS'], 3)
        self.assertEqual(PREDICTION_RULES['SECOND_INNINGS_CLOSE_OVERS'], 3)
        self.assertTrue(PREDICTION_RULES['EARLY_PREDICTION_ALLOWED'])
    
    def test_scoring_constants(self):
        """Test scoring constants"""
        self.assertEqual(SCORING['EXACT_MATCH_POINTS'], 200)
        self.assertEqual(SCORING['WITHIN_5_RUNS_BONUS'], 20)
        self.assertEqual(SCORING['RUNS_DIFF_MULTIPLIER'], 1.2)
    
    def test_default_cron_jobs(self):
        """Test default cron jobs config"""
        self.assertIn('get_live_matches', DEFAULT_CRON_JOBS)
        self.assertIn('run_scraper', DEFAULT_CRON_JOBS)
        self.assertIn('match_status', DEFAULT_CRON_JOBS)
        self.assertIn('score_calculator', DEFAULT_CRON_JOBS)
        self.assertIn('leaderboard_update', DEFAULT_CRON_JOBS)
    
    def test_get_config(self):
        """Test get_config function"""
        config = get_config()
        self.assertIn('env', config)
        self.assertIn('firebase', config)
        self.assertIn('scoring', config)
        
        # Test getting specific key
        scoring = get_config('SCORING')
        self.assertEqual(scoring['EXACT_MATCH_POINTS'], 200)


if __name__ == '__main__':
    unittest.main()
