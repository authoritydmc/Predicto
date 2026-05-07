import json
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime

logger = logging.getLogger(__name__)

class CronManager:
    """Manages cron job configurations with CRUD operations"""
    
    def __init__(self, firebase_client=None):
        self.firebase = firebase_client
        self.collection_path = "automation_config/cron_jobs"
    
    def _get_ref(self):
        if not self.firebase:
            raise ValueError("Firebase client not initialized")
        return self.firebase.db.collection(self.collection_path)
    
    def list_jobs(self) -> List[Dict]:
        """List all cron jobs"""
        try:
            docs = self._get_ref().stream()
            jobs = []
            for doc in docs:
                job = doc.to_dict()
                job['id'] = doc.id
                jobs.append(job)
            return jobs
        except Exception as e:
            logger.error(f"Error listing cron jobs: {e}")
            return []
    
    def get_job(self, job_id: str) -> Optional[Dict]:
        """Get a specific cron job"""
        try:
            doc = self._get_ref().document(job_id).get()
            if doc.exists:
                job = doc.to_dict()
                job['id'] = doc.id
                return job
            return None
        except Exception as e:
            logger.error(f"Error getting cron job {job_id}: {e}")
            return None
    
    def add_job(self, job_id: str, config: Dict) -> bool:
        """Add a new cron job"""
        try:
            config['created_at'] = datetime.utcnow().isoformat()
            config['updated_at'] = datetime.utcnow().isoformat()
            self._get_ref().document(job_id).set(config)
            logger.info(f"Added cron job: {job_id}")
            return True
        except Exception as e:
            logger.error(f"Error adding cron job {job_id}: {e}")
            return False
    
    def update_job(self, job_id: str, updates: Dict) -> bool:
        """Update an existing cron job"""
        try:
            updates['updated_at'] = datetime.utcnow().isoformat()
            self._get_ref().document(job_id).update(updates)
            logger.info(f"Updated cron job: {job_id}")
            return True
        except Exception as e:
            logger.error(f"Error updating cron job {job_id}: {e}")
            return False
    
    def remove_job(self, job_id: str) -> bool:
        """Remove a cron job"""
        try:
            self._get_ref().document(job_id).delete()
            logger.info(f"Removed cron job: {job_id}")
            return True
        except Exception as e:
            logger.error(f"Error removing cron job {job_id}: {e}")
            return False
    
    def enable_job(self, job_id: str) -> bool:
        """Enable a cron job"""
        return self.update_job(job_id, {"enabled": True})
    
    def disable_job(self, job_id: str) -> bool:
        """Disable a cron job"""
        return self.update_job(job_id, {"enabled": False})
    
    def get_enabled_jobs(self) -> List[Dict]:
        """Get all enabled cron jobs"""
        try:
            docs = self._get_ref().where("enabled", "==", True).stream()
            jobs = []
            for doc in docs:
                job = doc.to_dict()
                job['id'] = doc.id
                jobs.append(job)
            return jobs
        except Exception as e:
            logger.error(f"Error getting enabled cron jobs: {e}")
            return []
