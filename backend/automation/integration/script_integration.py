"""
Script Integration Layer
Connects simple Windows orchestrator with isolated automation scripts
Provides clean interface between orchestrator and individual scripts
"""

import os
import sys
import json
import time
import subprocess
import threading
from typing import Dict, Any, Optional, List
from datetime import datetime

# Add project root to path
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, project_root)

# Add backend root to path for base module
backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_root not in sys.path:
    sys.path.insert(0, backend_root)

from base.firebase_client import FirebaseClient


class ScriptIntegration:
    """
    Integration layer for orchestrator and isolated scripts
    """
    
    def __init__(self, firebase_client: FirebaseClient):
        self.client = firebase_client
        
        # Script paths
        self.scripts_dir = os.path.join(project_root, 'automation', 'scripts')
        self.orchestrator_dir = os.path.join(project_root, 'automation', 'orchestrator')
        
        # Available scripts
        self.available_scripts = {
            'master_runner': {
                'path': os.path.join(self.scripts_dir, 'master_runner.py'),
                'name': 'Master Runner',
                'description': 'Central script execution hub'
            },
            'admin_dashboard': {
                'path': os.path.join(self.scripts_dir, 'admin_dashboard.py'),
                'name': 'Admin Dashboard',
                'description': 'Web-based admin interface'
            },
            'reconciliation_helper': {
                'path': os.path.join(project_root, 'automation', 'base', 'reconciliation_helper.py'),
                'name': 'Reconciliation Helper',
                'description': 'Early prediction migration and reconciliation'
            },
            'match_creator': {
                'path': os.path.join(self.orchestrator_dir, 'match_creator.py'),
                'name': 'Match Creator',
                'description': 'Automated match creation from external sources'
            },
            'cleanup': {
                'path': os.path.join(project_root, 'automation', 'base', 'cleanup.py'),
                'name': 'Database Cleanup',
                'description': 'Automated cleanup of old logs and cache'
            }
        }
    
    def run_script(self, script_key: str, args: List[str] = None, 
                  target_matches: List[str] = None, force: bool = False) -> Dict[str, Any]:
        """
        Run a specific script with proper isolation
        
        Args:
            script_key: Key of script to run
            args: Additional command line arguments
            target_matches: Target match IDs (for scoring/reconciliation)
            force: Force execution even if recently run
            
        Returns:
            Script execution result
        """
        if script_key not in self.available_scripts:
            return {'success': False, 'error': f'Unknown script: {script_key}'}
        
        script_info = self.available_scripts[script_key]
        
        try:
            # Build command
            cmd = [sys.executable, script_info['path']]
            
            # Add arguments
            if args:
                cmd.extend(args)
            
            # Add target matches
            if target_matches:
                cmd.extend(['--matches'] + target_matches)
            
            # Add force flag
            if force:
                cmd.append('--force')
            
            # Add environment
            cmd.extend(['--env', 'prod'])
            
            print(f"[ScriptIntegration] Running script: {script_info['name']}")
            print(f"[ScriptIntegration] Command: {' '.join(cmd)}")
            
            # Execute script
            start_time = time.time()
            result = subprocess.run(
                cmd,
                cwd=project_root,
                capture_output=True,
                text=True,
                timeout=300  # 5 minutes
            )
            
            execution_time = time.time() - start_time
            
            # Parse result
            if result.returncode == 0:
                print(f"[ScriptIntegration] Script completed successfully in {execution_time:.2f}s")
                print(f"[ScriptIntegration] Output: {result.stdout[:500] if result.stdout else 'No output'}")
                
                return {
                    'success': True,
                    'script_key': script_key,
                    'script_name': script_info['name'],
                    'execution_time': execution_time,
                    'output': result.stdout[:1000] if result.stdout else '',
                    'command': ' '.join(cmd)
                }
            else:
                error_msg = result.stderr[:500] if result.stderr else 'Unknown error'
                print(f"[ScriptIntegration] Script failed: {error_msg}")
                
                return {
                    'success': False,
                    'script_key': script_key,
                    'script_name': script_info['name'],
                    'execution_time': execution_time,
                    'error': error_msg,
                    'command': ' '.join(cmd)
                }
                
        except subprocess.TimeoutExpired:
            print(f"[ScriptIntegration] Script timed out after 300 seconds")
            return {
                'success': False,
                'script_key': script_key,
                'script_name': script_info['name'],
                'execution_time': 300,
                'error': 'Script execution timed out',
                'command': ' '.join(cmd)
            }
        except Exception as e:
            print(f"[ScriptIntegration] Exception running script: {str(e)}")
            return {
                'success': False,
                'script_key': script_key,
                'script_name': script_info['name'],
                'execution_time': 0,
                'error': str(e),
                'command': ' '.join(cmd) if 'cmd' in locals() else 'Unknown command'
            }
    
    def get_available_scripts(self) -> Dict[str, Any]:
        """Get all available scripts with their information"""
        return self.available_scripts
    
    def get_script_status(self, script_key: str) -> Dict[str, Any]:
        """Get status of a specific script"""
        if script_key not in self.available_scripts:
            return {'success': False, 'error': f'Unknown script: {script_key}'}
        
        script_info = self.available_scripts[script_key]
        
        # Check if script file exists
        exists = os.path.exists(script_info['path'])
        
        return {
            'script_key': script_key,
            'script_name': script_info['name'],
            'description': script_info['description'],
            'path': script_info['path'],
            'exists': exists,
            'available': True
        }
    
    def run_automation_sequence(self, sequence: List[str]) -> Dict[str, Any]:
        """
        Run a sequence of automation scripts
        
        Args:
            sequence: List of script keys to run in order
            
        Returns:
            Combined execution results
        """
        results = []
        
        for script_key in sequence:
            print(f"[ScriptIntegration] Running script {len(results)+1}/{len(sequence)}: {script_key}")
            
            result = self.run_script(script_key)
            results.append(result)
            
            # Add delay between scripts
            time.sleep(2)
        
        successful = sum(1 for r in results if r['success'])
        total = len(results)
        
        print(f"[ScriptIntegration] Sequence completed: {successful}/{total} scripts successful")
        
        return {
            'success': True,
            'sequence': sequence,
            'results': results,
            'summary': {
                'total_scripts': total,
                'successful_scripts': successful,
                'failed_scripts': total - successful
            }
        }
    
    def trigger_orchestrator_task(self, task_id: str) -> Dict[str, Any]:
        """
        Trigger a task in the orchestrator
        
        Args:
            task_id: Task ID to trigger
            
        Returns:
            Trigger result
        """
        try:
            # Use simple orchestrator to trigger task
            orchestrator_path = os.path.join(self.orchestrator_dir, 'simple_windows_orchestrator.py')
            
            cmd = [
                sys.executable,
                orchestrator_path,
                '--trigger-task', task_id,
                '--console-log'
            ]
            
            print(f"[ScriptIntegration] Triggering orchestrator task: {task_id}")
            print(f"[ScriptIntegration] Command: {' '.join(cmd)}")
            
            result = subprocess.run(
                cmd,
                cwd=project_root,
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.returncode == 0:
                print(f"[ScriptIntegration] Task triggered successfully")
                return {'success': True, 'task_id': task_id}
            else:
                error_msg = result.stderr[:200] if result.stderr else 'Unknown error'
                print(f"[ScriptIntegration] Task trigger failed: {error_msg}")
                return {'success': False, 'error': error_msg}
                
        except Exception as e:
            print(f"[ScriptIntegration] Exception triggering task: {str(e)}")
            return {'success': False, 'error': str(e)}


def main():
    """Main CLI interface for script integration"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Script Integration Layer')
    parser.add_argument('--action', type=str, 
                       choices=['run', 'status', 'list', 'list-scripts', 'sequence', 'trigger'], 
                       required=True, help='Action to perform')
    parser.add_argument('--script', type=str,
                       help='Script key to run (for run action)')
    parser.add_argument('--args', nargs='*', default=[],
                       help='Arguments for script (for run action)')
    parser.add_argument('--matches', nargs='*', default=[],
                       help='Target matches (for run action)')
    parser.add_argument('--force', action='store_true',
                       help='Force execution (for run action)')
    parser.add_argument('--list-scripts', action='store_true',
                       help='List available scripts (for list action)')
    parser.add_argument('--sequence', nargs='*', default=[],
                       help='Script sequence to run (for sequence action)')
    parser.add_argument('--task', type=str,
                       help='Task ID to trigger (for trigger action)')
    
    args = parser.parse_args()
    
    try:
        # Initialize Firebase client
        firebase_client = FirebaseClient()
        integration = ScriptIntegration(firebase_client)
        
        if args.action == 'run':
            if not args.script:
                parser.error('--script required for run action')
                sys.exit(1)
            
            result = integration.run_script(args.script, args.args, args.matches, args.force)
            print(f"Result: {json.dumps(result, indent=2)}")
            
        elif args.action == 'status':
            if not args.script:
                parser.error('--script required for status action')
                sys.exit(1)
            
            status = integration.get_script_status(args.script)
            print(f"Status: {json.dumps(status, indent=2)}")
            
        elif args.action == 'list':
            scripts = integration.get_available_scripts()
            print(f"Available Scripts: {json.dumps(scripts, indent=2)}")
            
        elif args.action == 'list-scripts':
            scripts = integration.get_available_scripts()
            print(f"Available Scripts: {json.dumps(scripts, indent=2)}")
            
        elif args.action == 'sequence':
            if not args.sequence:
                parser.error('--sequence required for sequence action')
                sys.exit(1)
            
            result = integration.run_automation_sequence(args.sequence)
            print(f"Sequence Result: {json.dumps(result, indent=2)}")
            
        elif args.action == 'trigger':
            if not args.task:
                parser.error('--task required for trigger action')
                sys.exit(1)
            
            result = integration.trigger_orchestrator_task(args.task)
            print(f"Trigger Result: {json.dumps(result, indent=2)}")
            
        else:
            parser.print_help()
            sys.exit(1)
            
    except Exception as e:
        print(f"Fatal error: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    main()
