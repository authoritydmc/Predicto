import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from automation.base.firebase_client import FirebaseClient

client = FirebaseClient()

# Clear orchestrator lock completely
client.delete('scheduler_config/orchestrator_lock')
print('Cleared orchestrator lock')
