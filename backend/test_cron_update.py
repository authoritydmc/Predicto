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

# Test cron update functionality
print("Testing cron update functionality...")

# Update ipl_match_discovery to run every 30 minutes instead of hourly
print("\nUpdating ipl_match_discovery cron to '*/30 * * * *'...")
result = orchestrator.update_task('ipl_match_discovery', {
    'cron_expression': '*/30 * * * *'  # Every 30 minutes
})
print(f"Update result: {result}")

# Check if task was actually updated
task = orchestrator.tasks.get('ipl_match_discovery')
if task:
    print(f"Task cron after update: {task.cron_expression}")
    print(f"Task next_run after update: {task.next_run}")

# Update ipl_live_scraping interval to 30 seconds
print("\nUpdating ipl_live_scraping interval to 30 seconds...")
result = orchestrator.update_task('ipl_live_scraping', {
    'interval_seconds': 30
})
print(f"Update result: {result}")

task = orchestrator.tasks.get('ipl_live_scraping')
if task:
    print(f"Task interval after update: {task.interval_seconds}")
    print(f"Task next_run after update: {task.next_run}")
