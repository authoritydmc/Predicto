"""
Main scheduler orchestrator
Manages task execution and intervals
"""

import time
import subprocess
import sys
from typing import Dict, List, Optional
from datetime import datetime
from .task_config import TaskConfig
from .websocket_logger import WebSocketLogger
from ..base.firebase_client import FirebaseClient


class Scheduler:
    """Main scheduler for automation tasks"""
    
    def __init__(self, firebase_client: FirebaseClient, logger: Optional[WebSocketLogger] = None):
        """
        Initialize scheduler
        
        Args:
            firebase_client: Firebase client for config storage
            logger: WebSocket logger for real-time logs
        """
        self.client = firebase_client
        self.logger = logger or WebSocketLogger()
        self.tasks: Dict[str, TaskConfig] = {}
        self.running = False
        self.default_interval = 60  # Default 1 minute
    
    def load_tasks_from_firebase(self) -> bool:
        """
        Load task configurations from Firebase
        
        Returns:
            True if successful
        """
        path = 'scheduler_config/tasks'
        data = self.client.get(path)
        
        if not data:
            self.logger.info('scheduler', 'No tasks found in Firebase, using defaults')
            self._create_default_tasks()
            return True
        
        for task_id, task_data in data.items():
            if isinstance(task_data, dict):
                self.tasks[task_id] = TaskConfig.from_dict(task_data)
        
        self.logger.info('scheduler', f'Loaded {len(self.tasks)} tasks from Firebase')
        return True
    
    def _create_default_tasks(self):
        """Create default task configurations"""
        default_tasks = [
            TaskConfig(
                task_id='cricket_score_calc',
                name='Cricket Score Calculator',
                script_path='automation/cricket/cricket_calculator.py',
                interval_seconds=60,
                enabled=True
            ),
            TaskConfig(
                task_id='football_score_calc',
                name='Football Score Calculator',
                script_path='automation/football/football_calculator.py',
                interval_seconds=60,
                enabled=True
            ),
            TaskConfig(
                task_id='tournament_leaderboard',
                name='Tournament Leaderboard Update',
                script_path='automation/base/leaderboard_updater.py',
                interval_seconds=300,  # 5 minutes
                enabled=True
            )
        ]
        
        for task in default_tasks:
            self.tasks[task.id] = task
        
        self._save_tasks_to_firebase()
    
    def _save_tasks_to_firebase(self) -> bool:
        """Save task configurations to Firebase"""
        path = 'scheduler_config/tasks'
        data = {task_id: task.to_dict() for task_id, task in self.tasks.items()}
        return self.client.set(path, data)
    
    def start(self):
        """Start the scheduler loop"""
        self.running = True
        self.logger.info('scheduler', 'Scheduler started')
        
        while self.running:
            try:
                self._check_and_run_tasks()
                time.sleep(1)  # Check every second
            except KeyboardInterrupt:
                self.logger.info('scheduler', 'Scheduler stopped by user')
                break
            except Exception as e:
                self.logger.error('scheduler', f'Scheduler error: {str(e)}')
                time.sleep(5)  # Wait before retrying
    
    def stop(self):
        """Stop the scheduler"""
        self.running = False
        self.logger.info('scheduler', 'Scheduler stopping')
    
    def _check_and_run_tasks(self):
        """Check all tasks and run those that are due"""
        for task_id, task in self.tasks.items():
            if task.should_run():
                self._run_task(task)
    
    def _run_task(self, task: TaskConfig):
        """
        Run a single task
        
        Args:
            task: Task configuration
        """
        task.mark_running()
        self._save_tasks_to_firebase()
        
        self.logger.info('scheduler', f'Running task: {task.name}', {'task_id': task.id})
        
        try:
            # Execute the script
            result = subprocess.run(
                [sys.executable, task.script_path],
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )
            
            if result.returncode == 0:
                task.mark_success()
                self.logger.info('scheduler', f'Task completed: {task.name}', {
                    'task_id': task.id,
                    'output': result.stdout[:500]  # Truncate long output
                })
            else:
                error_msg = result.stderr[:500] if result.stderr else 'Unknown error'
                task.mark_error(error_msg)
                self.logger.error('scheduler', f'Task failed: {task.name}', {
                    'task_id': task.id,
                    'error': error_msg
                })
        except subprocess.TimeoutExpired:
            error_msg = 'Task timed out after 5 minutes'
            task.mark_error(error_msg)
            self.logger.error('scheduler', f'Task timeout: {task.name}', {'task_id': task.id})
        except Exception as e:
            error_msg = str(e)
            task.mark_error(error_msg)
            self.logger.error('scheduler', f'Task error: {task.name}', {
                'task_id': task.id,
                'error': error_msg
            })
        
        self._save_tasks_to_firebase()
    
    def trigger_task(self, task_id: str) -> Dict[str, Any]:
        """
        Manually trigger a task
        
        Args:
            task_id: Task ID to trigger
            
        Returns:
            Result dict
        """
        if task_id not in self.tasks:
            return {'success': False, 'error': 'Task not found'}
        
        task = self.tasks[task_id]
        self._run_task(task)
        
        return {
            'success': True,
            'task_id': task_id,
            'status': task.last_status,
            'error_message': task.error_message
        }
    
    def update_task_config(self, task_id: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update task configuration
        
        Args:
            task_id: Task ID to update
            config: New configuration
            
        Returns:
            Result dict
        """
        if task_id not in self.tasks:
            return {'success': False, 'error': 'Task not found'}
        
        task = self.tasks[task_id]
        
        if 'interval_seconds' in config:
            task.interval_seconds = config['interval_seconds']
        if 'enabled' in config:
            task.enabled = config['enabled']
        
        self._save_tasks_to_firebase()
        self.logger.info('scheduler', f'Task config updated: {task.name}', {'task_id': task_id})
        
        return {'success': True, 'task_id': task_id}
    
    def toggle_task(self, task_id: str) -> Dict[str, Any]:
        """
        Toggle task enabled/disabled
        
        Args:
            task_id: Task ID to toggle
            
        Returns:
            Result dict
        """
        if task_id not in self.tasks:
            return {'success': False, 'error': 'Task not found'}
        
        task = self.tasks[task_id]
        task.enabled = not task.enabled
        
        self._save_tasks_to_firebase()
        self.logger.info('scheduler', f'Task toggled: {task.name}', {
            'task_id': task_id,
            'enabled': task.enabled
        })
        
        return {'success': True, 'task_id': task_id, 'enabled': task.enabled}
    
    def get_status(self) -> Dict[str, Any]:
        """
        Get scheduler status
        
        Returns:
            Status dict with all tasks
        """
        return {
            'running': self.running,
            'tasks': {task_id: task.to_dict() for task_id, task in self.tasks.items()}
        }
