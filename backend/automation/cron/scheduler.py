import logging
import subprocess
import sys
from typing import Dict, List
from croniter import croniter
from datetime import datetime
import time

logger = logging.getLogger(__name__)

class Scheduler:
    """Cron-based scheduler that runs tasks based on schedule"""
    
    def __init__(self, cron_manager, task_registry):
        self.cron_manager = cron_manager
        self.task_registry = task_registry
        self.running = False
    
    def start(self):
        """Start the scheduler loop"""
        self.running = True
        logger.info("Scheduler started")
        
        try:
            while self.running:
                try:
                    self._check_and_run_jobs()
                    time.sleep(30)  # Check every 30 seconds
                except KeyboardInterrupt:
                    logger.info("Scheduler stopped by user")
                    break
                except Exception as e:
                    logger.error(f"Scheduler error: {e}")
                    time.sleep(30)
        finally:
            self.running = False
    
    def stop(self):
        """Stop the scheduler"""
        self.running = False
        logger.info("Scheduler stopped")
    
    def _check_and_run_jobs(self):
        """Check all enabled jobs and run if schedule matches"""
        jobs = self.cron_manager.get_enabled_jobs()
        now = datetime.now()
        
        for job in jobs:
            try:
                if self._should_run(job, now):
                    self._run_job(job)
            except Exception as e:
                logger.error(f"Error checking job {job.get('id')}: {e}")
    
    def _should_run(self, job: Dict, now: datetime) -> bool:
        """Check if a job should run based on its schedule"""
        schedule = job.get('schedule')
        if not schedule:
            return False
        
        try:
            # Get last run time
            last_run = job.get('last_run')
            if last_run:
                # Parse last run time
                if isinstance(last_run, str):
                    last_run_time = datetime.fromisoformat(last_run)
                else:
                    last_run_time = last_run
            else:
                # Never ran before, should run
                return True
            
            # Check if schedule matches
            cron = croniter(schedule, last_run_time)
            next_run = cron.get_next(datetime)
            
            return now >= next_run
        except Exception as e:
            logger.error(f"Error parsing schedule for job {job.get('id')}: {e}")
            return False
    
    def _run_job(self, job: Dict):
        """Run a specific job"""
        job_id = job.get('id')
        script = job.get('script')
        
        logger.info(f"Running job: {job_id} ({script})")
        
        try:
            # Update last run time
            self.cron_manager.update_job(job_id, {
                "last_run": datetime.utcnow().isoformat()
            })
            
            # Get task function
            task_func = self.task_registry.get_task(script)
            
            if task_func:
                # Run task function directly
                task_func()
            else:
                # Try to run as module
                result = subprocess.run(
                    [sys.executable, "-m", script],
                    capture_output=True,
                    text=True,
                    timeout=300  # 5 minute timeout
                )
                
                if result.returncode == 0:
                    logger.info(f"Job {job_id} completed successfully")
                else:
                    logger.error(f"Job {job_id} failed: {result.stderr}")
            
        except subprocess.TimeoutExpired:
            logger.error(f"Job {job_id} timed out")
        except Exception as e:
            logger.error(f"Error running job {job_id}: {e}")
    
    def run_job_now(self, job_id: str) -> bool:
        """Run a job immediately regardless of schedule"""
        job = self.cron_manager.get_job(job_id)
        if not job:
            logger.error(f"Job not found: {job_id}")
            return False
        
        try:
            self._run_job(job)
            return True
        except Exception as e:
            logger.error(f"Error running job {job_id}: {e}")
            return False
