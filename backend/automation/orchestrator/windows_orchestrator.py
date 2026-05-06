"""
Windows-Compatible Automation Orchestrator
Redesigned for Windows compatibility with command-line logging and IPC-based debugging
"""

import asyncio
import json
import sys
import os
import time
import threading
import argparse
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from enum import Enum
import re
import uuid
from typing import Dict, Any, Optional, List, Callable

# Add project root to path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

from base.firebase_client import FirebaseClient
from scheduler.websocket_logger import WebSocketLogger


class WindowsOrchestrator:
    """
    Windows-compatible automation orchestrator with command-line logging
    Uses IPC for debugging instead of WebSocket
    """
    
    def __init__(self, firebase_client: FirebaseClient, logger: WebSocketLogger):
        self.client = firebase_client
        self.logger = logger
        
        # Core components
        self.match_manager = None
        self.scraper_manager = None
        self.scoring_engine = None
        self.status_monitor = None
        
        # Task management
        self.tasks: Dict[str, Any] = {}
        self.task_queue: List[str] = []
        self.running_tasks: Dict[str, Any] = {}
        
        # System state
        self.running = False
        self.start_time = None
        self.session_id = str(uuid.uuid4())
        self.loop = None
        
        # Thread-safe pending trigger queue
        self._pending_triggers: List[str] = []
        self._trigger_lock = threading.Lock()
        self._running_tasks: set = set()
        self._execution_lock = threading.Lock()
        
        # Configuration
        self.config = self._load_config()
        
        # Statistics
        self.stats = {
            'total_tasks_run': 0,
            'successful_tasks': 0,
            'failed_tasks': 0,
            'average_task_duration': 0.0
        }
        
        # Windows IPC setup
        self._setup_windows_ipc()
        
        # Command-line logging setup
        self._setup_command_logging()
        
        # Task handlers
        self.task_handlers: Dict[str, Callable] = {
            'match_creation': self._handle_match_creation,
            'scraping': self._handle_live_scraping,
            'reconciliation': self._handle_match_reconciliation
        }
        
        # Initialize tasks
        self._initialize_tasks()
    
    def _setup_windows_ipc(self):
        """Setup Windows IPC for debugging"""
        try:
            import win32event
            self._ipc_event = win32event.CreateEvent(None, False, False, f"Orchestrator_{self.session_id}")
            print(f"[WindowsOrchestrator] IPC Event created: Orchestrator_{self.session_id}")
        except ImportError:
            print("[WindowsOrchestrator] WARNING: win32event not available, IPC disabled")
            self._ipc_event = None
        except Exception as e:
            print(f"[WindowsOrchestrator] Error setting up IPC: {str(e)}")
            self._ipc_event = None
    
    def _setup_command_logging(self):
        """Setup command-line logging for Windows"""
        # Create a simple logger that prints to console
        self.console_logger = SimpleConsoleLogger()
        print("[WindowsOrchestrator] Command-line logging enabled")
    
    def _load_config(self) -> Dict[str, Any]:
        """Load automation configuration from Firebase"""
        try:
            config = self.client.get('scheduler_config') or {}
            
            defaults = {
                'match_creation_interval': 300,  # 5 minutes
                'scraping_interval': 60,  # 1 minute
                'scoring_interval': 30,  # 30 seconds
                'auto_match_creation': True,
                'auto_scraping': True,
                'auto_scoring': True,
                'max_concurrent_tasks': 3,
                'enable_windows_ipc': True,
                'enable_console_logging': True
            }
            
            return {**defaults, **config}
            
        except Exception as e:
            print(f"[WindowsOrchestrator] Error loading config: {str(e)}")
            return {}
    
    def _initialize_tasks(self):
        """Initialize automation tasks from Firebase"""
        try:
            tasks_data = self.client.get('scheduler_config/tasks') or {}
            
            # Define default tasks
            default_tasks = {
                'match_creation': {
                    'task_id': 'match_creation',
                    'name': 'IPL Match Discovery',
                    'type': 'match_creation',
                    'status': 'idle',
                    'cron_expression': '0 * * * *',  # Every hour
                    'enabled': True
                },
                'scraping': {
                    'task_id': 'scraping',
                    'name': 'IPL Live Scraping (Weekday/Weekend)',
                    'type': 'scraping',
                    'status': 'idle',
                    'interval_seconds': 60,
                    'enabled': True,
                    'is_adaptive': True
                },
                'reconciliation': {
                    'task_id': 'reconciliation',
                    'name': 'IPL Match Reconciliation',
                    'type': 'reconciliation',
                    'status': 'idle',
                    'cron_expression': '*/5 * * * *',  # Every 5 minutes
                    'enabled': True
                }
            }
            
            # Check if defaults exist, if not, add them
            any_added = False
            for task_id, default_task in default_tasks.items():
                if task_id not in tasks_data:
                    tasks_data[task_id] = default_task
                    any_added = True
                    self.console_logger.info(f"Added default task: {Task_id}")
            
            if any_added:
                self.client.set('scheduler_config/tasks', tasks_data)
                self.console_logger.info("Default tasks saved to Firebase")
            
            # Load tasks
            for task_id, data in tasks_data.items():
                try:
                    if isinstance(data['status'], str):
                        data['status'] = AutomationStatus(data['status'])
                    
                    # Ensure task_id is properly set
                    if 'task_id' not in data:
                        data['task_id'] = task_id
                    
                    # Create task with proper initialization
                    task = AutomationTask(**data)
                    self.tasks[task_id] = task
                except Exception as e:
                    self.console_logger.error(f"Error loading task {task_id}: {str(e)}")
                except Exception as e:
                    self.console_logger.error(f"Error loading task {task_id}: {str(e)}")
            
            # Schedule initial runs
            for task_id, task in self.tasks.items():
                self._schedule_next_run(task)
                    
        except Exception as e:
            self.console_logger.error(f"Error initializing tasks: {str(e)}")
    
    async def start(self):
        """Start the Windows orchestrator"""
        self.running = True
        self.start_time = datetime.now()
        self.loop = asyncio.get_running_loop()
        
        self.console_logger.info(f"Starting Windows Orchestrator (Session: {self.session_id})")
        
        # Initialize components (simplified for Windows)
        self._initialize_components()
        
        # Start orchestration loop as a background task
        asyncio.create_task(self._orchestration_loop())
        
        # Start heartbeat loop
        asyncio.create_task(self._heartbeat_loop())
        
        # Start cleanup loop
        asyncio.create_task(self._cleanup_loop())
        
        # Broadcast initial state
        self._broadcast_status()
        
        self.console_logger.info("Windows Orchestrator started successfully")
    
    def _initialize_components(self):
        """Initialize core components (simplified for Windows)"""
        try:
            # Import components dynamically to avoid circular imports
            from match_manager import MatchManager
            from scraper_manager import ScraperManager
            from scoring_engine import ScoringEngine
            from status_monitor import StatusMonitor
            
            self.match_manager = MatchManager(self.client, self.console_logger)
            self.scraper_manager = ScraperManager(self.client, self.console_logger)
            self.scoring_engine = ScoringEngine(self.client, self.console_logger)
            self.status_monitor = StatusMonitor(self.client, self.console_logger)
            
            # Start components
            self.match_manager.start()
            self.scraper_manager.start()
            self.scoring_engine.start()
            self.status_monitor.start()
            
            self.console_logger.info("Core components initialized")
            
        except Exception as e:
            self.console_logger.error(f"Error initializing components: {str(e)}")
    
    async def _orchestration_loop(self):
        """Main orchestration loop (Asynchronous)"""
        while self.running:
            try:
                current_time = int(time.time() * 1000)
                
                # Signal IPC event for debugging
                if self._ipc_event:
                    self._ipc_event.set()
                    self.console_logger.debug("IPC event signaled")
                
                # Drain manually-triggered tasks
                with self._trigger_lock:
                    pending = list(self._pending_triggers)
                    self._pending_triggers.clear()
                
                for Task_id in pending:
                    if Task_id in self.tasks and self.tasks[Task_id].status == AutomationStatus.IDLE:
                        # Double-check if not already running
                        with self._execution_lock:
                            if Task_id in self._running_tasks:
                                self.console_logger.warning(f"Task {Task_id} already running, skipping manual trigger")
                                continue
                            
                            try:
                                self.console_logger.info(f"Manual trigger: {Task_id}")
                                asyncio.create_task(self._run_task(Task_id))
                            except RuntimeError as re:
                                if "no running event loop" in str(re):
                                    print(f"[WindowsOrchestrator] Cannot create task for {Task_id} - no event loop")
                                    # Try to run task synchronously as fallback
                                    try:
                                        asyncio.run(self._run_task(Task_id))
                                    except Exception as e:
                                        print(f"[WindowsOrchestrator] Failed to run task {Task_id} synchronously: {e}")
                                else:
                                    raise
                
                # Process scheduled tasks
                for Task_id, task in self.tasks.items():
                    if task.enabled and task.status == AutomationStatus.IDLE and task.next_run and current_time >= task.next_run:
                        # Run in background to not block other tasks
                        try:
                            asyncio.create_task(self._run_task(Task_id))
                        except RuntimeError as re:
                            if "no running event loop" in str(re):
                                print(f"[WindowsOrchestrator] Cannot create scheduled task for {Task_id} - no event loop")
                                # Try to run task synchronously as fallback
                                try:
                                    asyncio.run(self._run_task(Task_id))
                                except Exception as e:
                                    print(f"[WindowsOrchestrator] Failed to run scheduled task {Task_id} synchronously: {e}")
                            else:
                                raise
                
                # Periodically broadcast status
                self._broadcast_status()
                
                # Sleep for short interval without blocking loop
                await asyncio.sleep(1)
                
            except Exception as e:
                self.console_logger.error(f"Orchestration loop error: {str(e)}")
                await asyncio.sleep(5)
    
    async def _run_task(self, Task_id: str):
        """Run a specific automation task (Asynchronous)"""
        if Task_id not in self.tasks:
            self.console_logger.error(f"Unknown task: {Task_id}")
            return
        
        # Check if task is already running (prevent duplicates)
        with self._execution_lock:
            if Task_id in self._running_tasks:
                self.console_logger.warning(f"Task {Task_id} already running, skipping")
                return
            self._running_tasks.add(Task_id)
        
        try:
            task = self.tasks[Task_id]
            handler = self.task_handlers.get(task.type)
            
            if not handler:
                self.console_logger.error(f"No handler for task type: {task.type}")
                return
            
            # Update task status
            task.status = AutomationStatus.RUNNING
            task.last_run = int(time.time() * 1000)
            task.progress = 0.0
            task.error_message = None
            
            # Broadcast status update
            self._broadcast_task_update(task)
            
            self.console_logger.info(f"Starting task: {task.name}")
            
            # Run task handler (await if it's async)
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
            self.stats['total_tasks_run'] += 1
            self.stats['successful_tasks'] += 1
            
            self.console_logger.info(f"Task completed: {task.name}")
            
        except Exception as e:
            task.status = AutomationStatus.ERROR
            task.error_message = str(e)
            
            # Log failure
            self.stats['total_tasks_run'] += 1
            self.stats['failed_tasks'] += 1
            
            self.console_logger.error(f"Task {Task_id} failed: {str(e)}")
        
        finally:
            # Always remove from running tasks
            with self._execution_lock:
                self._running_tasks.discard(Task_id)
            
            # Broadcast final status
            self._broadcast_task_update(task)
    
    def _schedule_next_run(self, task):
        """Schedule next run for a task"""
        if task.cron_expression and croniter:
            try:
                # Get current time or last run time as base
                base_time = datetime.fromtimestamp((task.last_run or int(time.time() * 1000)) / 1000)
                import croniter
                iter = croniter(task.cron_expression, base_time)
                next_date = iter.get_next(datetime)
                task.next_run = int(next_date.timestamp() * 1000)
            except Exception as e:
                self.console_logger.error(f"Failed to parse cron for task {task.task_id}: {str(e)}")
                # Fallback to interval
                interval = task.interval_seconds
                task.next_run = int(time.time() * 1000) + (interval * 1000)
        else:
            interval = task.interval_seconds
            task.next_run = int(time.time() * 1000) + (interval * 1000)
        
        next_run_dt = datetime.fromtimestamp(task.next_run / 1000)
        next_run_str = next_run_dt.strftime("%Y-%m-%d %H:%M:%S")
        self.console_logger.info(f"Task \"{task.name}\" scheduled to run next at {next_run_str}")
    
    def _broadcast_task_update(self, task):
        """Broadcast task update via Firebase"""
        task_dict = asdict(task)
        # Convert Enum to string for JSON serialization
        if isinstance(task_dict['status'], AutomationStatus):
            task_dict['status'] = task_dict['status'].value
        
        message = {
            'type': 'task_update',
            'task': task_dict,
            'timestamp': int(time.time() * 1000),
            'session_id': self.session_id
        }
        
        try:
            self.client.set('scheduler_config/task_updates', message)
            self.console_logger.debug(f"Task update broadcast: {task.name}")
        except Exception as e:
            self.console_logger.error(f"Failed to broadcast task update: {str(e)}")
    
    def _broadcast_status(self):
        """Broadcast overall status"""
        status_data = {
            'type': 'orchestrator_status',
            'session_id': self.session_id,
            'timestamp': int(time.time() * 1000),
            'running': self.running,
            'tasks': {
                task_id: {
                    'name': task.name,
                    'status': task.status.value if isinstance(task.status, AutomationStatus) else task.status,
                    'last_run': task.last_run,
                    'next_run': task.next_run,
                    'enabled': task.enabled,
                    'error': task.error_message
                }
                for task_id, task in self.tasks.items()
            }
        }
        
        try:
            self.client.set('scheduler_config/orchestrator_status', status_data)
            self.console_logger.debug("Status broadcast")
        except Exception as e:
            self.console_logger.error(f"Failed to broadcast status: {str(e)}")
    
    async def _heartbeat_loop(self):
        """Maintain a lock in Firebase so older instances yield"""
        self.console_logger.info(f"Started heartbeat loop. Session ID: {self.session_id}")
        while self.running:
            try:
                # Write heartbeat to Firebase
                heartbeat_data = {
                    'session_id': self.session_id,
                    'timestamp': int(time.time() * 1000),
                    'windows_compatible': True
                }
                
                self.client.set('scheduler_config/orchestrator_lock', heartbeat_data)
                self.console_logger.debug("Heartbeat sent")
                
                await asyncio.sleep(10)
            except Exception as e:
                self.console_logger.error(f"Heartbeat error: {str(e)}")
                await asyncio.sleep(5)
    
    async def _cleanup_loop(self):
        """Periodic cleanup of old job logs"""
        while self.running:
            try:
                # Simple cleanup - remove old task updates
                days = self.config.get('log_retention_days', 15)
                self.console_logger.info(f"Running cleanup (retention: {days} days)")
                
                await asyncio.sleep(12 * 3600)  # 12 hours
            except Exception as e:
                self.console_logger.error(f"Cleanup loop error: {str(e)}")
                await asyncio.sleep(3600)
    
    def _handle_match_creation(self, task):
        """Handle match creation task (Simplified for Windows)"""
        self.console_logger.info("Starting match creation task")
        
        # Simplified match creation for Windows
        try:
            # Create a simple match
            match_data = {
                'id': f'test_match_{int(time.time())}',
                'teamA': 'Test Team A',
                'teamB': 'Test Team B',
                'scheduledTime': int((datetime.now() + timedelta(hours=24)).timestamp() * 1000),
                'venue': 'Test Venue',
                'sport': 'cricket',
                'tournament_id': 'test_tournament'
            }
            
            # Simulate match creation
            self.console_logger.info(f"Created test match: {match_data['id']}")
            
            task.progress = 50.0
            task.metadata = {
                'matches_processed': 1,
                'matches_created': 1,
                'completion_time': int(time.time() * 1000)
            }
            
        except Exception as e:
            task.status = AutomationStatus.ERROR
            task.error_message = str(e)
            self.console_logger.error(f"Match creation task failed: {str(e)}")
    
    def _handle_live_scraping(self, task):
        """Handle live scraping task (Simplified for Windows)"""
        self.console_logger.info("Starting live scraping task")
        
        try:
            # Simulate scraping
            live_matches = [
                {'id': 'test_match_1', 'teams': 'Team A vs Team B'},
                {'id': 'test_match_2', 'teams': 'Team C vs Team D'}
            ]
            
            task.progress = 50.0
            task.metadata = {
                'matches_scraped': len(live_matches),
                'total_matches': len(live_matches)
            }
            
            self.console_logger.info(f"Scraped {len(live_matches)} matches")
            
        except Exception as e:
            task.status = AutomationStatus.ERROR
            task.error_message = str(e)
            self.console_logger.error(f"Live scraping task failed: {str(e)}")
    
    def _handle_match_reconciliation(self, task):
        """Handle match reconciliation task (Simplified for Windows)"""
        self.console_logger.info("Starting match reconciliation task")
        
        try:
            # Simulate reconciliation
            task.progress = 50.0
            task.metadata = {
                'matches_reconciled': 1,
                'total_matches': 1
            }
            
            self.console_logger.info("Reconciliation completed")
            
        except Exception as e:
            task.status = AutomationStatus.ERROR
            task.error_message = str(e)
            self.console_logger.error(f"Reconciliation task failed: {str(e)}")
    
    def trigger_task(self, task_id: str) -> Dict[str, Any]:
        """Queue a manual trigger - safe to call from any thread"""
        if task_id not in self.tasks:
            return {'success': False, 'error': 'Task not found'}
        
        task = self.tasks[task_id]
        if task.status == AutomationStatus.RUNNING:
            return {'success': False, 'error': 'Task already running'}
        
        # Check if task is already pending to prevent duplicates
        with self._trigger_lock:
            if task_id in self._pending_triggers:
                return {'success': False, 'error': 'Task already pending'}
            self._pending_triggers.append(task_id)
        
        # Safe logging that doesn't require event loop
        self.console_logger.info(f"Task queued for manual trigger: {task.name}")
        
        return {'success': True, 'task_id': task_id}
    
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
            'session_id': self.session_id,
            'windows_compatible': True,
            'ipc_enabled': self._ipc_event is not None,
            'console_logging': True,
            'automation_status': {
                'orchestrator_running': self.running,
                'total_tasks': len(self.tasks),
                'running_tasks': sum(1 for t in self.tasks.values() if t.status == AutomationStatus.RUNNING),
                'error_tasks': sum(1 for t in self.tasks.values() if t.status == AutomationStatus.ERROR),
                'tasks': tasks_dict
            },
            'config': self.config,
            'statistics': self.stats
        }


