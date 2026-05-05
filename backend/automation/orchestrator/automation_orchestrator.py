"""
Automation Orchestrator
Central coordinator for all automation activities
Bridges automation components with host control app via WebSocket
"""

import asyncio
import json
import threading
import time
from typing import Dict, List, Optional, Any, Callable
from datetime import datetime
from dataclasses import dataclass, asdict
from enum import Enum

from ..base.firebase_client import FirebaseClient
from ..scheduler.websocket_logger import WebSocketLogger
from ..notifications.notification_integration import NotificationIntegration, initialize_notifications
from .match_manager import MatchManager
from .scraper_manager import ScraperManager
from .scoring_engine import ScoringEngine
from .status_monitor import StatusMonitor


class AutomationStatus(Enum):
    IDLE = "idle"
    RUNNING = "running"
    ERROR = "error"
    STOPPED = "stopped"


@dataclass
class AutomationTask:
    task_id: str
    name: str
    type: str  # 'match_creation', 'scraping', 'scoring'
    status: AutomationStatus
    interval_seconds: int = 60
    enabled: bool = True
    last_run: Optional[int] = None
    next_run: Optional[int] = None
    error_message: Optional[str] = None
    progress: float = 0.0
    metadata: Dict[str, Any] = None

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}
        if isinstance(self.status, str):
            self.status = AutomationStatus(self.status)


