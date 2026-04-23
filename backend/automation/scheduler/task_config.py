"""
Task configuration model for scheduler
"""

from typing import Dict, Any, Optional
from datetime import datetime


class TaskConfig:
    """Configuration for a scheduled task"""
    
    def __init__(self, task_id: str, name: str, script_path: str, 
                 interval_seconds: int = 60, enabled: bool = True):
        """
        Initialize task configuration
        
        Args:
            task_id: Unique task identifier
            name: Human-readable task name
            script_path: Path to Python script to execute
            interval_seconds: Run interval in seconds
            enabled: Whether task is enabled
        """
        self.id = task_id
        self.name = name
        self.script_path = script_path
        self.interval_seconds = interval_seconds
        self.enabled = enabled
        self.last_run: Optional[int] = None
        self.last_status: str = 'idle'  # idle, running, success, error
        self.next_run: Optional[int] = None
        self.error_message: Optional[str] = None
        self.run_count: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for Firebase storage"""
        return {
            'id': self.id,
            'name': self.name,
            'script_path': self.script_path,
            'interval_seconds': self.interval_seconds,
            'enabled': self.enabled,
            'last_run': self.last_run,
            'last_status': self.last_status,
            'next_run': self.next_run,
            'error_message': self.error_message,
            'run_count': self.run_count
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'TaskConfig':
        """Create from dictionary"""
        task = cls(
            task_id=data['id'],
            name=data['name'],
            script_path=data['script_path'],
            interval_seconds=data.get('interval_seconds', 60),
            enabled=data.get('enabled', True)
        )
        task.last_run = data.get('last_run')
        task.last_status = data.get('last_status', 'idle')
        task.next_run = data.get('next_run')
        task.error_message = data.get('error_message')
        task.run_count = data.get('run_count', 0)
        return task
    
    def should_run(self) -> bool:
        """Check if task should run based on interval"""
        if not self.enabled:
            return False
        
        if self.last_status == 'running':
            return False
        
        if self.next_run is None:
            return True
        
        now = int(datetime.now().timestamp() * 1000)
        return now >= self.next_run
    
    def mark_running(self):
        """Mark task as running"""
        self.last_status = 'running'
        self.last_run = int(datetime.now().timestamp() * 1000)
    
    def mark_success(self):
        """Mark task as successful"""
        self.last_status = 'success'
        self.error_message = None
        self.run_count += 1
        self._schedule_next_run()
    
    def mark_error(self, error_message: str):
        """Mark task as failed"""
        self.last_status = 'error'
        self.error_message = error_message
        self.run_count += 1
        self._schedule_next_run()
    
    def _schedule_next_run(self):
        """Schedule next run based on interval"""
        now = int(datetime.now().timestamp() * 1000)
        self.next_run = now + (self.interval_seconds * 1000)
