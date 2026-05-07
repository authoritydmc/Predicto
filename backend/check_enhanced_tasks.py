import sys
import os
from datetime import datetime
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from automation.base.firebase_client import FirebaseClient

client = FirebaseClient()

# Get current tasks
tasks_data = client.get('scheduler_config/tasks') or {}

print('Enhanced Task Status:')
print('=' * 50)

for task_id, task_data in tasks_data.items():
    print(f"Task ID: {task_id}")
    print(f"Name: {task_data.get('name')}")
    print(f"Cron Expression: {task_data.get('cron_expression', 'Not set')}")
    print(f"Enabled: {task_data.get('enabled')}")
    
    last_run = task_data.get('last_run')
    if last_run:
        last_run_time = datetime.fromtimestamp(last_run / 1000.0)
        print(f"Last Run: {last_run_time.strftime('%Y-%m-%d %H:%M:%S')}")
    else:
        print("Last Run: Never")
    
    next_run = task_data.get('next_run')
    if next_run:
        next_run_time = datetime.fromtimestamp(next_run / 1000)
        print(f"Next Run: {next_run_time.strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Calculate countdown
        current_time = int(datetime.now().timestamp() * 1000)
        if next_run > current_time:
            countdown = (next_run - current_time) // 1000
            hours = countdown // 3600
            minutes = (countdown % 3600) // 60
            seconds = countdown % 60
            print(f"Countdown: {hours}h {minutes}m {seconds}s")
        else:
            print("Countdown: Ready to run")
    
    print('-' * 50)
