"""Tests for cron manager"""
import unittest
from unittest.mock import Mock, MagicMock, patch
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from automation.cron.manager import CronManager

class TestCronManager(unittest.TestCase):
    
    def setUp(self):
        """Set up test fixtures"""
        self.mock_firebase = Mock()
        self.mock_db = Mock()
        self.mock_firebase.db = self.mock_db
        self.cron_manager = CronManager(self.mock_firebase)
    
    def test_list_jobs(self):
        """Test listing cron jobs"""
        # Mock Firestore response
        mock_doc1 = Mock()
        mock_doc1.id = 'job1'
        mock_doc1.to_dict.return_value = {'name': 'Job 1', 'enabled': True}
        
        mock_doc2 = Mock()
        mock_doc2.id = 'job2'
        mock_doc2.to_dict.return_value = {'name': 'Job 2', 'enabled': False}
        
        self.mock_db.collection.return_value.stream.return_value = [mock_doc1, mock_doc2]
        
        jobs = self.cron_manager.list_jobs()
        
        self.assertEqual(len(jobs), 2)
        self.assertEqual(jobs[0]['id'], 'job1')
        self.assertEqual(jobs[1]['id'], 'job2')
    
    def test_get_job(self):
        """Test getting a specific job"""
        mock_doc = Mock()
        mock_doc.exists = True
        mock_doc.id = 'job1'
        mock_doc.to_dict.return_value = {'name': 'Test Job'}
        
        self.mock_db.collection.return_value.document.return_value.get.return_value = mock_doc
        
        job = self.cron_manager.get_job('job1')
        
        self.assertIsNotNone(job)
        self.assertEqual(job['id'], 'job1')
        self.assertEqual(job['name'], 'Test Job')
    
    def test_get_nonexistent_job(self):
        """Test getting a job that doesn't exist"""
        mock_doc = Mock()
        mock_doc.exists = False
        
        self.mock_db.collection.return_value.document.return_value.get.return_value = mock_doc
        
        job = self.cron_manager.get_job('nonexistent')
        
        self.assertIsNone(job)
    
    def test_add_job(self):
        """Test adding a new job"""
        self.mock_db.collection.return_value.document.return_value.set.return_value = None
        
        result = self.cron_manager.add_job('new_job', {
            'name': 'New Job',
            'schedule': '*/5 * * * *',
            'enabled': True
        })
        
        self.assertTrue(result)
        self.mock_db.collection.return_value.document.return_value.set.assert_called_once()
    
    def test_update_job(self):
        """Test updating a job"""
        self.mock_db.collection.return_value.document.return_value.update.return_value = None
        
        result = self.cron_manager.update_job('job1', {'enabled': False})
        
        self.assertTrue(result)
        self.mock_db.collection.return_value.document.return_value.update.assert_called_once()
    
    def test_remove_job(self):
        """Test removing a job"""
        self.mock_db.collection.return_value.document.return_value.delete.return_value = None
        
        result = self.cron_manager.remove_job('job1')
        
        self.assertTrue(result)
        self.mock_db.collection.return_value.document.return_value.delete.assert_called_once()
    
    def test_enable_job(self):
        """Test enabling a job"""
        with patch.object(self.cron_manager, 'update_job', return_value=True) as mock_update:
            result = self.cron_manager.enable_job('job1')
            self.assertTrue(result)
            mock_update.assert_called_once_with('job1', {'enabled': True})
    
    def test_disable_job(self):
        """Test disabling a job"""
        with patch.object(self.cron_manager, 'update_job', return_value=True) as mock_update:
            result = self.cron_manager.disable_job('job1')
            self.assertTrue(result)
            mock_update.assert_called_once_with('job1', {'enabled': False})
    
    def test_get_enabled_jobs(self):
        """Test getting enabled jobs only"""
        mock_doc = Mock()
        mock_doc.id = 'job1'
        mock_doc.to_dict.return_value = {'enabled': True}
        
        self.mock_db.collection.return_value.where.return_value.stream.return_value = [mock_doc]
        
        jobs = self.cron_manager.get_enabled_jobs()
        
        self.assertEqual(len(jobs), 1)
        self.assertEqual(jobs[0]['id'], 'job1')


if __name__ == '__main__':
    unittest.main()
