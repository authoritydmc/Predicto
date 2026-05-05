"""
Automation Orchestrator
Central coordinator for all automation activities
Bridges automation components with host control app via WebSocket
"""

import asyncio
import json
import threading
import time
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from enum import Enum
import re

from ..base.firebase_client import FirebaseClient
from ..scheduler.websocket_logger import WebSocketLogger
from ..notifications.notification_integration import NotificationIntegration, initialize_notifications
from .match_manager import MatchManager
from .scraper_manager import ScraperManager
from .scoring_engine import ScoringEngine
from .status_monitor import StatusMonitor
from .job_logger import JobLogger

try:
    from croniter import croniter
except ImportError:
    croniter = None


class AutomationStatus(Enum):
    IDLE = "idle"
    RUNNING = "running"
    ERROR = "error"
    STOPPED = "stopped"


@dataclass
class AutomationTask:
    task_id: str
    name: str
    type: str  # 'match_creation', 'scraping', 'scoring', 'reconciliation'
    status: AutomationStatus
    interval_seconds: int = 60
    cron_expression: Optional[str] = None
    enabled: bool = True
    logging_enabled: bool = True
    is_adaptive: bool = False  # If True, adjusts frequency based on match state
    last_run: Optional[int] = None
    next_run: Optional[int] = None
    error_message: Optional[str] = None
    progress: float = 0.0
    metadata: Dict[str, Any] = None

    def __post_init__(self):
        if isinstance(self.status, str):
            try:
                self.status = AutomationStatus(self.status)
            except ValueError:
                self.status = AutomationStatus.IDLE
        if self.metadata is None:
            self.metadata = {}


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

        # Job Logging
        self.job_logger = JobLogger()
        self.enable_job_logging = self.config.get('enable_job_logging', True)

        # Task handlers
        self.task_handlers: Dict[str, Callable] = {
            'match_creation': self._handle_match_creation,
            'scraping': self._handle_live_scraping,
            'reconciliation': self._handle_match_reconciliation
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
        
        # Define IPL default tasks
        ipl_defaults = {
            'ipl_match_discovery': {
                'task_id': 'ipl_match_discovery',
                'name': 'IPL Match Discovery',
                'type': 'match_creation',
                'status': 'idle',
                'cron_expression': '0 10 * * *',
                'enabled': True
            },
            'ipl_live_scraping': {
                'task_id': 'ipl_live_scraping',
                'name': 'IPL Live Scraping (Adaptive)',
                'type': 'scraping',
                'status': 'idle',
                'interval_seconds': 60,
                'enabled': True,
                'is_adaptive': True
            },
            'ipl_reconciliation': {
                'task_id': 'ipl_reconciliation',
                'name': 'IPL Daily Reconciliation',
                'type': 'reconciliation',
                'status': 'idle',
                'cron_expression': '0 0 * * *',
                'enabled': True
            }
        }
        
        # Check if IPL defaults exist, if not, add them
        any_added = False
        for task_id, default_task in ipl_defaults.items():
            if task_id not in tasks_data:
                self.logger.info('orchestrator', f'Adding missing default task: {task_id}')
                tasks_data[task_id] = default_task
                any_added = True
        
        if any_added:
            self.client.set('automation_config/tasks', tasks_data)
            
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
        
        # Start main orchestration loop as a background task
        asyncio.create_task(self._orchestration_loop())
        
        # Start cleanup loop
        asyncio.create_task(self._cleanup_loop())
        
        # Broadcast initial state
        self._broadcast_tasks_full()
        self._broadcast_status()
    
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
    
    async def _orchestration_loop(self):
        """Main orchestration loop (Asynchronous)"""
        self.start_time = datetime.now()
        while self.running:
            try:
                current_time = int(time.time() * 1000)
                
                # Process tasks
                for task_id, task in self.tasks.items():
                    if task.enabled and task.status == AutomationStatus.IDLE and task.next_run and current_time >= task.next_run:
                        # Run in background to not block other tasks
                        asyncio.create_task(self._run_task(task_id))
                
                # Periodically broadcast status
                self._broadcast_status()
                
                # Sleep for short interval without blocking loop
                await asyncio.sleep(1)
                
            except Exception as e:
                self.logger.error('orchestrator', f'Orchestration loop error: {str(e)}')
                await asyncio.sleep(5)
    
    async def _run_task(self, task_id: str):
        """Run a specific automation task (Asynchronous)"""
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
        
        # Job Logging
        job_id = None
        if self.enable_job_logging and task.logging_enabled:
            job_id = self.job_logger.log_job_start(task.task_id, task.name)
        
        # Broadcast status update
        self._broadcast_task_update(task)
        
        try:
            # Run the task handler (await if it's async)
            if asyncio.iscoroutinefunction(handler):
                await handler(task)
            else:
                # If sync, run in thread to avoid blocking loop
                await asyncio.to_thread(handler, task)
            
            # Mark as completed
            task.status = AutomationStatus.IDLE
            task.progress = 100.0
            
            # Schedule next run
            self._schedule_next_run(task)
            
            # Log success
            if job_id:
                self.job_logger.log_job_finish(job_id, 'completed', metadata=task.metadata)
            
        except Exception as e:
            task.status = AutomationStatus.ERROR
            task.error_message = str(e)
            self.logger.error('orchestrator', f'Task {task_id} failed: {str(e)}')
            
            # Log failure
            if job_id:
                self.job_logger.log_job_finish(job_id, 'error', error=str(e), metadata=task.metadata)
        
        # Broadcast final status
        self._broadcast_task_update(task)
    
    async def _handle_match_creation(self, task: AutomationTask):
        """Handle match creation task (Asynchronous)"""
        self.logger.info('orchestrator', 'Starting match creation task')
        
        # Update progress
        task.progress = 10.0
        self._broadcast_task_update(task)
        
        # Get upcoming matches from external sources
        # fetch_upcoming_matches is sync, so run in thread
        upcoming_matches = await asyncio.to_thread(self.match_manager.fetch_upcoming_matches)
        
        task.progress = 50.0
        self._broadcast_task_update(task)
        
        # Create matches in Firebase if they don't exist
        created_count = 0
        for match in upcoming_matches:
            # create_match_if_not_exists is sync
            result = await asyncio.to_thread(self.match_manager.create_match_if_not_exists, match)
            if result:
                created_count += 1
                # Trigger notification for newly created match
                if self.notification_integration:
                    try:
                        # Extract data for notification
                        match_data = {
                            'team_a': match.team_a,
                            'team_b': match.team_b,
                            'date': datetime.fromtimestamp(match.scheduled_time / 1000).strftime('%Y-%m-%d %H:%M'),
                            'venue': match.venue,
                            'sport': 'Cricket',
                            'tournament_id': match.tournament_id
                        }
                        await self.notification_integration.on_match_created(match_data)
                    except Exception as e:
                        self.logger.error('orchestrator', f'Failed to send match creation notification: {str(e)}')
        
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
        current_time_ms = int(time.time() * 1000)
        
        for i, match in enumerate(active_matches):
            try:
                # Check adaptive logic if enabled
                if task.is_adaptive:
                    score = match.get('liveScore', {})
                    # Overs are usually string or float like "12.4"
                    overs_str = score.get('overs', '0.0')
                    try:
                        overs = float(overs_str)
                    except (ValueError, TypeError):
                        overs = 0.0
                    
                    last_update = match.get('lastScoreUpdate', 0)
                    
                    # Adaptive Logic:
                    # - Start (0-5 overs): High frequency (every run)
                    # - End (15+ overs): High frequency (every run)
                    # - Middle (5-15 overs): Low frequency (every 5 mins)
                    is_critical_phase = overs <= 5.0 or overs >= 15.0
                    is_middle_overs = 5.0 < overs < 15.0
                    
                    if is_middle_overs:
                        # Skip if updated within the last 5 minutes
                        if current_time_ms - last_update < 300000:
                            self.logger.debug('orchestrator', f'Skipping adaptive scrape for match {match.get("matchId")} (Overs: {overs})')
                            continue
                
                # Scrape live score
                score_data = self.scraper_manager.scrape_match_score(match)
                
                if score_data:
                    # Update match with live score
                    self.match_manager.update_match_score(match.get('matchId') or match.get('id'), score_data)
                    processed_count += 1
                
                # Update progress
                task.progress = ((i + 1) / total_matches) * 100
                self._broadcast_task_update(task)
                
            except Exception as e:
                self.logger.error('orchestrator', f'Failed to scrape match {match.get("matchId") or match.get("id")}: {str(e)}')
        
        task.metadata['matches_scraped'] = processed_count
        task.metadata['total_matches'] = total_matches
        
        self.logger.info('orchestrator', f'Live scraping completed: {processed_count}/{total_matches} matches updated')
    
    def _handle_match_reconciliation(self, task: AutomationTask):
        """Handle match reconciliation task"""
        self.logger.info('orchestrator', 'Starting match reconciliation task')
        
        # Get matches that need reconciliation
        matches_to_process = self.scoring_engine.get_matches_needing_processing()
        
        total_matches = len(matches_to_process)
        if total_matches == 0:
            task.progress = 100.0
            task.metadata['matches_reconciled'] = 0
            return
        
        processed_count = 0
        
        for i, match in enumerate(matches_to_process):
            try:
                # Process scores and leaderboard for the match
                result = self.scoring_engine.process_match_scores(match)
                
                if result['success']:
                    processed_count += 1
                
                # Update progress
                task.progress = ((i + 1) / total_matches) * 100
                self._broadcast_task_update(task)
                
            except Exception as e:
                self.logger.error('orchestrator', f'Failed to reconcile match {match.get("id")}: {str(e)}')
        
        task.metadata['matches_reconciled'] = processed_count
        task.metadata['total_matches'] = total_matches
        
        self.logger.info('orchestrator', f'Match reconciliation completed: {processed_count}/{total_matches} matches processed')
    
    def _schedule_next_run(self, task: AutomationTask):
        """Schedule next run for a task"""
        if task.cron_expression and croniter:
            try:
                # Get current time or last run time as base
                base_time = datetime.fromtimestamp((task.last_run or int(time.time() * 1000)) / 1000)
                iter = croniter(task.cron_expression, base_time)
                next_date = iter.get_next(datetime)
                task.next_run = int(next_date.timestamp() * 1000)
            except Exception as e:
                self.logger.error('orchestrator', f'Failed to parse cron for task {task.task_id}: {str(e)}')
                # Fallback to interval
                interval = task.interval_seconds
                task.next_run = int(time.time() * 1000) + (interval * 1000)
        else:
            interval = task.interval_seconds
            task.next_run = int(time.time() * 1000) + (interval * 1000)
            
        self._save_tasks()

    async def _cleanup_loop(self):
        """Periodic cleanup of old job logs"""
        while self.running:
            try:
                days = self.config.get('log_retention_days', 15)
                count = self.job_logger.clear_old_logs(days=days)
                if count > 0:
                    self.logger.info('orchestrator', f'Purged {count} old job logs (older than {days} days)')
                
                # Sleep for 12 hours between cleanups
                await asyncio.sleep(12 * 3600)
            except Exception as e:
                self.logger.error('orchestrator', f'Cleanup loop error: {str(e)}')
                await asyncio.sleep(3600)
    
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
        tasks_dict = {}
        for task_id, task in self.tasks.items():
            t_dict = asdict(task)
            if isinstance(t_dict['status'], AutomationStatus):
                t_dict['status'] = t_dict['status'].value
            tasks_dict[task_id] = t_dict

        return {
            'running': self.running,
            'automation_status': {
                'orchestrator_running': self.running,
                'total_tasks': len(self.tasks),
                'running_tasks': sum(1 for t in self.tasks.values() if t.status == AutomationStatus.RUNNING),
                'error_tasks': sum(1 for t in self.tasks.values() if t.status == AutomationStatus.ERROR),
                'last_cleanup': self.last_cleanup_time,
                'tasks': tasks_dict
            },
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
        
        # Run the task in the background
        asyncio.create_task(self._run_task(task_id))
        
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
        # Auto-generate task ID if not provided
        if not task_data.get('task_id') and task_data.get('name'):
            name_slug = re.sub(r'[^a-z0-9]+', '_', task_data['name'].lower()).strip('_')
            # Ensure uniqueness
            task_id = name_slug
            counter = 1
            while task_id in self.tasks:
                task_id = f"{name_slug}_{counter}"
                counter += 1
            task_data['task_id'] = task_id

        task_id = task_data.get('task_id')
        if not task_id:
            return {'success': False, 'error': 'task_id or name is required'}
        
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

    def get_job_history(self, task_id: Optional[str] = None, limit: int = 50) -> Dict[str, Any]:
        """Get job execution history from SQLite"""
        try:
            history = self.job_logger.get_history(task_id, limit)
            return {'success': True, 'history': history}
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
    def _broadcast_task_update(self, task: AutomationTask):
        """Broadcast single task update via WebSocket"""
        message = {
            'type': 'task_update',
            'data': {
                'task': asdict(task)
            },
            'timestamp': int(time.time() * 1000)
        }
        self.logger.broadcast('automation', json.dumps(message))

    def _broadcast_tasks_full(self):
        """Broadcast all tasks via WebSocket"""
        tasks_dict = {}
        for task_id, task in self.tasks.items():
            t_dict = asdict(task)
            if isinstance(t_dict['status'], AutomationStatus):
                t_dict['status'] = t_dict['status'].value
            tasks_dict[task_id] = t_dict

        message = {
            'type': 'tasks_full',
            'data': tasks_dict,
            'timestamp': int(time.time() * 1000)
        }
        self.logger.broadcast('automation', json.dumps(message))

    def _broadcast_status(self):
        """Broadcast system status via WebSocket"""
        status = self.get_status()
        message = {
            'type': 'status_update',
            'data': {
                'automation_status': {
                    'orchestrator_running': self.running,
                    'total_tasks': len(self.tasks),
                    'running_tasks': sum(1 for t in self.tasks.values() if t.status == AutomationStatus.RUNNING),
                    'error_tasks': sum(1 for t in self.tasks.values() if t.status == AutomationStatus.ERROR),
                    'last_cleanup': self.last_cleanup_time
                },
                'component_health': status.get('component_status', {})
            },
            'timestamp': int(time.time() * 1000)
        }
        self.logger.broadcast('automation', json.dumps(message))
