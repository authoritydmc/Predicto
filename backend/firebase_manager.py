import os
import json
import firebase_admin
from firebase_admin import credentials, db

def setup_firebase():
    try:
        if not firebase_admin._apps:
            # First, check for standard FIREBASE_SERVICE_ACCOUNT variable
            sa_json = os.getenv("FIREBASE_SERVICE_ACCOUNT")
            if sa_json:
                service_account_info = json.loads(sa_json)
                if "private_key" in service_account_info:
                    service_account_info["private_key"] = service_account_info["private_key"].replace("\\n", "\n")
                cred = credentials.Certificate(service_account_info)
            else:
                # Fallback to local credentials file path if it exists
                cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
                if cred_path and os.path.exists(cred_path):
                    cred = credentials.Certificate(cred_path)
                else:
                    raise Exception("No valid Firebase credentials found in ENV.")

            # Database URL can be explicitly set or defaulted
            database_url = os.getenv("FIREBASE_DATABASE_URL", "https://indusind-5529e.firebaseio.com")
            
            firebase_admin.initialize_app(cred, {
                'databaseURL': database_url
            })
    except Exception as e:
        print(f"Failed to configure Firebase: {e}")
        import sys
        sys.exit(1)


class FirebaseManager:
    """Firebase manager class for automation system"""
    
    def __init__(self):
        setup_firebase()
        self.db = db
