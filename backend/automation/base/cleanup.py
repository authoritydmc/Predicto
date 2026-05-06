#!/usr/bin/env python3
"""
Database Cleanup Script
Cleans old logs, cache data, and expired automation data
"""

import sys
import os
import time
import argparse
from datetime import datetime, timedelta
from typing import Dict, Any, List

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from base.firebase_client import FirebaseClient
from scheduler.websocket_logger import WebSocketLogger


class CleanupHelper:
    """
    Helper class for database cleanup operations
    """
    
    def __init__(self, firebase_client: FirebaseClient, logger: WebSocketLogger):
        self.client = firebase_client
        self.logger = logger
        
    def cleanup_old_logs(self, days_to_keep: int = 15) -> Dict[str, Any]:
        """Clean old execution logs and automation events"""
        try:
            self.logger.info('cleanup', f'Starting cleanup of logs older than {days_to_keep} days')
            
            # Get all log paths
            log_paths = [
                'automation_history/execution_log',
                'automation_events/script_events',
                'automation_events/migrations',
                'scheduler_config/orchestrator_lock'
            ]
            
            total_deleted = 0
            current_time = int(time.time() * 1000)
            cutoff_time = current_time - (days_to_keep * 24 * 60 * 60 * 1000)
            
            for log_path in log_paths:
                # Get all data at path
                log_data = self.client.get(log_path) or {}
                
                # Delete old entries
                for key, entry in log_data.items():
                    if isinstance(entry, dict) and 'timestamp' in entry:
                        entry_time = entry.get('timestamp', 0)
                        if entry_time < cutoff_time:
                            try:
                                self.client.delete(f"{log_path}/{key}")
                                total_deleted += 1
                                self.logger.debug('cleanup', f'Deleted old log entry: {log_path}/{key}')
                            except Exception as e:
                                self.logger.error('cleanup', f'Error deleting log entry {log_path}/{key}: {str(e)}')
                
                # Clean up empty parent nodes
                if log_data:
                    self.client.set(log_path, log_data)
            
            self.logger.info('cleanup', f'Cleanup completed: {total_deleted} old log entries deleted')
            
            return {
                'success': True,
                'deleted_count': total_deleted,
                'paths_processed': log_paths
            }
            
        except Exception as e:
            self.logger.error('cleanup', f'Error during cleanup: {str(e)}')
            return {'success': False, 'error': str(e)}
    
    def cleanup_old_cache_data(self, days_to_keep: int = 7) -> Dict[str, Any]:
        """Clean old cache data from scraper manager"""
        try:
            self.logger.info('cleanup', f'Starting cache cleanup (older than {days_to_keep} days)')
            
            # Get scraper cache
            cache_path = 'automation_config/scraper_configs'
            cache_data = self.client.get(cache_path) or {}
            
            total_deleted = 0
            current_time = int(time.time() * 1000)
            cutoff_time = current_time - (days_to_keep * 24 * 60 * 60 * 1000)
            
            # Clean old performance history
            for scraper_name, config in cache_data.items():
                if isinstance(config, dict) and 'performance_history' in config:
                    history = config['performance_history']
                    if isinstance(history, list):
                        # Keep only recent entries
                        filtered_history = [
                            entry for entry in history
                            if isinstance(entry, dict) and 'timestamp' in entry
                            and entry.get('timestamp', 0) >= cutoff_time
                        ]
                        
                        if len(filtered_history) != len(history):
                            config['performance_history'] = filtered_history
                            total_deleted += len(history) - len(filtered_history)
                            self.logger.debug('cleanup', f'Cleaned {len(history) - len(filtered_history)} old entries for {scraper_name}')
            
            # Save cleaned cache
            if total_deleted > 0:
                self.client.set(cache_path, cache_data)
            
            self.logger.info('cleanup', f'Cache cleanup completed: {total_deleted} old entries deleted')
            
            return {
                'success': True,
                'deleted_count': total_deleted,
                'scrapers_processed': len(cache_data)
            }
            
        except Exception as e:
            self.logger.error('cleanup', f'Error during cache cleanup: {str(e)}')
            return {'success': False, 'error': str(e)}
    
    def cleanup_expired_automation_locks(self, hours_to_keep: int = 24) -> Dict[str, Any]:
        """Clean expired orchestrator locks"""
        try:
            self.logger.info('cleanup', f'Starting cleanup of expired locks (older than {hours_to_keep} hours)')
            
            lock_path = 'scheduler_config/orchestrator_lock'
            lock_data = self.client.get(lock_path) or {}
            
            current_time = int(time.time() * 1000)
            cutoff_time = current_time - (hours_to_keep * 60 * 60 * 1000)
            
            total_deleted = 0
            
            # Clean old lock entries
            for key, entry in lock_data.items():
                if key != 'current_session_id':  # Don't delete current session
                    if isinstance(entry, dict) and 'timestamp' in entry:
                        entry_time = entry.get('timestamp', 0)
                        if entry_time < cutoff_time:
                            try:
                                self.client.delete(f"{lock_path}/{key}")
                                total_deleted += 1
                                self.logger.debug('cleanup', f'Deleted expired lock: {key}')
                            except Exception as e:
                                self.logger.error('cleanup', f'Error deleting lock {key}: {str(e)}')
            
            if total_deleted > 0:
                # Update remaining lock data
                if lock_data:
                    self.client.set(lock_path, lock_data)
            
            self.logger.info('cleanup', f'Lock cleanup completed: {total_deleted} expired locks deleted')
            
            return {
                'success': True,
                'deleted_count': total_deleted,
                'locks_processed': len(lock_data)
            }
            
        except Exception as e:
            self.logger.error('cleanup', f'Error during lock cleanup: {str(e)}')
            return {'success': False, 'error': str(e)}


def main():
    """Main CLI interface"""
    parser = argparse.ArgumentParser(description='Database Cleanup Script')
    parser.add_argument('--logs-days', type=int, default=15,
                       help='Days to keep execution logs (default: 15)')
    parser.add_argument('--cache-days', type=int, default=7,
                       help='Days to keep cache data (default: 7)')
    parser.add_argument('--lock-hours', type=int, default=24,
                       help='Hours to keep orchestrator locks (default: 24)')
    parser.add_argument('--env', type=str, choices=['local', 'prod'], default='prod',
                       help='Environment mode')
    
    args = parser.parse_args()
    
    try:
        # Initialize Firebase client
        firebase_client = FirebaseClient()
        logger = WebSocketLogger(firebase_client)
        
        # Initialize cleanup helper
        cleanup = CleanupHelper(firebase_client, logger)
        
        results = {}
        
        # Cleanup old logs
        results['logs'] = cleanup.cleanup_old_logs(args.logs_days)
        
        # Cleanup cache data
        results['cache'] = cleanup.cleanup_old_cache_data(args.cache_days)
        
        # Cleanup expired locks
        results['locks'] = cleanup.cleanup_expired_automation_locks(args.lock_hours)
        
        # Summary
        total_deleted = sum(result.get('deleted_count', 0) for result in results.values())
        self.logger.info('cleanup', f'Cleanup completed: {total_deleted} total items deleted')
        
        print(f"\n=== Cleanup Results ===")
        print(f"Logs: {results['logs'].get('deleted_count', 0)} deleted")
        print(f"Cache: {results['cache'].get('deleted_count', 0)} deleted")
        print(f"Locks: {results['locks'].get('deleted_count', 0)} deleted")
        print(f"Total: {total_deleted} items deleted")
        
    except Exception as e:
        print(f"Error during cleanup: {str(e)}")
        sys.exit(1)


if __name__ == '__main__':
    main()
