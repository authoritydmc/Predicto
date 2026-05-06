import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from automation.base.firebase_client import FirebaseClient
from automation.scheduler.websocket_logger import WebSocketLogger
from automation.orchestrator.automation_orchestrator import AutomationOrchestrator

# Initialize components
client = FirebaseClient()
logger = WebSocketLogger(host='localhost', port=9222)
orchestrator = AutomationOrchestrator(client, logger)

# Check current task status
print("Current task status:")
for task_id, task in orchestrator.tasks.items():
    print(f"  {task_id}: status={task.status}, enabled={task.enabled}, next_run={task.next_run}")

# Manually trigger a task to test execution
print("\nManually triggering ipl_live_scraping...")
result = orchestrator.trigger_task('ipl_live_scraping')
print(f"Trigger result: {result}")

# Check if task was added to pending triggers
print(f"Pending triggers: {orchestrator._pending_triggers}")
