import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from automation.base.firebase_client import FirebaseClient
import json

client = FirebaseClient()

# Check current lock
lock_data = client.get('scheduler_config/orchestrator_lock')
print(f'Current lock: {lock_data}')

# Clear any stale locks
client.set('scheduler_config/orchestrator_lock', {
    'session_id': 'test_clear',
    'timestamp': 0
})

print('Cleared orchestrator lock')
