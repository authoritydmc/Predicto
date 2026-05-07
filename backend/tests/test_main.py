"""Tests for main entry point"""
import unittest
from unittest.mock import Mock, patch
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

class TestMain(unittest.TestCase):
    
    def test_import_main(self):
        """Test that main module can be imported"""
        try:
            import automation.main
            self.assertTrue(True)
        except ImportError as e:
            self.fail(f"Failed to import main: {e}")
    
    @patch('automation.main._init_firebase')
    def test_init_firebase(self, mock_init):
        """Test Firebase initialization"""
        mock_init.return_value = Mock()
        
        from automation.main import _init_firebase
        result = _init_firebase()
        
        mock_init.assert_called_once()
    
    def test_main_has_required_commands(self):
        """Test that main has all required commands"""
        import automation.main
        
        # Check that main function exists
        self.assertTrue(hasattr(automation.main, 'main'))
        
        # Check that required functions exist
        self.assertTrue(hasattr(automation.main, '_handle_scheduler'))
        self.assertTrue(hasattr(automation.main, '_handle_run'))
        self.assertTrue(hasattr(automation.main, '_handle_cron'))


if __name__ == '__main__':
    unittest.main()
