"""
Firebase client for Python automation scripts
Handles all Firebase operations (auth, read/write)
"""

import os
import json
from typing import Dict, Any, Optional
from datetime import datetime
import requests


class FirebaseClient:
    """Firebase Realtime Database client"""
    
    def __init__(self, config: Optional[Dict[str, str]] = None):
        """
        Initialize Firebase client
        
        Args:
            config: Firebase config dict with databaseURL, apiKey, etc.
                   If None, reads from environment variables
        """
        if config:
            self.config = config
        else:
            self.config = {
                'databaseURL': os.environ.get('FIREBASE_DATABASE_URL'),
                'apiKey': os.environ.get('FIREBASE_API_KEY'),
                'authDomain': os.environ.get('FIREBASE_AUTH_DOMAIN'),
                'projectId': os.environ.get('FIREBASE_PROJECT_ID'),
                'storageBucket': os.environ.get('FIREBASE_STORAGE_BUCKET')
            }
        
        if not self.config.get('databaseURL'):
            raise ValueError("FIREBASE_DATABASE_URL must be set")
        
        self.base_url = self.config['databaseURL']
        self.session = requests.Session()
    
    def _build_url(self, path: str) -> str:
        """Build full Firebase URL from path"""
        # Remove leading slash if present
        path = path.lstrip('/')
        return f"{self.base_url}/{path}.json"
    
    def get(self, path: str) -> Optional[Dict[str, Any]]:
        """
        Get data from Firebase
        
        Args:
            path: Firebase path (e.g., 'tournaments/ipl/matches/123')
            
        Returns:
            Data dict or None if not found
        """
        url = self._build_url(path)
        try:
            response = self.session.get(url)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
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
        url = self._build_url(path)
        try:
            response = self.session.put(url, json=data)
            response.raise_for_status()
            return True
        except requests.RequestException as e:
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
        url = self._build_url(path)
        try:
            response = self.session.patch(url, json=data)
            response.raise_for_status()
            return True
        except requests.RequestException as e:
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
        url = self._build_url(path)
        try:
            response = self.session.delete(url)
            response.raise_for_status()
            return True
        except requests.RequestException as e:
            print(f"[FirebaseClient] Error deleting {path}: {e}")
            return False
    
    def get_timestamp(self) -> int:
        """Get current timestamp in milliseconds"""
        return int(datetime.now().timestamp() * 1000)
