import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from automation.base.firebase_client import FirebaseClient
import json

client = FirebaseClient()
tasks_data = client.get('scheduler_config/tasks') or {}

print('Current tasks in Firebase:')
for task_id, task_data in tasks_data.items():
    print(f'Task: {task_id}')
    print(f'  Name: {task_data.get("name")}')
    print(f'  Status: {task_data.get("status")}')
    print(f'  Enabled: {task_data.get("enabled")}')
    print(f'  Next Run: {task_data.get("next_run")}')
    print(f'  Last Run: {task_data.get("last_run")}')
    print(f'  Interval: {task_data.get("interval_seconds")}')
    print(f'  Cron: {task_data.get("cron_expression")}')
    print()
