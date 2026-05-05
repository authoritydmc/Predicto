import sqlite3
import os
import time
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

class JobLogger:
    """
    Manages SQLite database for job execution history
    """
    def __init__(self, db_path: str = "automation_jobs.db"):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        """Initialize the database schema"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS job_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_id TEXT NOT NULL,
                    task_name TEXT,
                    start_time INTEGER NOT NULL,
                    end_time INTEGER,
                    status TEXT,
                    error TEXT,
                    metadata TEXT
                )
            ''')
            # Create index for faster lookups
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_task_id ON job_history(task_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_start_time ON job_history(start_time)')
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"Error initializing job database: {e}")

    def log_job_start(self, task_id: str, task_name: str) -> Optional[int]:
        """Log the start of a job and return the job_id"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            start_time = int(time.time() * 1000)
            cursor.execute('''
                INSERT INTO job_history (task_id, task_name, start_time, status)
                VALUES (?, ?, ?, ?)
            ''', (task_id, task_name, start_time, 'running'))
            job_id = cursor.lastrowid
            conn.commit()
            conn.close()
            return job_id
        except Exception as e:
            print(f"Error logging job start: {e}")
            return None

    def log_job_finish(self, job_id: int, status: str, error: Optional[str] = None, metadata: Optional[Dict[str, Any]] = None):
        """Log the completion of a job"""
        if job_id is None:
            return
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            end_time = int(time.time() * 1000)
            meta_str = json.dumps(metadata) if metadata else None
            cursor.execute('''
                UPDATE job_history 
                SET end_time = ?, status = ?, error = ?, metadata = ?
                WHERE id = ?
            ''', (end_time, status, error, meta_str, job_id))
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"Error logging job finish: {e}")

    def get_history(self, task_id: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        """Fetch job history"""
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            if task_id:
                cursor.execute('''
                    SELECT * FROM job_history 
                    WHERE task_id = ? 
                    ORDER BY start_time DESC LIMIT ?
                ''', (task_id, limit))
            else:
                cursor.execute('''
                    SELECT * FROM job_history 
                    ORDER BY start_time DESC LIMIT ?
                ''', (limit,))
                
            rows = cursor.fetchall()
            result = []
            for row in rows:
                item = dict(row)
                if item['metadata']:
                    item['metadata'] = json.loads(item['metadata'])
                result.append(item)
            conn.close()
            return result
        except Exception as e:
            print(f"Error fetching job history: {e}")
            return []

    def clear_old_logs(self, days: int = 15) -> int:
        """Purge logs older than X days"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            # Calculate cutoff timestamp in milliseconds
            cutoff_date = datetime.now() - timedelta(days=days)
            cutoff_ts = int(cutoff_date.timestamp() * 1000)
            
            cursor.execute('DELETE FROM job_history WHERE start_time < ?', (cutoff_ts,))
            count = cursor.rowcount
            conn.commit()
            conn.close()
            return count
        except Exception as e:
            print(f"Error clearing old logs: {e}")
            return 0
