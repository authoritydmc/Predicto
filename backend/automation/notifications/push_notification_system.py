"""
Push Notification System
Manages user preferences and delivers individual push notifications
"""

import asyncio
import json
import uuid
from typing import Dict, Any, List, Optional, Set
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum

from .notification_base import (
    NotificationMessage, NotificationConfig, NotificationProvider,
    NotificationStatus, NotificationPriority, NotificationType,
    NotificationEvent
)
from ..base.firebase_client import FirebaseClient
from ..scheduler.websocket_logger import WebSocketLogger


class PushNotificationType(Enum):
    """Push notification delivery methods"""
    FIREBASE_CLOUD_MESSAGING = "fcm"
    WEB_PUSH_API = "web_push"
    DESKTOP_NOTIFICATION = "desktop"
    EMAIL_PUSH = "email_push"


class UserNotificationPreference(Enum):
    """User notification preference levels"""
    ALL = "all"                    # All notifications
    IMPORTANT_ONLY = "important"   # Only high/critical priority
    MATCHES_ONLY = "matches"       # Only match-related events
    NONE = "none"                  # No notifications


@dataclass
class UserDevice:
    """User device registration for push notifications"""
    device_id: str
    user_id: str
    device_type: str  # 'web', 'mobile', 'desktop'
    token: str
    platform: str  # 'chrome', 'firefox', 'ios', 'android'
    enabled: bool = True
    last_active: datetime = field(default_factory=datetime.now)
    created_at: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'device_id': self.device_id,
            'user_id': self.user_id,
            'device_type': self.device_type,
            'token': self.token,
            'platform': self.platform,
            'enabled': self.enabled,
            'last_active': self.last_active.isoformat(),
            'created_at': self.created_at.isoformat(),
            'metadata': self.metadata
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'UserDevice':
        return cls(
            device_id=data['device_id'],
            user_id=data['user_id'],
            device_type=data['device_type'],
            token=data['token'],
            platform=data['platform'],
            enabled=data.get('enabled', True),
            last_active=datetime.fromisoformat(data['last_active']),
            created_at=datetime.fromisoformat(data['created_at']),
            metadata=data.get('metadata', {})
        )


@dataclass
class UserNotificationSettings:
    """User notification preferences"""
    user_id: str
    global_preference: UserNotificationPreference = UserNotificationPreference.ALL
    enabled: bool = True
    quiet_hours: Dict[str, Any] = field(default_factory=dict)  # {enabled: bool, start: "22:00", end: "08:00"}
    notification_types: Dict[str, bool] = field(default_factory=dict)  # event_type -> enabled
    devices: List[str] = field(default_factory=list)  # device_ids
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    
    def __post_init__(self):
        """Initialize default notification type preferences"""
        if not self.notification_types:
            self.notification_types = {
                'match.created': True,
                'match.started': True,
                'match.completed': True,
                'match.score_updated': False,  # Disabled by default (too frequent)
                'automation.error': True,
                'automation.started': False,
                'automation.stopped': True,
                'scraper.error': True,
                'scoring.completed': True,
                'system.alert': True
            }
        
        if not self.quiet_hours:
            self.quiet_hours = {
                'enabled': False,
                'start': '22:00',
                'end': '08:00',
                'timezone': 'UTC'
            }
    
    def should_receive_notification(self, notification: NotificationMessage) -> bool:
        """Check if user should receive this notification"""
        if not self.enabled:
            return False
        
        # Check quiet hours
        if self.quiet_hours.get('enabled', False):
            if self._is_in_quiet_hours():
                # Only allow critical notifications during quiet hours
                if notification.priority != NotificationPriority.CRITICAL:
                    return False
        
        # Check global preference
        if self.global_preference == UserNotificationPreference.NONE:
            return False
        elif self.global_preference == UserNotificationPreference.IMPORTANT_ONLY:
            if notification.priority not in [NotificationPriority.HIGH, NotificationPriority.CRITICAL]:
                return False
        elif self.global_preference == UserNotificationPreference.MATCHES_ONLY:
            if not notification.type.value.startswith('match'):
                return False
        
        # Check specific notification type
        event_type = notification.type.value.replace('_', '.')
        if not self.notification_types.get(event_type, True):
            return False
        
        return True
    
    def _is_in_quiet_hours(self) -> bool:
        """Check if current time is in quiet hours"""
        try:
            from datetime import datetime
            import pytz
            
            # Get user's timezone or default to UTC
            timezone_str = self.quiet_hours.get('timezone', 'UTC')
            tz = pytz.timezone(timezone_str)
            
            # Get current time in user's timezone
            now = datetime.now(tz)
            current_time = now.strftime('%H:%M')
            
            start_time = self.quiet_hours.get('start', '22:00')
            end_time = self.quiet_hours.get('end', '08:00')
            
            # Handle overnight quiet hours (e.g., 22:00 to 08:00)
            if start_time > end_time:
                return current_time >= start_time or current_time <= end_time
            else:
                return start_time <= current_time <= end_time
                
        except Exception:
            # If timezone parsing fails, don't apply quiet hours
            return False
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'user_id': self.user_id,
            'global_preference': self.global_preference.value,
            'enabled': self.enabled,
            'quiet_hours': self.quiet_hours,
            'notification_types': self.notification_types,
            'devices': self.devices,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'UserNotificationSettings':
        return cls(
            user_id=data['user_id'],
            global_preference=UserNotificationPreference(data.get('global_preference', 'all')),
            enabled=data.get('enabled', True),
            quiet_hours=data.get('quiet_hours', {}),
            notification_types=data.get('notification_types', {}),
            devices=data.get('devices', []),
            created_at=datetime.fromisoformat(data['created_at']),
            updated_at=datetime.fromisoformat(data['updated_at'])
        )


