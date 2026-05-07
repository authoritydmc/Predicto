"""Tests for scraper runner"""
import unittest
from unittest.mock import Mock, patch
from datetime import datetime
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from automation.scraper.runner import run_scraper_for_live_matches

class TestScraperRunner(unittest.TestCase):
    
    def setUp(self):
        """Set up test fixtures"""
        self.mock_firebase = Mock()
        self.mock_db = Mock()
        self.mock_firebase.db = self.mock_db
        self.mock_scraper_manager = Mock()
    
    @patch('automation.scraper.runner.update_match_status')
    @patch('automation.scraper.runner.get_live_matches')
    def test_run_scraper_for_live_matches(self, mock_get_live, mock_update):
        """Test running scraper for live matches"""
        # Mock live matches
        mock_get_live.return_value = [
            {
                'id': 'match1',
                'sport': 'cricket',
                'tournament_id': 'tourn1',
                'team1': 'Team A',
                'team2': 'Team B',
                'status': 'live'
            }
        ]
        
        # Mock scraper data
        self.mock_scraper_manager.get_cricket_score.return_value = {
            'innings1': {'runs': 100, 'wickets': 2, 'overs': '10.0'},
            'status': 'live'
        }
        
        updated = run_scraper_for_live_matches(self.mock_firebase, self.mock_scraper_manager)
        
        self.assertEqual(updated, 1)
        mock_update.assert_called_once()
    
    @patch('automation.scraper.runner.update_match_status')
    def test_update_match_with_scraper(self, mock_update):
        """Test updating a match with scraper data"""
        from automation.scraper.runner import _update_match_with_scraper
        
        match = {
            'id': 'match1',
            'sport': 'cricket',
            'tournament_id': 'tourn1',
            'team1': 'Team A',
            'team2': 'Team B'
        }
        
        self.mock_scraper_manager.get_cricket_score.return_value = {
            'innings1': {'runs': 100},
            'status': 'live'
        }
        
        result = _update_match_with_scraper(
            self.mock_firebase,
            self.mock_scraper_manager,
            match
        )
        
        self.assertTrue(result)
        mock_update.assert_called_once()


if __name__ == '__main__':
    unittest.main()
