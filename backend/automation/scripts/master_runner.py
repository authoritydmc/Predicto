#!/usr/bin/env python3
"""
Master Automation Script Runner
Provides centralized execution of all automation scripts with proper logging,
event triggers, and admin controls.
"""

import sys
import os
import json
import time
import argparse
import subprocess
from typing import Dict, Any, List, Optional
from datetime import datetime
from pathlib import Path

# Add project root to path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

from base.firebase_client import FirebaseClient
from scheduler.websocket_logger import WebSocketLogger


class AutomationRunner:
    """
    Master automation runner with isolated script execution
    """
    
    def __init__(self, firebase_client: FirebaseClient, logger: WebSocketLogger):
        self.client = firebase_client
        self.logger = logger
        self.scripts_dir = Path(__file__).parent
        
        # Available automation scripts
        self.scripts = {
            'scraping': {
                'name': 'Live Match Scraping',
                'description': 'Scrape live scores for active matches',
                'script': 'scraper_manager.py',
                'module': 'automation.orchestrator.scraper_manager',
                'class': 'ScraperManager'
            },
            'scoring': {
                'name': 'Match Score Calculation',
                'description': 'Calculate scores and reconcile predictions',
                'script': 'automation/cricket/run_calculator.py',
                'module': None,  # Direct script execution
                'args': ['--env', 'prod']
            },
            'reconciliation': {
                'name': 'Early Prediction Migration',
                'description': 'Migrate early predictions to live format',
                'script': 'automation/base/reconciliation_helper.py',
                'module': 'automation.base.reconciliation_helper',
                'args': []
            },
            'match_creation': {
                'name': 'Match Creation',
                'description': 'Create new matches from external sources',
                'script': 'automation/orchestrator/match_creator.py',
                'module': 'automation.orchestrator.match_creator',
                'args': []
            },
            'cleanup': {
                'name': 'Database Cleanup',
                'description': 'Clean old logs and cache data',
                'script': 'automation/base/cleanup.py',
                'module': 'automation.base.cleanup',
                'args': []
            }
        }
        
        # Execution tracking
        self.execution_history: List[Dict[str, Any]] = []
    
    def run_script(self, script_key: str, manual_args: List[str] = None, 
                  target_matches: List[str] = None, force: bool = False) -> Dict[str, Any]:
        """
        Execute a specific automation script with proper tracking
        
        Args:
            script_key: Key of script to run
            manual_args: Additional command line arguments
            target_matches: Specific match IDs to process (for scoring/reconciliation)
            force: Force execution even if already run recently
            
        Returns:
            Execution result
        """
        if script_key not in self.scripts:
            return {'success': False, 'error': f'Unknown script: {script_key}'}
        
        script_info = self.scripts[script_key]
        start_time = time.time()
        
        try:
            # Log execution start
            execution_id = f"{script_key}_{int(start_time * 1000)}"
            self.logger.info('master_runner', f'Starting script execution: {script_info["name"]} (ID: {execution_id})')
            
            # Prepare command
            cmd = [sys.executable, script_info['script']]
            
            # Add default arguments
            if script_info.get('args'):
                cmd.extend(script_info['args'])
            
            # Add manual arguments
            if manual_args:
                cmd.extend(manual_args)
            
            # Add target matches for scoring/reconciliation
            if target_matches:
                cmd.extend(['--matches'] + target_matches)
            
            # Add force flag
            if force:
                cmd.append('--force')
            
            # Add environment
            env = os.environ.get('APP_MODE', 'prod')
            cmd.extend(['--env', env])
            
            self.logger.info('master_runner', f'Executing command: {" ".join(cmd)}')
            
            # Execute script
            result = subprocess.run(
                cmd,
                cwd=str(self.scripts_dir.parent.parent),
                capture_output=True,
                text=True,
                timeout=300  # 5 minutes
            )
            
            execution_time = time.time() - start_time
            
            # Track execution
            execution_record = {
                'execution_id': execution_id,
                'script_key': script_key,
                'script_name': script_info['name'],
                'start_time': int(start_time * 1000),
                'end_time': int(time.time() * 1000),
                'duration': execution_time,
                'success': result.returncode == 0,
                'command': ' '.join(cmd),
                'args': manual_args or [],
                'target_matches': target_matches or [],
                'force': force,
                'output': result.stdout[:1000] if result.stdout else '',
                'error': result.stderr[:500] if result.stderr else ''
            }
            
            self.execution_history.append(execution_record)
            
            if result.returncode == 0:
                self.logger.info('master_runner', f'Script completed successfully: {script_info["name"]} in {execution_time:.2f}s')
                
                # Trigger event for successful completion
                self._trigger_script_event('script_completed', execution_record)
                
                return {
                    'success': True,
                    'execution_id': execution_id,
                    'duration': execution_time,
                    'output': result.stdout[:1000] if result.stdout else '',
                    'script_key': script_key
                }
            else:
                self.logger.error('master_runner', f'Script failed: {script_info["name"]} - {result.stderr[:200] if result.stderr else "Unknown error"}')
                
                # Trigger event for failure
                self._trigger_script_event('script_failed', execution_record)
                
                return {
                    'success': False,
                    'execution_id': execution_id,
                    'duration': execution_time,
                    'error': result.stderr[:500] if result.stderr else 'Script failed',
                    'script_key': script_key
                }
                
        except subprocess.TimeoutExpired:
            self.logger.error('master_runner', f'Script timed out: {script_info["name"]}')
            return {
                'success': False,
                'execution_id': execution_id,
                'duration': 300,
                'error': 'Script execution timed out',
                'script_key': script_key
            }
        except Exception as e:
            self.logger.error('master_runner', f'Exception executing script {script_info["name"]}: {str(e)}')
            return {
                'success': False,
                'execution_id': execution_id,
                'duration': time.time() - start_time,
                'error': str(e),
                'script_key': script_key
            }
    
    def _trigger_script_event(self, event_type: str, execution_record: Dict[str, Any]):
        """Trigger automation event for other scripts to respond to"""
        try:
            event_data = {
                'type': 'script_execution_event',
                'eventType': event_type,
                'script_key': execution_record['script_key'],
                'execution_id': execution_record['execution_id'],
                'timestamp': int(time.time() * 1000),
                'data': execution_record
            }
            
            # Store event in Firebase for other automation components
            self.client.set('automation_events/script_events', event_data)
            self.logger.info('master_runner', f'Triggered event: {event_type} for {execution_record["script_key"]}')
            
        except Exception as e:
            self.logger.error('master_runner', f'Failed to trigger event: {str(e)}')
    
    def get_live_matches(self) -> List[str]:
        """Get all active matches that need scraping/scoring"""
        try:
            # Get all tournaments
            tournaments = self.client.get('prod/tournaments') or {}
            
            live_matches = []
            for sport, tournament_data in tournaments.items():
                matches = tournament_data.get('matches', {})
                for match_id, match_data in matches.items():
                    status = match_data.get('status', '')
                    if status in ['live', 'in_progress']:
                        live_matches.append(f"{sport}/{tournament_id}/{match_id}")
            
            self.logger.info('master_runner', f'Found {len(live_matches)} live matches: {live_matches}')
            return live_matches
            
        except Exception as e:
            self.logger.error('master_runner', f'Error getting live matches: {str(e)}')
            return []
    
    def get_execution_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get recent script execution history"""
        return self.execution_history[-limit:] if self.execution_history else []
    
    def get_available_scripts(self) -> Dict[str, Any]:
        """Get information about available automation scripts"""
        return self.scripts
    
    def save_execution_history(self):
        """Save execution history to Firebase"""
        try:
            self.client.set('automation_history/execution_log', self.execution_history[-100:])  # Keep last 100 executions
            self.logger.info('master_runner', 'Execution history saved to Firebase')
        except Exception as e:
            self.logger.error('master_runner', f'Failed to save execution history: {str(e)}')


def main():
    """Main CLI interface for master automation runner"""
    parser = argparse.ArgumentParser(description='Master Automation Script Runner')
    parser.add_argument('--script', type=str, 
                       help='Script key to run (scraping, scoring, reconciliation, match_creation, cleanup)')
    parser.add_argument('--args', nargs='*', default=[],
                       help='Additional arguments to pass to the script')
    parser.add_argument('--matches', nargs='*', default=[],
                       help='Target specific match IDs (for scoring/reconciliation)')
    parser.add_argument('--force', action='store_true',
                       help='Force execution even if already run recently')
    parser.add_argument('--list-scripts', action='store_true',
                       help='List all available automation scripts')
    parser.add_argument('--live-matches', action='store_true',
                       help='Get all live matches for processing')
    parser.add_argument('--history', type=int, default=20,
                       help='Get execution history (default: last 20 executions)')
    parser.add_argument('--env', type=str, choices=['local', 'prod'], default='prod',
                       help='Environment mode (local or prod)')
    
    args = parser.parse_args()
    
    # Initialize Firebase client
    try:
        firebase_client = FirebaseClient()
        logger = WebSocketLogger(firebase_client)
    except Exception as e:
        print(f"Error initializing Firebase: {e}")
        sys.exit(1)
    
    # Initialize runner
    runner = AutomationRunner(firebase_client, logger)
    
    if args.list_scripts:
        # List available scripts
        scripts = runner.get_available_scripts()
        print("\n=== Available Automation Scripts ===")
        for key, info in scripts.items():
            print(f"\n{key}:")
            print(f"  Name: {info['name']}")
            print(f"  Description: {info['description']}")
            print(f"  Script: {info['script']}")
            if info.get('args'):
                print(f"  Default Args: {info['args']}")
            print()
        sys.exit(0)

    try:
        if args.live_matches:
            # List available scripts
            scripts = runner.get_available_scripts()
            print("\n=== Available Automation Scripts ===")
            for key, info in scripts.items():
                print(f"\n{key}:")
                print(f"  Name: {info['name']}")
                print(f"  Description: {info['description']}")
                print(f"  Script: {info['script']}")
                if info.get('args'):
                    print(f"  Default Args: {info['args']}")
                print()
        
        elif args.live_matches:
            # Get live matches
            live_matches = runner.get_live_matches()
            print(f"\n=== Live Matches ({len(live_matches)}) ===")
            for match in live_matches:
                print(f"  {match}")
        
        elif args.history:
            # Get execution history
            history = runner.get_execution_history(args.history)
            print(f"\n=== Execution History (Last {args.history}) ===")
            for i, record in enumerate(reversed(history)):
                status = "✅ SUCCESS" if record['success'] else "❌ FAILED"
                print(f"{i+1}: {status} {record['script_name']} ({record['duration']:.1f}s)")
                print(f"    Command: {record['command']}")
                if record.get('target_matches'):
                    targets_str = ', '.join(record['target_matches'])
                    print(f"    Targets: {targets_str}")
                if record.get('error'):
                    print(f"    Error: {record['error']}")
                print()
        
        else:
            # Run specific script
            if not args.script:
                parser.print_help()
                sys.exit(1)
            
            # Execute script
            result = runner.run_script(
                script_key=args.script,
                manual_args=args.args,
                target_matches=args.matches,
                force=args.force
            )
            
            # Display result
            print(f"\n=== Script Execution Result ===")
            print(f"Script: {result['script_key']}")
            print(f"Success: {result['success']}")
            print(f"Duration: {result['duration']:.2f}s")
            print(f"Execution ID: {result['execution_id']}")
            
            if result['success']:
                print(f"Output: {result['output']}")
            if result['error']:
                print(f"Error: {result['error']}")
            
            # Save execution history
            runner.save_execution_history()
            
    except KeyboardInterrupt:
        print("\nScript execution interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"Unexpected error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
