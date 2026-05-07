"""Tests for matches module"""
import unittest
from unittest.mock import Mock, MagicMock, patch
from datetime import datetime, timedelta
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from automation.matches.live_matches import get_live_matches, get_match_by_id, update_match_status
from automation.matches.status_manager import MatchStatusManager

class TestLiveMatches(unittest.TestCase):
    
    def setUp(self):
        """Set up test fixtures"""
        self.mock_firebase = Mock()
        self.mock_db = Mock()
        self.mock_firebase.db = self.mock_db
    
    def test_get_live_matches(self):
        """Test fetching live matches"""
        # Mock tournament document
        mock_tourn_doc = Mock()
        mock_tourn_doc.id = 'tournament1'
        mock_tourn_doc.to_dict.return_value = {'name': 'Test Tournament'}
        
        # Mock match documents
        mock_match_doc = Mock()
        mock_match_doc.id = 'match1'
        mock_match_doc.to_dict.return_value = {
            'status': 'live',
            'team1': 'Team A',
            'team2': 'Team B'
        }
        
        # Setup mock chain
        self.mock_db.collection.return_value.stream.return_value = [mock_tourn_doc]
        self.mock_db.collection.return_value.document.return_value.collection.return_value.where.return_value.stream.return_value = [mock_match_doc]
        
        matches = get_live_matches(self.mock_firebase, 'cricket')
        
        self.assertEqual(len(matches), 1)
        self.assertEqual(matches[0]['id'], 'match1')
        self.assertEqual(matches[0]['status'], 'live')
    
    def test_get_match_by_id(self):
        """Test getting a specific match"""
        mock_doc = Mock()
        mock_doc.exists = True
        mock_doc.id = 'match1'
        mock_doc.to_dict.return_value = {'status': 'live'}
        
        self.mock_db.document.return_value.get.return_value = mock_doc
        
        match = get_match_by_id(self.mock_firebase, 'cricket', 'tournament1', 'match1')
        
        self.assertIsNotNone(match)
        self.assertEqual(match['id'], 'match1')
    
    def test_update_match_status(self):
        """Test updating match status"""
        mock_ref = Mock()
        self.mock_db.document.return_value = mock_ref
        mock_ref.update.return_value = None
        
        result = update_match_status(
            self.mock_firebase, 'cricket', 'tournament1', 'match1',
            {'status': 'completed'}
        )
        
        self.assertTrue(result)
        mock_ref.update.assert_called_once()


class TestMatchStatusManager(unittest.TestCase):
    
    def setUp(self):
        """Set up test fixtures"""
        self.mock_firebase = Mock()
        self.status_mgr = MatchStatusManager(self.mock_firebase)
    
    def test_process_cricket_match_live(self):
        """Test processing a live cricket match"""
        match = {
            'id': 'match1',
            'sport': 'cricket',
            'status': 'live',
            'live_score': {
                'currentInnings': 1,
                'innings1': {'runs': 50, 'wickets': 2, 'overs': '3.2'},
                'status': 'live'
            }
        }
        
        updates = self.status_mgr.process_match_status(match)
        
        # After 3 overs, predictions should close
        self.assertIn('predictionStatus.firstInningsOpen', updates)
        self.assertFalse(updates['predictionStatus.firstInningsOpen'])
    
    def test_process_cricket_match_completed(self):
        """Test processing a completed match"""
        match = {
            'id': 'match1',
            'sport': 'cricket',
            'status': 'second_innings_live',
            'live_score': {
                'currentInnings': 2,
                'innings1': {'runs': 150, 'wickets': 10, 'overs': '20.0'},
                'innings2': {'runs': 155, 'wickets': 4, 'overs': '18.0'},
                'status': 'Team A won by 5 wickets'
            }
        }
        
        updates = self.status_mgr.process_match_status(match)
        
        self.assertEqual(updates['status'], 'completed')
        self.assertEqual(updates['live_score.status'], 'done')
    
    def test_is_match_completed(self):
        """Test match completion detection"""
        self.assertTrue(self.status_mgr._is_match_completed('team won by 10 runs'))
        self.assertTrue(self.status_mgr._is_match_completed('match complete'))
        self.assertTrue(self.status_mgr._is_match_completed('draw'))
        self.assertFalse(self.status_mgr._is_match_completed('live'))
        self.assertFalse(self.status_mgr._is_match_completed('innings break'))
    
    def test_parse_overs(self):
        """Test overs parsing"""
        self.assertAlmostEqual(self.status_mgr._parse_overs('3.2'), 3.333, places=2)
        self.assertAlmostEqual(self.status_mgr._parse_overs('19.6'), 19.999, places=2)
        self.assertEqual(self.status_mgr._parse_overs('0'), 0.0)


if __name__ == '__main__':
    unittest.main()
