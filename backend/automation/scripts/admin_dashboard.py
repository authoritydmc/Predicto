#!/usr/bin/env python3
"""
Admin Dashboard Script
Provides web interface to control automation scripts
"""

import sys
import os
import json
import time
import argparse
from typing import Dict, Any, List
from datetime import datetime, timedelta

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from base.firebase_client import FirebaseClient
from scheduler.websocket_logger import WebSocketLogger


class AdminDashboard:
    """
    Web-based admin dashboard for automation control
    """
    
    def __init__(self, firebase_client: FirebaseClient, logger: WebSocketLogger):
        self.client = firebase_client
        self.logger = logger
        
    def get_system_status(self) -> Dict[str, Any]:
        """Get comprehensive system status"""
        try:
            # Get automation status
            automation_config = self.client.get('scheduler_config') or {}
            tasks = automation_config.get('tasks', {})
            
            # Get recent execution history
            execution_history = self.client.get('automation_history/execution_log') or {}
            recent_executions = list(execution_history.values())[-10:]  # Last 10
            
            # Get live matches
            live_matches = self._get_live_matches()
            
            # Get system health
            system_health = {
                'orchestrator': self._get_orchestrator_status(),
                'database': self._get_database_status(),
                'scrapers': self._get_scraper_status()
            }
            
            return {
                'timestamp': int(time.time() * 1000),
                'tasks': {
                    task_id: {
                        'name': task.get('name', 'Unknown'),
                        'status': task.get('status', 'idle'),
                        'last_run': task.get('last_run'),
                        'next_run': task.get('next_run'),
                        'enabled': task.get('enabled', False),
                        'error': task.get('error_message')
                    }
                    for task_id, task in tasks.items()
                },
                'recent_executions': recent_executions,
                'live_matches': live_matches,
                'system_health': system_health,
                'statistics': self._get_system_statistics()
            }
            
        except Exception as e:
            self.logger.error('admin_dashboard', f'Error getting system status: {str(e)}')
            return {'error': str(e)}
    
    def _get_live_matches(self) -> List[Dict[str, Any]]:
        """Get all live matches"""
        try:
            tournaments = self.client.get('prod/tournaments') or {}
            live_matches = []
            
            for sport, tournament_data in tournaments.items():
                matches = tournament_data.get('matches', {})
                for match_id, match_data in matches.items():
                    status = match_data.get('status', '')
                    if status in ['live', 'in_progress']:
                        live_matches.append({
                            'match_id': match_id,
                            'sport': sport,
                            'tournament_id': tournament_data.get('id', 'unknown'),
                            'teams': f"{match_data.get('teamA', 'N/A')} vs {match_data.get('teamB', 'N/A')}",
                            'status': status,
                            'last_update': match_data.get('lastScoreUpdate', 0)
                        })
            
            return live_matches
            
        except Exception as e:
            self.logger.error('admin_dashboard', f'Error getting live matches: {str(e)}')
            return []
    
    def _get_orchestrator_status(self) -> Dict[str, Any]:
        """Get orchestrator status"""
        try:
            lock_data = self.client.get('scheduler_config/orchestrator_lock')
            return {
                'running': lock_data is not None,
                'session_id': lock_data.get('session_id') if lock_data else None,
                'last_heartbeat': lock_data.get('timestamp') if lock_data else None,
                'status': 'active' if lock_data and lock_data.get('timestamp', 0) > (int(time.time() * 1000) - 60000) else 'inactive'
            }
        except Exception as e:
            return {'error': str(e)}
    
    def _get_database_status(self) -> Dict[str, Any]:
        """Get database connection status"""
        try:
            # Test database connectivity
            start_time = time.time()
            test_data = self.client.get('prod/tournaments')
            response_time = (time.time() - start_time) * 1000
            
            return {
                'connected': test_data is not None,
                'response_time_ms': int(response_time),
                'last_check': int(time.time() * 1000)
            }
        except Exception as e:
            return {'connected': False, 'error': str(e)}
    
    def _get_scraper_status(self) -> Dict[str, Any]:
        """Get scraper configuration and status"""
        try:
            scraper_configs = self.client.get('automation_config/scraper_configs') or {}
            return {
                'total_scrapers': len(scraper_configs),
                'enabled_scrapers': len([s for s in scraper_configs.values() if s.get('enabled', False)]),
                'scrapers': {
                    name: {
                        'enabled': config.get('enabled', False),
                        'priority': config.get('priority', 0),
                        'success_rate': config.get('success_rate', 0.0),
                        'last_success': config.get('last_success'),
                        'consecutive_failures': config.get('consecutive_failures', 0)
                    }
                    for name, config in scraper_configs.items()
                }
            }
        except Exception as e:
            return {'error': str(e)}
    
    def _get_system_statistics(self) -> Dict[str, Any]:
        """Get system performance statistics"""
        try:
            # Get execution history for statistics
            execution_history = self.client.get('automation_history/execution_log') or {}
            
            if not execution_history:
                return {'total_executions': 0}
            
            executions = list(execution_history.values())
            
            # Calculate statistics
            total_executions = len(executions)
            successful_executions = len([e for e in executions if e.get('success', False)])
            failed_executions = total_executions - successful_executions
            
            # Calculate average execution time
            execution_times = [e.get('duration', 0) for e in executions if e.get('duration')]
            avg_execution_time = sum(execution_times) / len(execution_times) if execution_times else 0
            
            # Calculate success rate by script type
            script_stats = {}
            for execution in executions:
                script_key = execution.get('script_key', 'unknown')
                if script_key not in script_stats:
                    script_stats[script_key] = {'success': 0, 'total': 0}
                script_stats[script_key]['total'] += 1
                if execution.get('success', False):
                    script_stats[script_key]['success'] += 1
            
            # Calculate success rates
            for script_key, stats in script_stats.items():
                stats['success_rate'] = (stats['success'] / stats['total']) * 100 if stats['total'] > 0 else 0
            
            return {
                'total_executions': total_executions,
                'successful_executions': successful_executions,
                'failed_executions': failed_executions,
                'overall_success_rate': (successful_executions / total_executions) * 100 if total_executions > 0 else 0,
                'average_execution_time': round(avg_execution_time, 2),
                'script_performance': script_stats
            }
            
        except Exception as e:
            return {'error': str(e)}
    
    def trigger_manual_script(self, script_key: str, args: List[str] = None, 
                          target_matches: List[str] = None, force: bool = False) -> Dict[str, Any]:
        """Trigger manual script execution"""
        try:
            self.logger.info('admin_dashboard', f'Manual trigger requested: {script_key}')
            
            # Create manual execution record
            execution_data = {
                'script_key': script_key,
                'triggered_by': 'admin_dashboard',
                'manual_args': args or [],
                'target_matches': target_matches or [],
                'force': force,
                'timestamp': int(time.time() * 1000)
            }
            
            # Store manual trigger
            self.client.set('automation_events/manual_triggers', execution_data)
            
            # Import and run master runner
            from master_runner import AutomationRunner
            runner = AutomationRunner(self.client, self.logger)
            
            # Execute script
            result = runner.run_script(script_key, args, target_matches, force)
            
            return result
            
        except Exception as e:
            self.logger.error('admin_dashboard', f'Error triggering manual script: {str(e)}')
            return {'success': False, 'error': str(e)}
    
    def get_available_scripts(self) -> Dict[str, Any]:
        """Get all available automation scripts"""
        from master_runner import AutomationRunner
        runner = AutomationRunner(self.client, self.logger)
        return runner.get_available_scripts()
    
    def get_script_execution_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get script execution history"""
        try:
            execution_history = self.client.get('automation_history/execution_log') or {}
            executions = list(execution_history.values())
            
            # Sort by timestamp descending
            executions.sort(key=lambda x: x.get('timestamp', 0), reverse=True)
            
            return executions[:limit]
            
        except Exception as e:
            self.logger.error('admin_dashboard', f'Error getting execution history: {str(e)}')
            return []


def main():
    """Main CLI interface"""
    parser = argparse.ArgumentParser(description='Admin Dashboard Script')
    parser.add_argument('--action', type=str, 
                       choices=['status', 'trigger', 'scripts', 'history'], 
                       required=True, help='Action to perform')
    parser.add_argument('--script', type=str,
                       help='Script key to trigger (for trigger action)')
    parser.add_argument('--args', nargs='*', default=[],
                       help='Arguments for script (for trigger action)')
    parser.add_argument('--matches', nargs='*', default=[],
                       help='Target matches (for trigger action)')
    parser.add_argument('--force', action='store_true',
                       help='Force execution (for trigger action)')
    parser.add_argument('--limit', type=int, default=20,
                       help='History limit (default: 20)')
    parser.add_argument('--env', type=str, choices=['local', 'prod'], default='prod',
                       help='Environment mode')
    
    args = parser.parse_args()
    
    try:
        # Initialize Firebase client
        firebase_client = FirebaseClient()
        logger = WebSocketLogger(firebase_client)
        
        # Initialize dashboard
        dashboard = AdminDashboard(firebase_client, logger)
        
        if args.action == 'status':
            # Get system status
            status = dashboard.get_system_status()
            print(json.dumps(status, indent=2))
            
        elif args.action == 'trigger':
            # Trigger manual script
            if not args.script:
                parser.error('--script required for trigger action')
                sys.exit(1)
            
            result = dashboard.trigger_manual_script(
                args.script, args.args, args.matches, args.force
            )
            print(json.dumps(result, indent=2))
            
        elif args.action == 'scripts':
            # Get available scripts
            scripts = dashboard.get_available_scripts()
            print(json.dumps(scripts, indent=2))
            
        elif args.action == 'history':
            # Get execution history
            history = dashboard.get_script_execution_history(args.limit)
            print(json.dumps(history, indent=2))
            
        else:
            parser.print_help()
            
    except Exception as e:
        print(f"Error: {str(e)}")
        sys.exit(1)


if __name__ == '__main__':
    main()
