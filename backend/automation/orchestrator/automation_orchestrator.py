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
import uuid
from typing import Dict, Any, Optional, List, Callable

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
        self.last_cleanup_time = time.time()
        self.session_id = str(uuid.uuid4())
        self.loop = None
        
        # Thread-safe pending trigger queue (for UI-initiated runs)
        self._pending_triggers: List[str] = []
        self._trigger_lock = threading.Lock()
        # Task execution locks to prevent duplicate runs
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
        config = self.client.get('scheduler_config') or {}
        
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
        tasks_data = self.client.get('scheduler_config/tasks') or {}
        
        # Define IPL default tasks
        ipl_defaults = {
            'ipl_match_discovery': {
                'task_id': 'ipl_match_discovery',
                'name': 'IPL Match Discovery',
                'type': 'match_creation',
                'status': 'idle',
                'cron_expression': '0 * * * *',  # Every hour
                'enabled': True
            },
            'ipl_live_scraping': {
                'task_id': 'ipl_live_scraping',
                'name': 'IPL Live Scraping (Weekday/Weekend)',
                'type': 'scraping',
                'status': 'idle',
                'interval_seconds': 60,
                'enabled': True,
                'is_adaptive': True
            },
            'ipl_reconciliation': {
                'task_id': 'ipl_reconciliation',
                'name': 'IPL Match Reconciliation',
                'type': 'reconciliation',
                'status': 'idle',
                'cron_expression': '*/5 * * * *',  # Every 5 minutes
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
            self.client.set('scheduler_config/tasks', tasks_data)
            
        for task_id, data in tasks_data.items():
            self.tasks[task_id] = AutomationTask(**data)
            # Schedule initial run if not already scheduled
            if not self.tasks[task_id].next_run:
                self._schedule_next_run(self.tasks[task_id])
    
    async def start(self):
        """Start the automation orchestrator"""
        self.running = True
        self.loop = asyncio.get_running_loop()  # Capture running loop for thread-safe scheduling
        self.logger.info('orchestrator', 'Starting automation orchestrator')
        
        # Initialize notification system
        try:
            self.logger.info('orchestrator', 'Initializing notification system...')
            self.notification_integration = await initialize_notifications(self.client, self.logger)
            self.logger.info('orchestrator', 'Notification system initialized')
        except Exception as e:
            self.logger.error('orchestrator', f'Failed to initialize notifications: {str(e)}')
            self.notification_integration = None
        
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
        try:
            self.logger.info('orchestrator', 'Creating orchestration loop background task')
            asyncio.create_task(self._orchestration_loop())
            self.logger.info('orchestrator', 'Orchestration loop background task created')
        except Exception as e:
            self.logger.error('orchestrator', f'Failed to create orchestration loop task: {e}')
        
        # Start heartbeat loop for distributed locking
        try:
            asyncio.create_task(self._heartbeat_loop())
        except Exception as e:
            self.logger.error('orchestrator', f'Failed to create heartbeat loop task: {e}')
        
        # Start cleanup loop
        try:
            asyncio.create_task(self._cleanup_loop())
        except Exception as e:
            self.logger.error('orchestrator', f'Failed to create cleanup loop task: {e}')
        
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
    
    async def _heartbeat_loop(self):
        """Maintain a lock in Firebase so older instances yield"""
        self.logger.info('orchestrator', f'Started heartbeat loop. Session ID: {self.session_id}')
        while self.running:
            try:
                # Write heartbeat to Firebase
                self.client.set('scheduler_config/orchestrator_lock', {
                    'session_id': self.session_id,
                    'timestamp': int(time.time() * 1000)
                })
            except Exception as e:
                self.logger.error('orchestrator', f'Heartbeat error: {e}')
            await asyncio.sleep(10)

    async def _orchestration_loop(self):
        """Main orchestration loop (Asynchronous)"""
        self.start_time = datetime.now()
        self.logger.info('orchestrator', 'Orchestration loop started')
        
        while self.running:
            try:
                current_time = int(time.time() * 1000)
                
                # Check Lock
                lock_data = self.client.get('scheduler_config/orchestrator_lock')
                if lock_data and lock_data.get('session_id') != self.session_id:
                    # Check if the other lock is recent (within 30 seconds)
                    last_heartbeat = lock_data.get('timestamp', 0)
                    if current_time - last_heartbeat < 30000:
                        self.logger.error('orchestrator', f'Another orchestrator instance detected ({lock_data.get("session_id")}). Yielding lock and shutting down.')
                        await self.stop()
                        # Also terminate main application
                        import os, signal
                        os.kill(os.getpid(), signal.SIGTERM)
                        break
                
                # Drain manually-triggered tasks (from UI/threads via trigger_task)
                with self._trigger_lock:
                    pending = list(self._pending_triggers)
                    self._pending_triggers.clear()
                for task_id in pending:
                    if task_id in self.tasks and self.tasks[task_id].status == AutomationStatus.IDLE:
                        # Double-check if not already running
                        with self._execution_lock:
                            if task_id in self._running_tasks:
                                self.logger.warning('orchestrator', f'Task {task_id} already running, skipping manual trigger')
                                continue
                        try:
                            self.logger.info('orchestrator', f'Manual trigger: {task_id}')
                            asyncio.create_task(self._run_task(task_id))
                        except RuntimeError as re:
                            if "no running event loop" in str(re):
                                print(f"[Orchestrator] Cannot create task for {task_id} - no event loop")
                                # Try to run task synchronously as fallback
                                try:
                                    asyncio.run(self._run_task(task_id))
                                except Exception as e:
                                    print(f"[Orchestrator] Failed to run task {task_id} synchronously: {e}")
                            else:
                                raise
                
                # Process scheduled tasks
                for task_id, task in self.tasks.items():
                    if task.enabled and task.status == AutomationStatus.IDLE and task.next_run and current_time >= task.next_run:
                        # Run in background to not block other tasks
                        try:
                            asyncio.create_task(self._run_task(task_id))
                        except RuntimeError as re:
                            if "no running event loop" in str(re):
                                print(f"[Orchestrator] Cannot create scheduled task for {task_id} - no event loop")
                                # Try to run task synchronously as fallback
                                try:
                                    asyncio.run(self._run_task(task_id))
                                except Exception as e:
                                    print(f"[Orchestrator] Failed to run scheduled task {task_id} synchronously: {e}")
                            else:
                                raise
                
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
        
        # Check if task is already running (prevent duplicates)
        with self._execution_lock:
            if task_id in self._running_tasks:
                self.logger.warning('orchestrator', f'Task {task_id} already running, skipping')
                return
            self._running_tasks.add(task_id)
        
        try:
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
        
        finally:
            # Always remove from running tasks
            with self._execution_lock:
                self._running_tasks.discard(task_id)
        
        # Broadcast final status
        self._broadcast_task_update(task)
    
    async def _handle_match_creation(self, task: AutomationTask):
        """Handle match creation task (Asynchronous)"""
        self.logger.info('orchestrator', 'Starting match creation task')
        self.logger.debug('orchestrator', f'Task ID: {task.task_id}, enabled: {task.enabled}')
        
        # Update progress
        task.progress = 5.0
        task.metadata = task.metadata or {}
        self._broadcast_task_update(task)
        
        try:
            # Step 1: Fetch upcoming matches from external sources
            self.logger.info('orchestrator', 'Step 1/4: Fetching upcoming matches from external sources')
            self.logger.debug('orchestrator', f'Available match sources: {list(self.match_manager.match_sources.keys())}')
            
            upcoming_matches = await asyncio.to_thread(self.match_manager.fetch_upcoming_matches)
            
            if not upcoming_matches:
                self.logger.warning('orchestrator', 'No upcoming matches found from any source')
                task.progress = 100.0
                task.metadata.update({
                    'matches_processed': 0,
                    'matches_created': 0,
                    'sources_checked': list(self.match_manager.match_sources.keys()),
                    'next_run': self._calculate_next_match_creation_time()
                })
                self._broadcast_task_update(task)
                return
            
            self.logger.info('orchestrator', f'Fetched {len(upcoming_matches)} total upcoming matches')
            task.progress = 25.0
            self._broadcast_task_update(task)
            
            # Step 2: Filter and validate matches
            self.logger.info('orchestrator', 'Step 2/4: Filtering and validating matches')
            valid_matches = []
            filtered_count = 0
            
            for i, match in enumerate(upcoming_matches):
                self.logger.debug('orchestrator', f'Processing match {i+1}/{len(upcoming_matches)}: {match.team_a} vs {match.team_b}')
                
                # Validate match data
                if self._validate_match(match):
                    valid_matches.append(match)
                    self.logger.debug('orchestrator', f'✓ Valid match: {match.team_a} vs {match.team_b} at {datetime.fromtimestamp(match.scheduled_time/1000)}')
                else:
                    filtered_count += 1
                    self.logger.warning('orchestrator', f'✗ Invalid match filtered: {match.team_a} vs {match.team_b}')
                
                # Update progress
                progress = 25.0 + ((25.0 * (i + 1)) / len(upcoming_matches))
                task.progress = min(50.0, progress)
                self._broadcast_task_update(task)
            
            self.logger.info('orchestrator', f'Validation complete: {len(valid_matches)} valid, {filtered_count} filtered')
            task.progress = 50.0
            self._broadcast_task_update(task)
            
            # Step 3: Create matches in Firebase
            self.logger.info('orchestrator', 'Step 3/4: Creating matches in Firebase')
            created_count = 0
            updated_count = 0
            skipped_count = 0
            
            for i, match in enumerate(valid_matches):
                self.logger.debug('orchestrator', f'Creating match {i+1}/{len(valid_matches)}: {match.team_a} vs {match.team_b}')
                
                try:
                    result = await asyncio.to_thread(self.match_manager.create_match_if_not_exists, match)
                    
                    if result:
                        created_count += 1
                        self.logger.info('orchestrator', f'✓ Created new match: {match.team_a} vs {match.team_b}')
                        
                        # Trigger notification for newly created match
                        if self.notification_integration:
                            try:
                                match_data = {
                                    'match_id': match.id,
                                    'team_a': match.team_a,
                                    'team_b': match.team_b,
                                    'date': datetime.fromtimestamp(match.scheduled_time / 1000).strftime('%Y-%m-%d %H:%M'),
                                    'venue': match.venue,
                                    'sport': 'Cricket',
                                    'tournament_id': match.tournament_id,
                                    'match_type': match.match_type
                                }
                                await self.notification_integration.on_match_created(match_data)
                                self.logger.debug('orchestrator', f'✓ Notification sent for new match: {match.team_a} vs {match.team_b}')
                            except Exception as e:
                                self.logger.error('orchestrator', f'✗ Failed to send match creation notification: {str(e)}')
                    else:
                        updated_count += 1
                        self.logger.debug('orchestrator', f'→ Match already exists: {match.team_a} vs {match.team_b}')
                        
                except Exception as e:
                    skipped_count += 1
                    self.logger.error('orchestrator', f'✗ Failed to create match {match.team_a} vs {match.team_b}: {str(e)}')
                
                # Update progress
                progress = 50.0 + ((40.0 * (i + 1)) / len(valid_matches))
                task.progress = min(90.0, progress)
                self._broadcast_task_update(task)
            
            # Step 4: Schedule next match creation
            self.logger.info('orchestrator', 'Step 4/4: Scheduling next match creation')
            next_run_time = self._calculate_next_match_creation_time(valid_matches)
            
            task.progress = 95.0
            self._broadcast_task_update(task)
            
            # Final update
            task.progress = 100.0
            task.metadata.update({
                'matches_processed': len(upcoming_matches),
                'matches_valid': len(valid_matches),
                'matches_created': created_count,
                'matches_updated': updated_count,
                'matches_skipped': skipped_count,
                'sources_checked': list(self.match_manager.match_sources.keys()),
                'next_run': next_run_time,
                'completion_time': int(time.time() * 1000)
            })
            
            self.logger.info('orchestrator', f'Match creation completed: {created_count} new, {updated_count} updated, {skipped_count} skipped')
            self.logger.info('orchestrator', f'Total processed: {len(upcoming_matches)} fetched, {len(valid_matches)} valid')
            self.logger.info('orchestrator', f'Next match creation scheduled for: {datetime.fromtimestamp(next_run_time/1000).strftime("%Y-%m-%d %H:%M:%S")}')
            
        except Exception as e:
            self.logger.error('orchestrator', f'Match creation task failed: {str(e)}')
            task.status = AutomationStatus.ERROR
            task.error_message = str(e)
            task.metadata.update({
                'error': str(e),
                'error_time': int(time.time() * 1000)
            })
        
        self._broadcast_task_update(task)
    
    def _validate_match(self, match) -> bool:
        """Validate match data before creation"""
        try:
            # Check required fields
            if not all([match.id, match.team_a, match.team_b, match.scheduled_time]):
                self.logger.warning('orchestrator', f'Match validation failed: missing required fields for {match.team_a} vs {match.team_b}')
                return False
            
            # Check scheduled time is in the future
            current_time = int(time.time() * 1000)
            if match.scheduled_time <= current_time:
                self.logger.warning('orchestrator', f'Match validation failed: scheduled time is in the past for {match.team_a} vs {match.team_b}')
                return False
            
            # Check team names are not empty
            if not match.team_a.strip() or not match.team_b.strip():
                self.logger.warning('orchestrator', f'Match validation failed: empty team names')
                return False
            
            # Check match ID format
            if not isinstance(match.id, str) or len(match.id) < 3:
                self.logger.warning('orchestrator', f'Match validation failed: invalid match ID format')
                return False
            
            return True
            
        except Exception as e:
            self.logger.error('orchestrator', f'Match validation error: {str(e)}')
            return False
    
    def _calculate_next_match_creation_time(self, valid_matches=None) -> int:
        """Calculate when to run the next match creation task"""
        try:
            current_time = int(time.time() * 1000)
            
            # If no valid matches, schedule for next hour
            if not valid_matches:
                next_hour = current_time + (60 * 60 * 1000)  # 1 hour from now
                self.logger.info('orchestrator', f'No valid matches found, scheduling next check in 1 hour')
                return next_hour
            
            # Find the nearest upcoming match
            nearest_match_time = min(match.scheduled_time for match in valid_matches)
            
            # If nearest match is more than 24 hours away, check every 6 hours
            if nearest_match_time - current_time > (24 * 60 * 60 * 1000):
                next_check = current_time + (6 * 60 * 60 * 1000)  # 6 hours from now
                self.logger.info('orchestrator', f'Nearest match is >24h away, scheduling check in 6 hours')
                return next_check
            
            # If nearest match is within 24 hours, check every 2 hours
            next_check = current_time + (2 * 60 * 60 * 1000)  # 2 hours from now
            self.logger.info('orchestrator', f'Nearest match is within 24h, scheduling check in 2 hours')
            return next_check
            
        except Exception as e:
            self.logger.error('orchestrator', f'Error calculating next match creation time: {str(e)}')
            # Fallback to 1 hour from now
            return int(time.time() * 1000) + (60 * 60 * 1000)
    
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
    
    async def _handle_match_reconciliation(self, task: AutomationTask):
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
                # Check if match needs early prediction migration
                await self._migrate_early_predictions_if_needed(match)
                
                # Process scores and leaderboard for match
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
    
    async def _migrate_early_predictions_if_needed(self, match):
        """Migrate early predictions to live predictions when match goes live"""
        try:
            # Get match metadata to check status
            match_meta = self.client.get(f"prod/tournaments/cricket/{match.get('tournamentId', '')}/matches/{match.get('id', '')}/meta")
            if not match_meta:
                self.logger.warning('orchestrator', f'No meta found for match {match.get("id")}')
                return
            
            # Check if match just went live (status changed from scheduled to live)
            current_status = match_meta.get('status', '')
            batting_first = match_meta.get('battingFirst')
            
            if current_status == 'live' and batting_first:
                self.logger.info('orchestrator', f'Match {match.get("id")} went live, checking for early predictions to migrate')
                
                # Get all predictions for this match
                predictions_path = f"prod/tournaments/cricket/{match.get('tournamentId', '')}/matches/{match.get('id', '')}/predictions"
                all_predictions = self.client.get(predictions_path) or {}
                
                migrated_count = 0
                for username, prediction_data in all_predictions.items():
                    if isinstance(prediction_data, dict) and 'early_predict' in prediction_data:
                        early_pred = prediction_data['early_predict']
                        
                        # Check if early prediction needs migration
                        if early_pred.get('first') and not early_pred.get('migrated', False):
                            self.logger.info('orchestrator', f'Migrating early prediction for user: {username}')
                             
                            # Extract correct runs based on actual batting team
                            first_innings = early_pred['first'].get('first_innings', {})
                            actual_runs = None
                             
                            if batting_first == 'teamA':
                                actual_runs = first_innings.get('teamA_batting_first')
                            elif batting_first == 'teamB':
                                actual_runs = first_innings.get('teamB_batting_first')
                             
                            if actual_runs:
                                # Create live prediction structure
                                live_prediction = {
                                    'predictionId': early_pred['first'].get('predictionId', int(time.time() * 1000)),
                                    'winnerTeam': early_pred['first'].get('winnerTeam'),
                                    'runs': actual_runs,
                                    'battingFirst': batting_first,
                                    'migratedFrom': 'early_prediction',
                                    'createdAt': early_pred['first'].get('createdAt'),
                                    'updatedAt': int(time.time() * 1000)
                                }
                                 
                                # Update prediction with migrated live data
                                update_path = f"{predictions_path}/{username}"
                                update_data = {
                                    'first_inn': live_prediction,
                                    'early_predict.migrated': True,
                                    'early_predict.migratedAt': int(time.time() * 1000),
                                    'early_predict.migratedTo': 'first_inn',
                                    'updatedAt': int(time.time() * 1000)
                                }
                                 
                                self.client.update(update_path, update_data)
                                migrated_count += 1
                                 
                                self.logger.info('orchestrator', f'Successfully migrated early prediction for {username}: {actual_runs} runs')
                            else:
                                self.logger.warning('orchestrator', f'Could not extract runs for early prediction migration: {username}')
                
                if migrated_count > 0:
                    self.logger.info('orchestrator', f'Migrated {migrated_count} early predictions for match {match.get("id")}')
                else:
                    self.logger.info('orchestrator', f'No early predictions needed migration for match {match.get("id")}')
                    
        except Exception as e:
            self.logger.error('orchestrator', f'Error migrating early predictions for match {match.get("id")}: {str(e)}')
    
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
            
        next_run_dt = datetime.fromtimestamp(task.next_run / 1000)
        self.logger.info('orchestrator', f'Task "{task.name}" scheduled to run next at {next_run_dt.strftime("%Y-%m-%d %H:%M:%S")}')
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
            
        self.client.set('scheduler_config/tasks', tasks_data)
    
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
        """Queue a manual trigger — safe to call from any thread"""
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
        try:
            self.logger.info('orchestrator', f'Task queued for manual trigger: {task.name}')
        except RuntimeError as re:
            if "no running event loop" in str(re):
                print(f"[Orchestrator] Task queued for manual trigger: {task.name} (no event loop)")
            else:
                raise
        
        return {'success': True, 'task_id': task_id}
    
    def update_config(self, new_config: Dict[str, Any]) -> Dict[str, Any]:
        """Update automation configuration"""
        self.config.update(new_config)
        
        # Save to Firebase
        self.client.set('scheduler_config', self.config)
        
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
            self._save_tasks()
            
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
        self._save_tasks()
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
        self._save_tasks()
        self.logger.info('orchestrator', f'Task {"enabled" if task.enabled else "disabled"}: {task.name}', {'task_id': task_id})
        
        return {'success': True, 'task_id': task_id, 'enabled': task.enabled}
    def _broadcast_task_update(self, task: AutomationTask):
        """Broadcast single task update via WebSocket"""
        task_dict = asdict(task)
        # Convert AutomationStatus enum to string for JSON serialization
        if isinstance(task_dict['status'], AutomationStatus):
            task_dict['status'] = task_dict['status'].value
            
        message = {
            'type': 'task_update',
            'data': {
                'task': task_dict
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
        return message