class AutomationOrchestrator:
    """
    Central automation coordinator
    Manages all automation tasks and provides WebSocket interface for monitoring
    """
    
    def __init__(self, firebase_client: FirebaseClient, logger: WebSocketLogger):
        self.client = firebase_client
        self.logger = logger
        
        # Core components
        self.match_manager = MatchManager(firebase_client, logger)
        self.scraper_manager = ScraperManager(firebase_client, logger)
        self.scoring_engine = ScoringEngine(firebase_client, logger)
        self.status_monitor = StatusMonitor(firebase_client, logger)
        
        # Notification system
        self.notification_integration: NotificationIntegration = None
        
        # Task management
        self.tasks: Dict[str, AutomationTask] = {}
        self.task_queue: List[str] = []
        self.running_tasks: Dict[str, AutomationTask] = {}
        
        # System state
        self.running = False
        self.start_time = None
        
        # Configuration
        self.config = self._load_config()
        
        # Statistics
        self.stats = {
            'total_tasks_run': 0,
            'successful_tasks': 0,
            'failed_tasks': 0,
            'average_task_duration': 0.0
        }

        # Task handlers
        self.task_handlers = {
            'match_creation': self._handle_match_creation,
            'scraping': self._handle_live_scraping,
            'scoring': self._handle_score_processing
        }

        # Initialize tasks
        self._initialize_tasks()
    
    def _load_config(self) -> Dict[str, Any]:
        """Load automation configuration from Firebase"""
        config = self.client.get('automation_config') or {}
        
        defaults = {
            'match_creation_interval': 300,  # 5 minutes
            'scraping_interval': 60,  # 1 minute
            'scoring_interval': 30,  # 30 seconds
            'auto_match_creation': True,
            'auto_scraping': True,
            'auto_scoring': True,
            'max_concurrent_tasks': 3
        }
        
        return {**defaults, **config}
    
    def _initialize_tasks(self):
        """Initialize automation tasks from Firebase"""
        tasks_data = self.client.get('automation_config/tasks') or {}
        
        if not tasks_data:
            self.logger.info('orchestrator', 'No tasks found in Firebase, creating defaults')
            default_tasks = {
                'match_creation': {
                    'task_id': 'match_creation',
                    'name': 'Match Creation Service',
                    'type': 'match_creation',
                    'status': 'idle',
                    'interval_seconds': 300,
                    'enabled': True
                },
                'live_scraping': {
                    'task_id': 'live_scraping',
                    'name': 'Live Score Scraping',
                    'type': 'scraping',
                    'status': 'idle',
                    'interval_seconds': 60,
                    'enabled': True
                },
                'score_processing': {
                    'task_id': 'score_processing',
                    'name': 'Score Processing Engine',
                    'type': 'scoring',
                    'status': 'idle',
                    'interval_seconds': 30,
                    'enabled': True
                }
            }
            self.client.set('automation_config/tasks', default_tasks)
            tasks_data = default_tasks

        for task_id, data in tasks_data.items():
            self.tasks[task_id] = AutomationTask(**data)
            # Schedule initial run if not already scheduled
            if not self.tasks[task_id].next_run:
                self._schedule_next_run(self.tasks[task_id])
    
    async def start(self):
        """Start the automation orchestrator"""
        self.running = True
        self.logger.info('orchestrator', 'Starting automation orchestrator')
        
        # Initialize notification system
        try:
            self.notification_integration = await initialize_notifications(self.client, self.logger)
            self.logger.info('orchestrator', 'Notification system initialized')
        except Exception as e:
            self.logger.error('orchestrator', f'Failed to initialize notifications: {str(e)}')
        
        # Start component managers
        self.match_manager.start()
        self.scraper_manager.start()
        self.scoring_engine.start()
        self.status_monitor.start()
        
        # Send automation started notification
        if self.notification_integration:
            await self.notification_integration.on_automation_started({
                'components': ['match_manager', 'scraper_manager', 'scoring_engine', 'status_monitor'],
                'mode': 'production',
                'timestamp': datetime.now().isoformat()
            })
        
        # Start main orchestration loop
        self._orchestration_loop()
    
    async def stop(self):
        """Stop the automation orchestrator"""
        self.running = False
        self.logger.info('orchestrator', 'Stopping automation orchestrator')
        
        # Send automation stopped notification
        if self.notification_integration:
            try:
                uptime = datetime.now() - self.start_time if self.start_time else None
                await self.notification_integration.on_automation_stopped({
                    'reason': 'manual_stop',
                    'uptime': str(uptime) if uptime else 'unknown',
                    'timestamp': datetime.now().isoformat()
                })
            except Exception as e:
                self.logger.error('orchestrator', f'Failed to send stop notification: {str(e)}')
        
        # Stop component managers
        self.match_manager.stop()
        self.scraper_manager.stop()
        self.scoring_engine.stop()
        self.status_monitor.stop()
        
        # Stop notification system
        if self.notification_integration:
            try:
                await self.notification_integration.stop()
            except Exception as e:
                self.logger.error('orchestrator', f'Failed to stop notifications: {str(e)}')
    
    def _orchestration_loop(self):
        """Main orchestration loop"""
        while self.running:
            try:
                current_time = int(time.time() * 1000)
                
                # Check and run due tasks
                for task_id, task in self.tasks.items():
                    if task.enabled and task.status == AutomationStatus.IDLE and task.next_run and current_time >= task.next_run:
                        self._run_task(task_id)
                
                # Update status
                self._update_overall_status()
                
                # Sleep for short interval
                time.sleep(1)
                
            except Exception as e:
                self.logger.error('orchestrator', f'Orchestration loop error: {str(e)}')
                time.sleep(5)
    
    def _run_task(self, task_id: str):
        """Run a specific automation task"""
        if task_id not in self.tasks:
            self.logger.error('orchestrator', f'Unknown task: {task_id}')
            return
        
        task = self.tasks[task_id]
        handler = self.task_handlers.get(task.type)
        
        if not handler:
            self.logger.error('orchestrator', f'No handler for task type: {task.type}')
            return
        
        # Update task status
        task.status = AutomationStatus.RUNNING
        task.last_run = int(time.time() * 1000)
        task.progress = 0.0
        task.error_message = None
        
        # Broadcast status update
        self._broadcast_task_update(task)
        
        try:
            # Run the task handler
            handler(task)
            
            # Mark as completed
            task.status = AutomationStatus.IDLE
            task.progress = 100.0
            
            # Schedule next run
            self._schedule_next_run(task)
            
        except Exception as e:
            task.status = AutomationStatus.ERROR
            task.error_message = str(e)
            self.logger.error('orchestrator', f'Task {task_id} failed: {str(e)}')
        
        # Broadcast final status
        self._broadcast_task_update(task)
    
    def _handle_match_creation(self, task: AutomationTask):
        """Handle match creation task"""
        self.logger.info('orchestrator', 'Starting match creation task')
        
        # Update progress
        task.progress = 10.0
        self._broadcast_task_update(task)
        
        # Get upcoming matches from external sources
        upcoming_matches = self.match_manager.fetch_upcoming_matches()
        
        task.progress = 50.0
        self._broadcast_task_update(task)
        
        # Create matches in Firebase if they don't exist
        created_count = 0
        for match in upcoming_matches:
            if self.match_manager.create_match_if_not_exists(match):
                created_count += 1
        
        task.progress = 100.0
        task.metadata['matches_processed'] = len(upcoming_matches)
        task.metadata['matches_created'] = created_count
        
        self.logger.info('orchestrator', f'Match creation completed: {created_count}/{len(upcoming_matches)} matches created')
    
    def _handle_live_scraping(self, task: AutomationTask):
        """Handle live scraping task"""
        self.logger.info('orchestrator', 'Starting live scraping task')
        
        # Get active matches
        active_matches = self.match_manager.get_active_matches()
        
        total_matches = len(active_matches)
        if total_matches == 0:
            task.progress = 100.0
            task.metadata['matches_scraped'] = 0
            return
        
        processed_count = 0
        
        for i, match in enumerate(active_matches):
            try:
                # Scrape live score
                score_data = self.scraper_manager.scrape_match_score(match)
                
                if score_data:
                    # Update match with live score
                    self.match_manager.update_match_score(match['id'], score_data)
                    processed_count += 1
                
                # Update progress
                task.progress = ((i + 1) / total_matches) * 100
                self._broadcast_task_update(task)
                
            except Exception as e:
                self.logger.error('orchestrator', f'Failed to scrape match {match["id"]}: {str(e)}')
        
        task.metadata['matches_scraped'] = processed_count
        task.metadata['total_matches'] = total_matches
        
        self.logger.info('orchestrator', f'Live scraping completed: {processed_count}/{total_matches} matches updated')
    
    def _handle_score_processing(self, task: AutomationTask):
        """Handle score processing task"""
        self.logger.info('orchestrator', 'Starting score processing task')
        
        # Get matches that need score processing
        matches_to_process = self.scoring_engine.get_matches_needing_processing()
        
        total_matches = len(matches_to_process)
        if total_matches == 0:
            task.progress = 100.0
            task.metadata['matches_processed'] = 0
            return
        
        processed_count = 0
        
        for i, match in enumerate(matches_to_process):
            try:
                # Process scores for the match
                result = self.scoring_engine.process_match_scores(match)
                
                if result['success']:
                    processed_count += 1
                
                # Update progress
                task.progress = ((i + 1) / total_matches) * 100
                self._broadcast_task_update(task)
                
            except Exception as e:
                self.logger.error('orchestrator', f'Failed to process scores for match {match["id"]}: {str(e)}')
        
        task.metadata['matches_processed'] = processed_count
        task.metadata['total_matches'] = total_matches
        
        self.logger.info('orchestrator', f'Score processing completed: {processed_count}/{total_matches} matches processed')
    
    def _schedule_next_run(self, task: AutomationTask):
        """Schedule next run for a task"""
        interval = task.interval_seconds
        task.next_run = int(time.time() * 1000) + (interval * 1000)
        self._save_tasks()
    
    def _update_overall_status(self):
        """Update overall automation status"""
        self.status_monitor.update_automation_status(self.tasks)
    
    def _broadcast_task_update(self, task: AutomationTask):
        """Broadcast task update via WebSocket and save to Firebase"""
        task_dict = asdict(task)
        # Convert Enum to string for JSON serialization
        if isinstance(task_dict['status'], AutomationStatus):
            task_dict['status'] = task_dict['status'].value
            
        message = {
            'type': 'task_update',
            'task': task_dict,
            'timestamp': int(time.time() * 1000)
        }
        
        self.logger.broadcast('automation', json.dumps(message))
        self._save_tasks()

    def _save_tasks(self):
        """Save all tasks to Firebase"""
        tasks_data = {}
        for task_id, task in self.tasks.items():
            task_dict = asdict(task)
            if isinstance(task_dict['status'], AutomationStatus):
                task_dict['status'] = task_dict['status'].value
            tasks_data[task_id] = task_dict
            
        self.client.set('automation_config/tasks', tasks_data)
    
    def get_status(self) -> Dict[str, Any]:
        """Get current automation status"""
        return {
            'running': self.running,
            'tasks': {task_id: asdict(task) for task_id, task in self.tasks.items()},
            'config': self.config,
            'component_status': {
                'match_manager': self.match_manager.get_status(),
                'scraper_manager': self.scraper_manager.get_status(),
                'scoring_engine': self.scoring_engine.get_status(),
                'status_monitor': self.status_monitor.get_status()
            }
        }
    
    def trigger_task(self, task_id: str) -> Dict[str, Any]:
        """Manually trigger a task"""
        if task_id not in self.tasks:
            return {'success': False, 'error': 'Task not found'}
        
        task = self.tasks[task_id]
        if task.status == AutomationStatus.RUNNING:
            return {'success': False, 'error': 'Task already running'}
        
        # Run the task in a separate thread to avoid blocking
        threading.Thread(target=self._run_task, args=(task_id,)).start()
        
        return {'success': True, 'task_id': task_id}
    
    def update_config(self, new_config: Dict[str, Any]) -> Dict[str, Any]:
        """Update automation configuration"""
        self.config.update(new_config)
        
        # Save to Firebase
        self.client.set('automation_config', self.config)
        
        self.logger.info('orchestrator', f'Configuration updated: {new_config}')
        
        return {'success': True, 'config': self.config}

    def add_task(self, task_data: Dict[str, Any]) -> Dict[str, Any]:
        """Add a new automation task"""
        task_id = task_data.get('task_id')
        if not task_id:
            return {'success': False, 'error': 'task_id is required'}
        
        if task_id in self.tasks:
            return {'success': False, 'error': f'Task {task_id} already exists'}
        
        try:
            # Ensure status is string for initialization
            if 'status' not in task_data:
                task_data['status'] = 'idle'
            
            task = AutomationTask(**task_data)
            self.tasks[task_id] = task
            self._schedule_next_run(task)
            self._broadcast_task_update(task)
            
            self.logger.info('orchestrator', f'Task added: {task.name}', {'task_id': task_id})
            return {'success': True, 'task': asdict(task)}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def update_task(self, task_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing automation task"""
        if task_id not in self.tasks:
            return {'success': False, 'error': 'Task not found'}
        
        task = self.tasks[task_id]
        
        for key, value in updates.items():
            if hasattr(task, key) and key != 'task_id':
                if key == 'status' and isinstance(value, str):
                    setattr(task, key, AutomationStatus(value))
                else:
                    setattr(task, key, value)
        
        # If interval changed, reschedule
        if 'interval_seconds' in updates:
            self._schedule_next_run(task)
            
        self._broadcast_task_update(task)
        self.logger.info('orchestrator', f'Task updated: {task.name}', {'task_id': task_id})
        
        return {'success': True, 'task': asdict(task)}

    def delete_task(self, task_id: str) -> Dict[str, Any]:
        """Delete an automation task"""
        if task_id not in self.tasks:
            return {'success': False, 'error': 'Task not found'}
        
        # Don't allow deleting core tasks
        core_tasks = ['match_creation', 'live_scraping', 'score_processing']
        if task_id in core_tasks:
            return {'success': False, 'error': 'Cannot delete core automation tasks'}
            
        task = self.tasks.pop(task_id)
        self._save_tasks()
        
        # Broadcast deletion (can send a special message or just update tasks)
        message = {
            'type': 'task_deleted',
            'task_id': task_id,
            'timestamp': int(time.time() * 1000)
        }
        self.logger.broadcast('automation', json.dumps(message))
        
        self.logger.info('orchestrator', f'Task deleted: {task.name}', {'task_id': task_id})
        return {'success': True, 'task_id': task_id}

    def toggle_task(self, task_id: str) -> Dict[str, Any]:
        """Toggle a task's enabled status"""
        if task_id not in self.tasks:
            return {'success': False, 'error': 'Task not found'}
        
        task = self.tasks[task_id]
        task.enabled = not task.enabled
        
        if task.enabled:
            self._schedule_next_run(task)
            
        self._broadcast_task_update(task)
        self.logger.info('orchestrator', f'Task {"enabled" if task.enabled else "disabled"}: {task.name}', {'task_id': task_id})
        
        return {'success': True, 'task_id': task_id, 'enabled': task.enabled}