class PushNotificationManager:
    """
    Manages push notifications and user preferences
    """
    
    def __init__(self, firebase_client: FirebaseClient, logger: WebSocketLogger):
        self.client = firebase_client
        self.logger = logger
        self.running = False
        
        # User settings cache
        self.user_settings_cache: Dict[str, UserNotificationSettings] = {}
        self.user_devices_cache: Dict[str, List[UserDevice]] = {}
        
        # Push providers
        self.push_providers: Dict[str, Any] = {}
        
        # Statistics
        self.stats = {
            'total_sent': 0,
            'total_failed': 0,
            'users_notified': 0,
            'devices_notified': 0,
            'last_sent': None
        }
    
    async def start(self):
        """Start the push notification manager"""
        if self.running:
            return
        
        self.running = True
        self.logger.info('push_notifications', 'Push notification manager starting')
        
        # Initialize push providers
        await self._initialize_providers()
        
        # Load user settings
        await self._load_user_settings()
        
        self.logger.info('push_notifications', 'Push notification manager started')
    
    async def stop(self):
        """Stop the push notification manager"""
        self.running = False
        self.logger.info('push_notifications', 'Push notification manager stopped')
    
    async def _initialize_providers(self):
        """Initialize push notification providers"""
        # Initialize Firebase Cloud Messaging
        try:
            # TODO: Initialize FCM provider
            pass
        except Exception as e:
            self.logger.error('push_notifications', f'Failed to initialize FCM: {str(e)}')
        
        # Initialize Web Push API
        try:
            # TODO: Initialize Web Push provider
            pass
        except Exception as e:
            self.logger.error('push_notifications', f'Failed to initialize Web Push: {str(e)}')
    
    async def _load_user_settings(self):
        """Load user notification settings from Firebase"""
        try:
            # Load all user settings
            settings_data = self.client.get('user_notification_settings') or {}
            
            for user_id, settings_data in settings_data.items():
                self.user_settings_cache[user_id] = UserNotificationSettings.from_dict(settings_data)
            
            # Load all user devices
            devices_data = self.client.get('user_devices') or {}
            
            for user_id, devices_list in devices_data.items():
                self.user_devices_cache[user_id] = [
                    UserDevice.from_dict(device_data) for device_data in devices_list
                ]
            
            self.logger.info('push_notifications', f'Loaded settings for {len(self.user_settings_cache)} users')
            
        except Exception as e:
            self.logger.error('push_notifications', f'Error loading user settings: {str(e)}')
    
    async def register_device(self, user_id: str, device_type: str, token: str, 
                           platform: str, metadata: Dict[str, Any] = None) -> str:
        """
        Register a user device for push notifications
        
        Args:
            user_id: User identifier
            device_type: Device type ('web', 'mobile', 'desktop')
            token: Push notification token
            platform: Platform ('chrome', 'firefox', 'ios', 'android')
            metadata: Additional device metadata
            
        Returns:
            Device ID
        """
        device_id = str(uuid.uuid4())
        
        device = UserDevice(
            device_id=device_id,
            user_id=user_id,
            device_type=device_type,
            token=token,
            platform=platform,
            metadata=metadata or {}
        )
        
        # Save to Firebase
        try:
            # Update user devices list
            user_devices_path = f'user_devices/{user_id}'
            existing_devices = self.client.get(user_devices_path) or []
            
            # Check if device already exists (by token)
            for i, existing_device in enumerate(existing_devices):
                if existing_device.get('token') == token:
                    # Update existing device
                    existing_devices[i] = device.to_dict()
                    break
            else:
                # Add new device
                existing_devices.append(device.to_dict())
            
            self.client.set(user_devices_path, existing_devices)
            
            # Update cache
            if user_id not in self.user_devices_cache:
                self.user_devices_cache[user_id] = []
            
            # Replace existing device with same token or add new
            for i, cached_device in enumerate(self.user_devices_cache[user_id]):
                if cached_device.token == token:
                    self.user_devices_cache[user_id][i] = device
                    break
            else:
                self.user_devices_cache[user_id].append(device)
            
            # Ensure user has notification settings
            await self._ensure_user_settings(user_id)
            
            self.logger.info('push_notifications', f'Registered device {device_id} for user {user_id}')
            return device_id
            
        except Exception as e:
            self.logger.error('push_notifications', f'Error registering device: {str(e)}')
            raise
    
    async def _ensure_user_settings(self, user_id: str):
        """Ensure user has notification settings"""
        if user_id not in self.user_settings_cache:
            settings = UserNotificationSettings(user_id=user_id)
            
            # Save to Firebase
            settings_path = f'user_notification_settings/{user_id}'
            self.client.set(settings_path, settings.to_dict())
            
            # Update cache
            self.user_settings_cache[user_id] = settings
            
            self.logger.info('push_notifications', f'Created default settings for user {user_id}')
    
    async def update_user_preferences(self, user_id: str, preferences: Dict[str, Any]) -> bool:
        """
        Update user notification preferences
        
        Args:
            user_id: User identifier
            preferences: Preference updates
            
        Returns:
            True if successful
        """
        try:
            # Get existing settings or create new
            if user_id in self.user_settings_cache:
                settings = self.user_settings_cache[user_id]
            else:
                await self._ensure_user_settings(user_id)
                settings = self.user_settings_cache[user_id]
            
            # Update settings
            if 'global_preference' in preferences:
                settings.global_preference = UserNotificationPreference(preferences['global_preference'])
            
            if 'enabled' in preferences:
                settings.enabled = preferences['enabled']
            
            if 'quiet_hours' in preferences:
                settings.quiet_hours.update(preferences['quiet_hours'])
            
            if 'notification_types' in preferences:
                settings.notification_types.update(preferences['notification_types'])
            
            settings.updated_at = datetime.now()
            
            # Save to Firebase
            settings_path = f'user_notification_settings/{user_id}'
            self.client.set(settings_path, settings.to_dict())
            
            # Update cache
            self.user_settings_cache[user_id] = settings
            
            self.logger.info('push_notifications', f'Updated preferences for user {user_id}')
            return True
            
        except Exception as e:
            self.logger.error('push_notifications', f'Error updating user preferences: {str(e)}')
            return False
    
    async def send_push_notification(self, notification: NotificationMessage, 
                                  target_users: List[str] = None) -> Dict[str, Any]:
        """
        Send push notification to users
        
        Args:
            notification: Notification to send
            target_users: Specific users to target (optional)
            
        Returns:
            Delivery statistics
        """
        if not self.running:
            return {'success': False, 'error': 'Push notification manager not running'}
        
        try:
            # Determine target users
            if target_users:
                users_to_notify = target_users
            else:
                # Send to all users with matching preferences
                users_to_notify = await self._get_users_for_notification(notification)
            
            if not users_to_notify:
                self.logger.info('push_notifications', 'No users to notify for this notification')
                return {'success': True, 'users_notified': 0, 'devices_notified': 0}
            
            # Send to each user
            total_users = 0
            total_devices = 0
            successful_deliveries = 0
            failed_deliveries = 0
            
            for user_id in users_to_notify:
                user_stats = await self._send_notification_to_user(user_id, notification)
                total_users += 1
                total_devices += user_stats['devices_targeted']
                successful_deliveries += user_stats['successful']
                failed_deliveries += user_stats['failed']
            
            # Update statistics
            self.stats['total_sent'] += successful_deliveries
            self.stats['total_failed'] += failed_deliveries
            self.stats['users_notified'] += total_users
            self.stats['devices_notified'] += total_devices
            self.stats['last_sent'] = datetime.now().isoformat()
            
            result = {
                'success': True,
                'users_notified': total_users,
                'devices_notified': total_devices,
                'successful_deliveries': successful_deliveries,
                'failed_deliveries': failed_deliveries
            }
            
            self.logger.info('push_notifications', f'Push notification sent: {result}')
            return result
            
        except Exception as e:
            self.logger.error('push_notifications', f'Error sending push notification: {str(e)}')
            return {'success': False, 'error': str(e)}
    
    async def _get_users_for_notification(self, notification: NotificationMessage) -> List[str]:
        """Get list of users who should receive this notification"""
        eligible_users = []
        
        for user_id, settings in self.user_settings_cache.items():
            if settings.should_receive_notification(notification):
                # Check if user has active devices
                devices = self.user_devices_cache.get(user_id, [])
                active_devices = [d for d in devices if d.enabled]
                
                if active_devices:
                    eligible_users.append(user_id)
        
        return eligible_users
    
    async def _send_notification_to_user(self, user_id: str, 
                                        notification: NotificationMessage) -> Dict[str, Any]:
        """Send notification to a specific user"""
        devices = self.user_devices_cache.get(user_id, [])
        active_devices = [d for d in devices if d.enabled]
        
        if not active_devices:
            return {'devices_targeted': 0, 'successful': 0, 'failed': 0}
        
        successful = 0
        failed = 0
        
        for device in active_devices:
            try:
                # Send to device based on platform
                if device.device_type == 'web':
                    success = await self._send_web_push_notification(device, notification)
                elif device.device_type == 'mobile':
                    success = await self._send_fcm_notification(device, notification)
                elif device.device_type == 'desktop':
                    success = await self._send_desktop_notification(device, notification)
                else:
                    success = False
                
                if success:
                    successful += 1
                else:
                    failed += 1
                    
            except Exception as e:
                self.logger.error('push_notifications', f'Error sending to device {device.device_id}: {str(e)}')
                failed += 1
        
        return {
            'devices_targeted': len(active_devices),
            'successful': successful,
            'failed': failed
        }
    
    async def _send_web_push_notification(self, device: UserDevice, 
                                       notification: NotificationMessage) -> bool:
        """Send Web Push notification"""
        try:
            # TODO: Implement Web Push API integration
            # This would use the Web Push Protocol to send to web browsers
            self.logger.info('push_notifications', f'Sending Web Push to device {device.device_id}')
            return True
        except Exception as e:
            self.logger.error('push_notifications', f'Web Push error: {str(e)}')
            return False
    
    async def _send_fcm_notification(self, device: UserDevice, 
                                  notification: NotificationMessage) -> bool:
        """Send Firebase Cloud Messaging notification"""
        try:
            # TODO: Implement FCM integration
            # This would use Firebase Admin SDK to send to mobile devices
            self.logger.info('push_notifications', f'Sending FCM to device {device.device_id}')
            return True
        except Exception as e:
            self.logger.error('push_notifications', f'FCM error: {str(e)}')
            return False
    
    async def _send_desktop_notification(self, device: UserDevice, 
                                      notification: NotificationMessage) -> bool:
        """Send desktop notification"""
        try:
            # TODO: Implement desktop notification (Electron, etc.)
            # This would use native desktop notification APIs
            self.logger.info('push_notifications', f'Sending desktop notification to device {device.device_id}')
            return True
        except Exception as e:
            self.logger.error('push_notifications', f'Desktop notification error: {str(e)}')
            return False
    
    async def unregister_device(self, user_id: str, device_id: str) -> bool:
        """Unregister a user device"""
        try:
            # Remove from Firebase
            devices_path = f'user_devices/{user_id}'
            existing_devices = self.client.get(devices_path) or []
            
            updated_devices = [d for d in existing_devices if d.get('device_id') != device_id]
            self.client.set(devices_path, updated_devices)
            
            # Update cache
            if user_id in self.user_devices_cache:
                self.user_devices_cache[user_id] = [
                    d for d in self.user_devices_cache[user_id] if d.device_id != device_id
                ]
            
            self.logger.info('push_notifications', f'Unregistered device {device_id} for user {user_id}')
            return True
            
        except Exception as e:
            self.logger.error('push_notifications', f'Error unregistering device: {str(e)}')
            return False
    
    def get_user_settings(self, user_id: str) -> Optional[UserNotificationSettings]:
        """Get user notification settings"""
        return self.user_settings_cache.get(user_id)
    
    def get_user_devices(self, user_id: str) -> List[UserDevice]:
        """Get user's registered devices"""
        return self.user_devices_cache.get(user_id, [])
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get push notification statistics"""
        return {
            'running': self.running,
            'total_users': len(self.user_settings_cache),
            'total_devices': sum(len(devices) for devices in self.user_devices_cache.values()),
            'active_devices': sum(
                len([d for d in devices if d.enabled]) 
                for devices in self.user_devices_cache.values()
            ),
            'statistics': self.stats
        }