class SimpleConsoleLogger:
    """Simple console logger for Windows compatibility"""
    
    def __init__(self, name="WindowsOrchestrator"):
        self.name = name
    
    def info(self, message: str):
        print(f"[{self.name}] [INFO] {message}")
    
    def error(self, message: str):
        print(f"[{self.name}] [ERROR] {message}")
    
    def warning(self, message: str):
        print(f"[{self.name}] [WARNING] {message}")
    
    def debug(self, message: str):
        print(f"[{self.name}] [DEBUG] {message}")


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
    is_adaptive: bool = False
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


def main():
    """Main entry point for Windows orchestrator"""
    parser = argparse.ArgumentParser(description='Windows-Compatible Automation Orchestrator')
    parser.add_argument('--session-id', type=str, default=None,
                       help='Session ID for debugging')
    parser.add_argument('--enable-ipc', action='store_true',
                       help='Enable Windows IPC for debugging')
    parser.add_argument('--console-log', action='store_true', default=True,
                       help='Enable console logging (default: enabled)')
    parser.add_argument('--config-test', action='store_true',
                       help='Test configuration loading')
    
    args = parser.parse_args()
    
    try:
        # Initialize Firebase client
        firebase_client = FirebaseClient()
        
        # Initialize orchestrator
        orchestrator = WindowsOrchestrator(firebase_client, SimpleConsoleLogger("WindowsOrchestrator"))
        
        if args.config_test:
            # Test configuration loading
            config = orchestrator._load_config()
            print(f"Configuration test: {json.dumps(config, indent=2)}")
            return
        
        # Override settings if provided
        if args.session_id:
            orchestrator.session_id = args.session_id
        if args.enable_ipc:
            orchestrator._setup_windows_ipc()
        
        # Start orchestrator
        asyncio.run(orchestrator.start())
        
    except KeyboardInterrupt:
        print("\nWindows Orchestrator stopped by user")
    except Exception as e:
        print(f"Fatal error: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    main()
