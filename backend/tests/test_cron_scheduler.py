"""Tests for cron scheduler"""
import unittest
from unittest.mock import Mock, MagicMock, patch
from datetime import datetime, timedelta
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from automation.cron.scheduler import Scheduler
from automation.cron.manager import CronManager
from automation.cron.tasks import TaskRegistry

class TestScheduler(unittest.TestCase):
    
    def setUp(self):
        """Set up test fixtures"""
        self.mock_cron_manager = Mock(spec=CronManager)
        self.task_registry = TaskRegistry()
        self.scheduler = Scheduler(self.mock_cron_manager, self.task_registry)
    
    def test_start_stop(self):
        """Test starting and stopping the scheduler"""
        self.assertFalse(self.scheduler.running)
        
        # Mock get_enabled_jobs to return empty list
        self.mock_cron_manager.get_enabled_jobs.return_value = []
        
        # Mock time.sleep to avoid actual waiting
        with patch('time.sleep', side_effect=KeyboardInterrupt):
            try:
                self.scheduler.start()
            except KeyboardInterrupt:
                pass
        
        # After stopping
        self.scheduler.stop()
        self.assertFalse(self.scheduler.running)
    
    def test_should_run_first_time(self):
        """Test that job runs if never ran before"""
        job = {
            'id': 'test_job',
            'schedule': '*/1 * * * *',
            'last_run': None
        }
        
        result = self.scheduler._should_run(job, datetime.now())
        self.assertTrue(result)
    
    def test_should_run_if_schedule_met(self):
        """Test that job runs if schedule is met"""
        last_run = datetime.now() - timedelta(minutes=2)
        job = {
            'id': 'test_job',
            'schedule': '*/1 * * * *',  # Every minute
            'last_run': last_run.isoformat()
        }
        
        result = self.scheduler._should_run(job, datetime.now())
        self.assertTrue(result)
    
    def test_should_not_run_if_schedule_not_met(self):
        """Test that job doesn't run if schedule not met"""
        last_run = datetime.now() - timedelta(seconds=30)
        job = {
            'id': 'test_job',
            'schedule': '*/1 * * * *',  # Every minute
            'last_run': last_run.isoformat()
        }
        
        result = self.scheduler._should_run(job, datetime.now())
        self.assertFalse(result)
    
    def test_run_job_now(self):
        """Test running a job immediately"""
        # Create a test task
        def test_task():
            return "executed"
        
        self.task_registry.register('test_task', test_task)
        
        # Mock the cron manager
        self.mock_cron_manager.get_job.return_value = {
            'id': 'test_job',
            'script': 'test_task'
        }
        
        result = self.scheduler.run_job_now('test_job')
        self.assertTrue(result)


if __name__ == '__main__':
    unittest.main()
