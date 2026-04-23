"""
Firebase client for Python automation scripts
Handles all Firebase operations (auth, read/write) using Admin SDK
"""

import os
import json
from typing import Dict, Any, Optional
from datetime import datetime
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, db

# Load environment variables from .env file (at project root)
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '..', '.env'))


class FirebaseClient:
    """Firebase Realtime Database client using Admin SDK"""
    
    def __init__(self, config: Optional[Dict[str, str]] = None):
        """
        Initialize Firebase client
        
        Args:
            config: Firebase config dict with databaseURL, etc.
                   If None, reads from environment variables
        """
        if config:
            self.config = config
        else:
            self.config = {
                'databaseURL': os.environ.get('FIREBASE_DATABASE_URL'),
                'projectId': os.environ.get('FIREBASE_PROJECT_ID'),
            }
        
        if not self.config.get('databaseURL'):
            raise ValueError("FIREBASE_DATABASE_URL must be set")
        
        # Initialize Firebase Admin SDK if not already initialized
        if not firebase_admin._apps:
            # Try to use service account from environment variable
            service_account_path = os.environ.get('FIREBASE_SERVICE_ACCOUNT_KEY')
            
            if service_account_path and os.path.exists(service_account_path):
                # Use service account key file
                cred = credentials.Certificate(service_account_path)
                print(f"[FirebaseClient] Using service account key: {service_account_path}")
            else:
                # Fall back to REST API with API key (for development without service account)
                print("[FirebaseClient] WARNING: Service account key not found, using REST API fallback")
                print("[FirebaseClient] For production, set FIREBASE_SERVICE_ACCOUNT_KEY environment variable")
                self.use_rest_api = True
                self.base_url = self.config['databaseURL']
                import requests
                self.session = requests.Session()
                return
            
            firebase_admin.initialize_app(cred, {
                'databaseURL': self.config['databaseURL']
            })
            self.use_rest_api = False
        
        self.db = db
    
    def _build_path(self, path: str) -> str:
        """Build Firebase path"""
        # Remove leading slash if present
        return path.lstrip('/')
    
    def get(self, path: str) -> Optional[Dict[str, Any]]:
        """
        Get data from Firebase
        
        Args:
            path: Firebase path (e.g., 'tournaments/ipl/matches/123')
            
        Returns:
            Data dict or None if not found
        """
        if self.use_rest_api:
            # REST API fallback
            import requests
            url = f"{self.base_url}/{self._build_path(path)}.json"
            api_key = os.environ.get('FIREBASE_API_KEY')
            if api_key:
                url += f"?key={api_key}"
            try:
                response = self.session.get(url)
                response.raise_for_status()
                return response.json()
            except requests.RequestException as e:
                print(f"[FirebaseClient] Error getting {path}: {e}")
                return None
        
        # Admin SDK path
        try:
            ref = self.db.reference(self._build_path(path))
            data = ref.get()
            return data
        except Exception as e:
            print(f"[FirebaseClient] Error getting {path}: {e}")
            return None
    
    def set(self, path: str, data: Dict[str, Any]) -> bool:
        """
        Set data at Firebase path (overwrites existing)
        
        Args:
            path: Firebase path
            data: Data to set
            
        Returns:
            True if successful, False otherwise
        """
        if self.use_rest_api:
            # REST API fallback
            import requests
            url = f"{self.base_url}/{self._build_path(path)}.json"
            try:
                response = self.session.put(url, json=data)
                response.raise_for_status()
                return True
            except requests.RequestException as e:
                print(f"[FirebaseClient] Error setting {path}: {e}")
                return False
        
        # Admin SDK path
        try:
            ref = self.db.reference(self._build_path(path))
            ref.set(data)
            return True
        except Exception as e:
            print(f"[FirebaseClient] Error setting {path}: {e}")
            return False
    
    def update(self, path: str, data: Dict[str, Any]) -> bool:
        """
        Update data at Firebase path (partial update)
        
        Args:
            path: Firebase path
            data: Data to update
            
        Returns:
            True if successful, False otherwise
        """
        if self.use_rest_api:
            # REST API fallback
            import requests
            url = f"{self.base_url}/{self._build_path(path)}.json"
            try:
                response = self.session.patch(url, json=data)
                response.raise_for_status()
                return True
            except requests.RequestException as e:
                print(f"[FirebaseClient] Error updating {path}: {e}")
                return False
        
        # Admin SDK path
        try:
            ref = self.db.reference(self._build_path(path))
            ref.update(data)
            return True
        except Exception as e:
            print(f"[FirebaseClient] Error updating {path}: {e}")
            return False
    
    def delete(self, path: str) -> bool:
        """
        Delete data at Firebase path
        
        Args:
            path: Firebase path
            
        Returns:
            True if successful, False otherwise
        """
        if self.use_rest_api:
            # REST API fallback
            import requests
            url = f"{self.base_url}/{self._build_path(path)}.json"
            try:
                response = self.session.delete(url)
                response.raise_for_status()
                return True
            except requests.RequestException as e:
                print(f"[FirebaseClient] Error deleting {path}: {e}")
                return False
        
        # Admin SDK path
        try:
            ref = self.db.reference(self._build_path(path))
            ref.delete()
            return True
        except Exception as e:
            print(f"[FirebaseClient] Error deleting {path}: {e}")
            return False
    
    def get_timestamp(self) -> int:
        """Get current timestamp in milliseconds"""
        return int(datetime.now().timestamp() * 1000)
