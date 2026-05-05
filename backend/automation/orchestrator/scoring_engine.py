"""
Scoring Algorithm Execution Engine
Manages score calculation and processing for matches
"""

import subprocess
import sys
import json
import time
from typing import Dict, List, Optional, Any, Callable
from datetime import datetime
from dataclasses import dataclass
from enum import Enum
from pathlib import Path

from ..base.firebase_client import FirebaseClient
from ..scheduler.websocket_logger import WebSocketLogger


class ProcessingStatus(Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    ERROR = "error"


@dataclass
class ProcessingJob:
    """Score processing job"""
    job_id: str
    match_id: str
    tournament_id: str
    sport: str
    innings: str
    status: ProcessingStatus
    created_at: int
    started_at: Optional[int] = None
    completed_at: Optional[int] = None
    error_message: Optional[str] = None
    result: Optional[Dict[str, Any]] = None


class ScoringEngine:
    """
    Manages score calculation and processing
    Integrates with existing scoring calculators
    """
    
    def __init__(self, firebase_client: FirebaseClient, logger: WebSocketLogger):
        self.client = firebase_client
        self.logger = logger
        self.running = False
        
        # Processing queue
        self.processing_queue: List[ProcessingJob] = []
        self.active_jobs: Dict[str, ProcessingJob] = {}
        
        # Script paths
        self.script_paths = {
            'cricket': 'automation/cricket/run_calculator.py',
            'football': 'automation/football/run_calculator.py'
        }
        
        # Processing configuration
        self.config = self._load_config()
        
        # Statistics
        self.stats = {
            'total_processed': 0,
            'successful': 0,
            'failed': 0,
            'average_processing_time': 0.0
        }
    
    def _load_config(self) -> Dict[str, Any]:
        """Load scoring engine configuration"""
        config = self.client.get('automation_config/scoring_engine') or {}
        
        defaults = {
            'max_concurrent_jobs': 2,
            'job_timeout': 300,  # 5 minutes
            'retry_failed_jobs': True,
            'max_retries': 3,
            'auto_process_completed_matches': True,
            'processing_interval': 30  # seconds
        }
        
        return {**defaults, **config}
    
    def start(self):
        """Start the scoring engine"""
        self.running = True
        self.logger.info('scoring_engine', 'Scoring engine started')
        
        # Start processing loop
        self._processing_loop()
    
    def stop(self):
        """Stop the scoring engine"""
        self.running = False
        self.logger.info('scoring_engine', 'Scoring engine stopped')
    
    def _processing_loop(self):
        """Main processing loop"""
        while self.running:
            try:
                # Check for new matches to process
                if self.config.get('auto_process_completed_matches', True):
                    self._check_for_new_matches()
                
                # Process queued jobs
                self._process_queue()
                
                # Update statistics
                self._update_statistics()
                
                # Sleep
                time.sleep(self.config.get('processing_interval', 30))
                
            except Exception as e:
                self.logger.error('scoring_engine', f'Processing loop error: {str(e)}')
                time.sleep(10)
    
    def _check_for_new_matches(self):
        """Check for matches that need processing"""
        # Get all tournaments
        tournaments = self.client.get('tournaments') or {}
        
        for tournament_id, tournament_data in tournaments.items():
            matches = tournament_data.get('matches', {})
            
            for match_id, match_data in matches.items():
                if self._should_process_match(match_id, match_data):
                    self._queue_match_for_processing(tournament_id, match_id, match_data)
    
    def _should_process_match(self, match_id: str, match_data: Dict[str, Any]) -> bool:
        """Check if a match should be processed"""
        # Check if match is completed
        status = match_data.get('status', '')
        if status not in ['completed', 'done']:
            return False
        
        # Check if match has actual scores
        meta = match_data.get('meta', {})
        if not (meta.get('actual1stInningsScore') or meta.get('actual2ndInningsResult')):
            return False
        
        # Check if already processed
        if match_data.get('reconciled', False):
            return False
        
        # Check if already in queue
        if any(job.match_id == match_id for job in self.processing_queue):
            return False
        
        return True
    
    def _queue_match_for_processing(self, tournament_id: str, match_id: str, match_data: Dict[str, Any]):
        """Queue a match for processing"""
        sport = match_data.get('sport', 'cricket')
        
        # Create processing job
        job = ProcessingJob(
            job_id=f"{tournament_id}_{match_id}_{int(time.time())}",
            match_id=match_id,
            tournament_id=tournament_id,
            sport=sport,
            innings='both',  # Process both innings by default
            status=ProcessingStatus.PENDING,
            created_at=int(time.time() * 1000)
        )
        
        self.processing_queue.append(job)
        
        self.logger.info('scoring_engine', f'Queued match for processing: {match_id}')
        
        # Broadcast job creation
        self._broadcast_job_event('job_queued', job)
    
    def _process_queue(self):
        """Process jobs in the queue"""
        # Check concurrent job limit
        active_count = len(self.active_jobs)
        max_concurrent = self.config.get('max_concurrent_jobs', 2)
        
        if active_count >= max_concurrent:
            return
        
        # Process pending jobs
        pending_jobs = [job for job in self.processing_queue if job.status == ProcessingStatus.PENDING]
        
        for job in pending_jobs[:max_concurrent - active_count]:
            self._start_job(job)
    
    def _start_job(self, job: ProcessingJob):
        """Start processing a job"""
        job.status = ProcessingStatus.PROCESSING
        job.started_at = int(time.time() * 1000)
        
        self.active_jobs[job.job_id] = job
        
        self.logger.info('scoring_engine', f'Starting job: {job.job_id}')
        
        # Broadcast job start
        self._broadcast_job_event('job_started', job)
        
        # Process in separate thread
        import threading
        threading.Thread(target=self._execute_job, args=(job,)).start()
    
    def _execute_job(self, job: ProcessingJob):
        """Execute a processing job"""
        try:
            # Get script path
            script_path = self.script_paths.get(job.sport)
            if not script_path:
                raise ValueError(f'No script path for sport: {job.sport}')
            
            # Prepare command arguments
            python_path = sys.executable
            script_full_path = Path(__file__).parent.parent.parent / script_path
            
            args = [
                python_path,
                str(script_full_path),
                '--tournament', job.tournament_id,
                '--match', job.match_id,
                '--innings', job.innings,
                '--env', 'prod'
            ]
            
            self.logger.info('scoring_engine', f'Executing: {" ".join(args)}')
            
            # Execute the script
            result = subprocess.run(
                args,
                capture_output=True,
                text=True,
                timeout=self.config.get('job_timeout', 300),
                cwd=str(Path(__file__).parent.parent.parent)
            )
            
            if result.returncode == 0:
                # Success
                job.status = ProcessingStatus.COMPLETED
                job.completed_at = int(time.time() * 1000)
                job.result = {
                    'stdout': result.stdout,
                    'returncode': result.returncode
                }
                
                self.stats['total_processed'] += 1
                self.stats['successful'] += 1
                
                self.logger.info('scoring_engine', f'Job completed successfully: {job.job_id}')
                
                # Update match status
                self._update_match_status(job)
                
            else:
                # Failure
                error_msg = result.stderr[:500] if result.stderr else 'Script failed'
                job.status = ProcessingStatus.ERROR
                job.completed_at = int(time.time() * 1000)
                job.error_message = error_msg
                
                self.stats['total_processed'] += 1
                self.stats['failed'] += 1
                
                self.logger.error('scoring_engine', f'Job failed: {job.job_id} - {error_msg}')
                
                # Check if should retry
                if self.config.get('retry_failed_jobs', True):
                    self._schedule_retry(job)
            
            # Broadcast job completion
            self._broadcast_job_event('job_completed', job)
            
        except subprocess.TimeoutExpired:
            job.status = ProcessingStatus.ERROR
            job.completed_at = int(time.time() * 1000)
            job.error_message = 'Job timed out'
            
            self.stats['total_processed'] += 1
            self.stats['failed'] += 1
            
            self.logger.error('scoring_engine', f'Job timed out: {job.job_id}')
            
            self._broadcast_job_event('job_completed', job)
            
        except Exception as e:
            job.status = ProcessingStatus.ERROR
            job.completed_at = int(time.time() * 1000)
            job.error_message = str(e)
            
            self.stats['total_processed'] += 1
            self.stats['failed'] += 1
            
            self.logger.error('scoring_engine', f'Job error: {job.job_id} - {str(e)}')
            
            self._broadcast_job_event('job_completed', job)
        
        finally:
            # Remove from active jobs
            if job.job_id in self.active_jobs:
                del self.active_jobs[job.job_id]
            
            # Remove from queue
            if job in self.processing_queue:
                self.processing_queue.remove(job)
    
    def _update_match_status(self, job: ProcessingJob):
        """Update match status after successful processing"""
        try:
            match_path = f"tournaments/{job.tournament_id}/matches/{job.match_id}"
            
            # Mark as reconciled
            update_data = {
                'reconciled': True,
                'reconciledAt': job.completed_at,
                'processingJobId': job.job_id
            }
            
            self.client.update(match_path, update_data)
            
            self.logger.info('scoring_engine', f'Marked match as reconciled: {job.match_id}')
            
        except Exception as e:
            self.logger.error('scoring_engine', f'Failed to update match status: {str(e)}')
    
    def _schedule_retry(self, job: ProcessingJob):
        """Schedule a retry for a failed job"""
        retry_count = job.result.get('retry_count', 0) if job.result else 0
        max_retries = self.config.get('max_retries', 3)
        
        if retry_count < max_retries:
            # Create retry job
            retry_job = ProcessingJob(
                job_id=f"{job.job_id}_retry_{retry_count + 1}",
                match_id=job.match_id,
                tournament_id=job.tournament_id,
                sport=job.sport,
                innings=job.innings,
                status=ProcessingStatus.PENDING,
                created_at=int(time.time() * 1000)
            )
            
            retry_job.result = {'retry_count': retry_count + 1}
            
            self.processing_queue.append(retry_job)
            
            self.logger.info('scoring_engine', f'Scheduled retry for job: {job.job_id} (attempt {retry_count + 1})')
    
    def get_matches_needing_processing(self) -> List[Dict[str, Any]]:
        """Get matches that need score processing"""
        matches_to_process = []
        
        tournaments = self.client.get('tournaments') or {}
        
        for tournament_id, tournament_data in tournaments.items():
            matches = tournament_data.get('matches', {})
            
            for match_id, match_data in matches.items():
                if self._should_process_match(match_id, match_data):
                    match_data['tournamentId'] = tournament_id
                    match_data['matchId'] = match_id
                    matches_to_process.append(match_data)
        
        return matches_to_process
    
    def process_match_scores(self, match: Dict[str, Any]) -> Dict[str, Any]:
        """Process scores for a specific match"""
        tournament_id = match.get('tournamentId')
        match_id = match.get('matchId')
        sport = match.get('sport', 'cricket')
        
        if not tournament_id or not match_id:
            return {'success': False, 'error': 'Missing tournament or match ID'}
        
        # Create immediate processing job
        job = ProcessingJob(
            job_id=f"manual_{tournament_id}_{match_id}_{int(time.time())}",
            match_id=match_id,
            tournament_id=tournament_id,
            sport=sport,
            innings='both',
            status=ProcessingStatus.PENDING,
            created_at=int(time.time() * 1000)
        )
        
        # Add to front of queue
        self.processing_queue.insert(0, job)
        
        self.logger.info('scoring_engine', f'Manually queued match: {match_id}')
        
        return {'success': True, 'job_id': job.job_id}
    
    def _update_statistics(self):
        """Update processing statistics"""
        if self.stats['total_processed'] > 0:
            total_time = sum(
                job.completed_at - job.started_at
                for job in self.active_jobs.values()
                if job.completed_at and job.started_at
            )
            if self.stats['total_processed'] > 0:
                self.stats['average_processing_time'] = total_time / self.stats['total_processed']
    
    def _broadcast_job_event(self, event_type: str, job: ProcessingJob):
        """Broadcast job event via WebSocket"""
        message = {
            'type': 'scoring_job_event',
            'eventType': event_type,
            'job': {
                'job_id': job.job_id,
                'match_id': job.match_id,
                'tournament_id': job.tournament_id,
                'sport': job.sport,
                'status': job.status.value,
                'created_at': job.created_at,
                'started_at': job.started_at,
                'completed_at': job.completed_at,
                'error_message': job.error_message
            },
            'timestamp': int(time.time() * 1000)
        }
        
        self.logger.broadcast('scoring_engine', json.dumps(message))
    
    def get_status(self) -> Dict[str, Any]:
        """Get scoring engine status"""
        return {
            'running': self.running,
            'queue_length': len(self.processing_queue),
            'active_jobs': len(self.active_jobs),
            'pending_jobs': len([j for j in self.processing_queue if j.status == ProcessingStatus.PENDING]),
            'config': self.config,
            'statistics': self.stats,
            'active_job_details': [
                {
                    'job_id': job.job_id,
                    'match_id': job.match_id,
                    'sport': job.sport,
                    'started_at': job.started_at,
                    'duration': int(time.time() * 1000) - job.started_at if job.started_at else 0
                }
                for job in self.active_jobs.values()
            ]
        }
