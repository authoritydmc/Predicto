"""Tests for scoring module"""
import unittest
from unittest.mock import Mock, MagicMock, patch
from datetime import datetime
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from automation.scoring.calculator import ScoreCalculator
from automation.scoring.leaderboard import LeaderboardManager

class TestScoreCalculator(unittest.TestCase):
    
    def setUp(self):
        """Set up test fixtures"""
        self.mock_firebase = Mock()
        self.mock_db = Mock()
        self.mock_firebase.db = self.mock_db
        self.calculator = ScoreCalculator(self.mock_firebase)
    
    def test_calculate_innings1_exact(self):
        """Test exact match prediction"""
        match = {
            'status': 'completed',
            'live_score': {
                'innings1': {'runs': 150, 'wickets': 5}
            },
            'predictions': {
                'user1': {'first_inn': {'runs': 150, 'wickets': 5}}
            }
        }
        
        result = self.calculator._calculate_innings1(match, match['live_score'])
        
        self.assertIn('user1', result['results'])
        # Exact match should have high score
        self.assertGreater(result['results']['user1']['score'], 200)
    
    def test_calculate_innings1_close(self):
        """Test close prediction"""
        match = {
            'status': 'completed',
            'live_score': {
                'innings1': {'runs': 150, 'wickets': 5}
            },
            'predictions': {
                'user1': {'first_inn': {'runs': 155, 'wickets': 5}}
            }
        }
        
        result = self.calculator._calculate_innings1(match, match['live_score'])
        
        # Within 5 runs should get bonus
        self.assertGreater(result['results']['user1']['score'], 100)
    
    def test_calculate_innings2_chasing(self):
        """Test second innings when chasing"""
        match = {
            'status': 'completed',
            'live_score': {
                'innings1': {'runs': 150},
                'innings2': {'runs': 155, 'overs': '18.0'}
            },
            'predictions': {
                'user1': {'second_inn': {'overs': '17.0'}}
            }
        }
        
        result = self.calculator._calculate_innings2(match, match['live_score'])
        
        self.assertIn('user1', result['results'])
    
    def test_overs_to_balls(self):
        """Test overs to balls conversion"""
        self.assertEqual(self.calculator._overs_to_balls('3.2'), 20)  # 3*6 + 2
        self.assertEqual(self.calculator._overs_to_balls('0.0'), 0)
        self.assertEqual(self.calculator._overs_to_balls('19.6'), 120)
    
    def test_calculate_penalty(self):
        """Test penalty calculation"""
        match = {
            'predictions': {
                'user1': {}  # No predictions
            }
        }
        
        penalty = self.calculator._calculate_penalty(match, 'user1')
        
        # Should have penalty for no predictions
        self.assertGreater(penalty, 0)


class TestLeaderboardManager(unittest.TestCase):
    
    def setUp(self):
        """Set up test fixtures"""
        self.mock_firebase = Mock()
        self.mock_db = Mock()
        self.mock_firebase.db = self.mock_db
        self.lb_manager = LeaderboardManager(self.mock_firebase)
    
    def test_update_match_leaderboard(self):
        """Test updating match leaderboard"""
        # Mock results
        mock_result1 = Mock()
        mock_result1.id = 'user1'
        mock_result1.to_dict.return_value = {'total': 200, 'p1Score': 100, 'p2Score': 100, 'penalty': 0}
        
        mock_result2 = Mock()
        mock_result2.id = 'user2'
        mock_result2.to_dict.return_value = {'total': 150, 'p1Score': 80, 'p2Score': 70, 'penalty': 0}
        
        self.mock_db.document.return_value.collection.return_value.stream.return_value = [mock_result1, mock_result2]
        
        result = self.lb_manager.update_match_leaderboard('cricket', 'tourn1', 'match1')
        
        self.assertTrue(result)
    
    def test_update_tournament_leaderboard(self):
        """Test updating tournament leaderboard"""
        # Mock match documents
        mock_match = Mock()
        mock_match.id = 'match1'
        
        self.mock_db.collection.return_value.where.return_value.stream.return_value = [mock_match]
        
        # Mock results for match
        mock_result = Mock()
        mock_result.id = 'user1'
        mock_result.to_dict.return_value = {'total': 200}
        
        self.mock_db.collection.return_value.document.return_value.collection.return_value.stream.return_value = [mock_result]
        
        result = self.lb_manager.update_tournament_leaderboard('cricket', 'tourn1')
        
        self.assertTrue(result)


if __name__ == '__main__':
    unittest.main()
