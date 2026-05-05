"""
Main Entry Point for Enhanced Automation Orchestrator
Integrates with existing scheduler and provides unified automation system
"""

import os
import sys
import signal
import threading
import argparse
import json
from typing import Dict, Any, Optional

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from automation.base.firebase_client import FirebaseClient
from automation.scheduler.websocket_logger import WebSocketLogger
from automation.orchestrator.automation_orchestrator import AutomationOrchestrator
from automation.orchestrator.enhanced_websocket_logger import EnhancedWebSocketLogger


class EnhancedAutomationSystem:
    """
    Enhanced automation system that replaces the basic scheduler
    Provides comprehensive automation with monitoring and control
    """
    
    def __init__(self):
        # Initialize Firebase client
        self.firebase_client = FirebaseClient()
        
        # Initialize enhanced logger
        self.logger = EnhancedWebSocketLogger(host='localhost', port=9222)
        
        # Initialize orchestrator
        self.orchestrator = AutomationOrchestrator(self.firebase_client, self.logger)
        
        # System state
        self.running = False
        self.shutdown_requested = False
        
        # Setup signal handlers
        self._setup_signal_handlers()
        
        # Register with logger
        self.logger.register_component('enhanced_automation', {
            'type': 'orchestrator',
            'version': '2.0.0',
            'components': ['match_manager', 'scraper_manager', 'scoring_engine', 'status_monitor', 'config_manager']
        })
        
        # Register message handler
        self.logger.message_handler = self._handle_ws_message
    
    def _handle_ws_message(self, data: Dict[str, Any]):
        """Handle incoming WebSocket messages for automation control"""
        message_type = data.get('type')
        if not message_type:
            return
            
        print(f"[EnhancedAutomation] Received message: {message_type}")
        
        try:
            result = None
            
            if message_type == 'trigger_task':
                task_id = data.get('task_id')
                result = self.orchestrator.trigger_task(task_id)
            
            elif message_type == 'add_task':
                task_data = data.get('task')
                result = self.orchestrator.add_task(task_data)
                
            elif message_type == 'update_task':
                task_id = data.get('task_id')
                updates = data.get('updates')
                result = self.orchestrator.update_task(task_id, updates)
                
            elif message_type == 'delete_task':
                task_id = data.get('task_id')
                result = self.orchestrator.delete_task(task_id)
                
            elif message_type == 'toggle_task':
                task_id = data.get('task_id')
                result = self.orchestrator.toggle_task(task_id)
                
            elif message_type == 'update_config':
                config = data.get('config')
                result = self.orchestrator.update_config(config)
            
            if result:
                # Send response back via WebSocket
                response = {
                    'type': f'{message_type}_response',
                    'data': result,
                    'timestamp': int(time.time() * 1000)
                }
                # Using broadcast for response for now, or could add send_to_client
                self.logger.broadcast('enhanced_automation', json.dumps(response))
                
        except Exception as e:
            self.logger.error('enhanced_automation', f'Error handling message {message_type}: {str(e)}')
    
    def _setup_signal_handlers(self):
        """Setup signal handlers for graceful shutdown"""
        def signal_handler(signum, frame):
            print(f"\n[EnhancedAutomation] Received signal {signum}, shutting down...")
            self.shutdown()
        
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
    
    def start(self):
        """Start the enhanced automation system"""
        if self.running:
            print("[EnhancedAutomation] System already running")
            return
        
        print("[EnhancedAutomation] Starting enhanced automation system...")
        self.logger.info('enhanced_automation', 'Starting enhanced automation system')
        
        try:
            # Start orchestrator
            self.orchestrator.start()
            self.running = True
            
            print("[EnhancedAutomation] System started successfully")
            self.logger.info('enhanced_automation', 'Enhanced automation system started')
            
            # Start monitoring thread
            self._start_monitoring_thread()
            
            # Keep main thread alive
            self._main_loop()
            
        except Exception as e:
            print(f"[EnhancedAutomation] Error starting system: {e}")
            self.logger.error('enhanced_automation', f'System start failed: {str(e)}')
            self.shutdown()
    
    def _start_monitoring_thread(self):
        """Start monitoring thread for system health"""
        def monitor():
            while self.running and not self.shutdown_requested:
                try:
                    # Get system status
                    status = self.orchestrator.get_status()
                    
                    # Log periodic status
                    self.logger.debug('enhanced_automation', 'System status check', {
                        'running_tasks': status['tasks'].get('running_tasks', 0),
                        'total_tasks': status['tasks'].get('total_tasks', 0),
                        'component_status': status.get('component_status', {})
                    })
                    
                    # Sleep for monitoring interval
                    import time
                    time.sleep(60)  # Check every minute
                    
                except Exception as e:
                    self.logger.error('enhanced_automation', f'Monitoring error: {str(e)}')
                    import time
                    time.sleep(30)
        
        monitor_thread = threading.Thread(target=monitor, daemon=True)
        monitor_thread.start()
    
    def _main_loop(self):
        """Main loop to keep system running"""
        try:
            import time
            while self.running and not self.shutdown_requested:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n[EnhancedAutomation] Keyboard interrupt received")
            self.shutdown()
    
    def shutdown(self):
        """Shutdown the enhanced automation system"""
        if self.shutdown_requested:
            return
        
        self.shutdown_requested = True
        print("[EnhancedAutomation] Shutting down...")
        self.logger.info('enhanced_automation', 'Shutting down enhanced automation system')
        
        try:
            # Stop orchestrator
            if self.orchestrator:
                self.orchestrator.stop()
            
            self.running = False
            
            print("[EnhancedAutomation] System shutdown complete")
            self.logger.info('enhanced_automation', 'Enhanced automation system shutdown complete')
            
        except Exception as e:
            print(f"[EnhancedAutomation] Error during shutdown: {e}")
            self.logger.error('enhanced_automation', f'Shutdown error: {str(e)}')
    
    def get_status(self) -> Dict[str, Any]:
        """Get current system status"""
        if not self.orchestrator:
            return {'running': False, 'error': 'Orchestrator not initialized'}
        
        return {
            'system_running': self.running,
            'shutdown_requested': self.shutdown_requested,
            'orchestrator_status': self.orchestrator.get_status(),
            'logger_status': self.logger.get_status()
        }


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Enhanced automation orchestrator')
    parser.add_argument('--trigger-task', type=str, help='Run one automation task and exit')
    args = parser.parse_args()

    print("=" * 80)
    print("ENHANCED AUTOMATION ORCHESTRATOR")
    print("=" * 80)
    
    # Create and start system
    system = EnhancedAutomationSystem()

    if args.trigger_task:
        try:
            if args.trigger_task not in system.orchestrator.tasks:
                print(json.dumps({'success': False, 'error': 'Task not found'}))
                sys.exit(1)

            system.orchestrator._run_task(args.trigger_task)
            task = system.orchestrator.tasks.get(args.trigger_task)
            if task and getattr(task.status, 'value', task.status) == 'error':
                print(json.dumps({'success': False, 'task_id': args.trigger_task, 'status': 'error'}))
                sys.exit(1)

            print(json.dumps({'success': True, 'task_id': args.trigger_task}))
            sys.exit(0)
        except Exception as e:
            print(json.dumps({'success': False, 'error': str(e)}))
            sys.exit(1)
    
    try:
        system.start()
    except Exception as e:
        print(f"Fatal error: {e}")
        system.shutdown()
        sys.exit(1)


if __name__ == '__main__':
    main()
