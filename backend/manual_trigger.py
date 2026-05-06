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

# Check tasks
print("Available tasks:")
for task_id, task in orchestrator.tasks.items():
    print(f"  {task_id}: {task.name} (status: {task.status}, enabled: {task.enabled})")

# Try to manually trigger a task
print("\nTrying to trigger ipl_live_scraping...")
result = orchestrator.trigger_task('ipl_live_scraping')
print(f"Trigger result: {result}")
