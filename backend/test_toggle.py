import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from automation.base.firebase_client import FirebaseClient
from automation.orchestrator.enhanced_websocket_logger import EnhancedWebSocketLogger
from automation.orchestrator.automation_orchestrator import AutomationOrchestrator

# Initialize components
client = FirebaseClient()
logger = EnhancedWebSocketLogger(host='localhost', port=9222)
orchestrator = AutomationOrchestrator(client, logger)

# Test toggle functionality
print("Testing toggle functionality...")

# Disable ipl_reconciliation task
print("\nDisabling ipl_reconciliation...")
result = orchestrator.toggle_task('ipl_reconciliation')
print(f"Toggle result: {result}")

# Check if task was actually disabled
task = orchestrator.tasks.get('ipl_reconciliation')
if task:
    print(f"Task status after toggle: enabled={task.enabled}")

# Wait a moment and check Firebase
import time
time.sleep(2)

# Re-enable the task
print("\nRe-enabling ipl_reconciliation...")
result = orchestrator.toggle_task('ipl_reconciliation')
print(f"Toggle result: {result}")

task = orchestrator.tasks.get('ipl_reconciliation')
if task:
    print(f"Task status after re-toggle: enabled={task.enabled}")
