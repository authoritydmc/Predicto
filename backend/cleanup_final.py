import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from automation.base.firebase_client import FirebaseClient

client = FirebaseClient()

# Get current tasks
tasks_data = client.get('scheduler_config/tasks') or {}

print("Current tasks before final cleanup:")
for task_id, task_data in tasks_data.items():
    print(f"  {task_id}: {task_data.get('name')}")

# Remove all generic tasks - keep only ipl_* versions
tasks_to_remove = ['match_creation', 'reconciliation', 'scraping']
removed_count = 0

for task_id in tasks_to_remove:
    if task_id in tasks_data:
        del tasks_data[task_id]
        removed_count += 1
        print(f"Removed duplicate task: {task_id}")

# Update Firebase with cleaned tasks
client.set('scheduler_config/tasks', tasks_data)
print(f"\nFinal cleanup complete. Removed {removed_count} duplicate tasks.")

print("\nTasks after final cleanup:")
for task_id, task_data in tasks_data.items():
    print(f"  {task_id}: {task_data.get('name')}")
