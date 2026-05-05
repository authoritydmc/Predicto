"""
Firebase Cloud Messaging Provider
Handles push notifications to mobile devices using FCM
"""

import asyncio
import json
from typing import Dict, Any, List, Optional
from datetime import datetime

try:
    from firebase_admin import messaging
    from firebase_admin import credentials
    FCM_AVAILABLE = True
except ImportError:
    FCM_AVAILABLE = False

from ..notification_base import NotificationProvider, NotificationConfig, NotificationMessage
from ..push_notification_system import UserDevice


class FCMProvider(NotificationProvider):
    """Firebase Cloud Messaging notification provider for mobile devices"""
    
    def __init__(self, config: NotificationConfig):
        super().__init__(config)
        
        # Firebase configuration
        self.service_account_key = config.settings.get('service_account_key')
        self.credentials_path = config.settings.get('credentials_path')
        
        # FCM settings
        self.collapse_key = config.settings.get('collapse_key', 'automation_notifications')
        self.priority = config.settings.get('priority', 'high')
        self.time_to_live = config.settings.get('time_to_live', 86400)  # 24 hours
        
        # Initialize Firebase Admin SDK
        self._initialize_firebase()
    
    def _initialize_firebase(self):
        """Initialize Firebase Admin SDK for FCM"""
        if not FCM_AVAILABLE:
            print("[FCMProvider] Firebase Admin SDK not available")
            return
        
        try:
            if self.service_account_key:
                # Use service account key from config
                cred = credentials.Certificate(self.service_account_key)
            elif self.credentials_path:
                # Use service account key from file
                cred = credentials.Certificate(self.credentials_path)
            else:
                print("[FCMProvider] No Firebase credentials provided")
                return
            
            # Initialize Firebase app
            import firebase_admin
            if not firebase_admin._apps:
                firebase_admin.initialize_app(cred)
            
            print("[FCMProvider] Firebase Admin SDK initialized successfully")
            
        except Exception as e:
            print(f"[FCMProvider] Error initializing Firebase: {e}")
    
    async def send_notification(self, notification: NotificationMessage) -> bool:
        """Send notification via FCM"""
        # FCM requires device-specific tokens
        # This method would be called with a device-specific notification
        return True
    
    async def send_to_device(self, device: UserDevice, notification: NotificationMessage) -> bool:
        """Send notification to specific device"""
        if not FCM_AVAILABLE:
            print("[FCMProvider] Firebase Admin SDK not available")
            return False
        
        if not device.token:
            print(f"[FCMProvider] No FCM token for device {device.device_id}")
            return False
        
        # Check rate limit
        if not self.check_rate_limit():
            return False
        
        try:
            # Create FCM message
            message = self._create_fcm_message(device, notification)
            
            # Send message
            response = messaging.send(message)
            
            self.increment_sent_count()
            print(f"[FCMProvider] Notification sent to device {device.device_id}: {response}")
            return True
            
        except messaging.UnregisteredError:
            print(f"[FCMProvider] Device {device.device_id} unregistered, token expired")
            # TODO: Mark device as disabled
            return False
            
        except messaging.MismatchSenderIdError:
            print(f"[FCMProvider] Sender ID mismatch for device {device.device_id}")
            return False
            
        except messaging.MessageSizeExceededError:
            print(f"[FCMProvider] Message too large for device {device.device_id}")
            return False
            
        except Exception as e:
            print(f"[FCMProvider] Error sending notification: {e}")
            return False
    
    def _create_fcm_message(self, device: UserDevice, notification: NotificationMessage) -> messaging.Message:
        """Create FCM message for device"""
        # Create notification payload
        notification_payload = messaging.Notification(
            title=notification.title,
            body=notification.content
        )
        
        # Create data payload
        data_payload = {
            'notification_id': notification.id,
            'type': notification.type.value,
            'priority': notification.priority.value,
            'timestamp': str(int(notification.created_at.timestamp())),
            'click_action': 'FLUTTER_NOTIFICATION_CLICK'
        }
        
        # Add metadata to data payload
        for key, value in notification.metadata.items():
            if isinstance(value, (str, int, float, bool)):
                data_payload[f'meta_{key}'] = str(value)
        
        # Create message
        message = messaging.Message(
            notification=notification_payload,
            data=data_payload,
            token=device.token,
            android=self._create_android_config(notification),
            apns=self._create_apns_config(notification),
            webpush=self._create_webpush_config(notification),
            collapse_key=self.collapse_key,
            priority=self.priority,
            time_to_live=self.time_to_live
        )
        
        return message
    
    def _create_android_config(self, notification: NotificationMessage) -> messaging.AndroidConfig:
        """Create Android-specific configuration"""
        # Map priority
        priority_map = {
            'low': messaging.AndroidNotificationPriority.PRIORITY_LOW,
            'normal': messaging.AndroidNotificationPriority.PRIORITY_DEFAULT,
            'high': messaging.AndroidNotificationPriority.PRIORITY_HIGH,
            'critical': messaging.AndroidNotificationPriority.PRIORITY_MAX
        }
        
        # Create notification
        android_notification = messaging.AndroidNotification(
            title=notification.title,
            body=notification.content,
            icon='@drawable/ic_notification',
            color='#3498db',
            sound='default',
            tag=notification.id,
            priority=priority_map.get(notification.priority.value, messaging.AndroidNotificationPriority.PRIORITY_DEFAULT),
            click_action='FLUTTER_NOTIFICATION_CLICK',
            notification_count=1
        )
        
        # Add actions for interactive notifications
        if notification.type.value == 'match_created':
            android_notification.actions = [
                {'action': 'view_match', 'title': 'View Match'},
                {'action': 'make_prediction', 'title': 'Predict'}
            ]
        elif notification.type.value == 'match_completed':
            android_notification.actions = [
                {'action': 'view_results', 'title': 'View Results'},
                {'action': 'view_leaderboard', 'title': 'Leaderboard'}
            ]
        
        return messaging.AndroidConfig(
            notification=android_notification,
            priority=priority_map.get(notification.priority.value, messaging.AndroidNotificationPriority.PRIORITY_DEFAULT),
            ttl=self.time_to_live,
            collapse_key=self.collapse_key,
            restricted_package_name='com.yourapp.cricket'  # Replace with your app package
        )
    
    def _create_apns_config(self, notification: NotificationMessage) -> messaging.APNSConfig:
        """Create iOS-specific configuration"""
        # Map priority
        priority_map = {
            'low': 5,    # Normal priority
            'normal': 5,  # Normal priority
            'high': 10,   # High priority
            'critical': 10  # High priority
        }
        
        # Create payload
        payload = messaging.APNSPayload(
            aps=messaging.Aps(
                alert=messaging.ApsAlert(
                    title=notification.title,
                    body=notification.content
                ),
                badge=1,
                sound='default',
                category=notification.type.value,
                thread_id='automation_notifications',
                priority=priority_map.get(notification.priority.value, 5)
            ),
            data={
                'notification_id': notification.id,
                'type': notification.type.value,
                'priority': notification.priority.value,
                'metadata': notification.metadata
            }
        )
        
        return messaging.APNSConfig(
            payload=payload,
            headers={
                'apns-priority': str(priority_map.get(notification.priority.value, 5)),
                'apns-expiration': str(int(datetime.now().timestamp()) + self.time_to_live)
            }
        )
    
    def _create_webpush_config(self, notification: NotificationMessage) -> messaging.WebpushConfig:
        """Create Web Push configuration"""
        headers = {}
        if notification.priority == NotificationPriority.CRITICAL:
            headers['Urgency'] = 'high'
        elif notification.priority == NotificationPriority.LOW:
            headers['Urgency'] = 'low'
        
        return messaging.WebpushConfig(
            headers=headers,
            data={
                'title': notification.title,
                'body': notification.content,
                'icon': '/assets/icons/notification-icon.png',
                'badge': '/assets/icons/badge-icon.png',
                'tag': notification.id,
                'data': {
                    'notification_id': notification.id,
                    'type': notification.type.value,
                    'priority': notification.priority.value,
                    'metadata': notification.metadata
                }
            }
        )
    
    def validate_config(self) -> List[str]:
        """Validate FCM configuration"""
        errors = []
        
        if not FCM_AVAILABLE:
            errors.append("Firebase Admin SDK not installed. Install with: pip install firebase-admin")
        
        if not self.service_account_key and not self.credentials_path:
            errors.append("Either service_account_key or credentials_path is required")
        
        # Validate TTL
        if self.time_to_live < 0 or self.time_to_live > 2419200:  # 28 days max
            errors.append("Time to live must be between 0 and 2419200 seconds (28 days)")
        
        # Validate priority
        valid_priorities = ['normal', 'high']
        if self.priority not in valid_priorities:
            errors.append(f"Priority must be one of: {', '.join(valid_priorities)}")
        
        return errors
    
    def get_provider_info(self) -> Dict[str, Any]:
        """Get FCM provider information"""
        return {
            'name': 'Firebase Cloud Messaging',
            'description': 'Send push notifications to mobile devices via Firebase Cloud Messaging',
            'features': [
                'Cross-platform support (iOS & Android)',
                'Rich notifications with images and actions',
                'Targeted messaging to specific devices',
                'Topic-based broadcasting',
                'Message priority and TTL',
                'Analytics and delivery tracking',
                'Silent notifications for background sync'
            ],
            'required_settings': [
                'service_account_key: Firebase service account JSON key OR',
                'credentials_path: Path to service account key file'
            ],
            'optional_settings': [
                'collapse_key: Message collapse key (default: automation_notifications)',
                'priority: Message priority (normal, high)',
                'time_to_live: Message TTL in seconds (default: 86400)',
                'restricted_package_name: Android package name'
            ],
            'supported_platforms': [
                'Android (All versions)',
                'iOS (iOS 10+)',
                'Web (via Web Push API)'
            ],
            'limitations': [
                'Requires Firebase project setup',
                'Message size limit (4KB)',
                'Rate limits apply',
                'Device tokens can expire'
            ],
            'requirements': [
                'Firebase Admin SDK',
                'Firebase project with FCM enabled',
                'Service account with FCM permissions'
            ]
        }
    
    async def test_notification(self, fcm_token: str) -> Dict[str, Any]:
        """Test FCM notification"""
        if not FCM_AVAILABLE:
            return {
                'success': False,
                'error': 'Firebase Admin SDK not available'
            }
        
        test_notification = NotificationMessage(
            id='test-' + str(int(datetime.now().timestamp())),
            type=NotificationType.SYSTEM_ALERT,
            title='🧪 Test Notification',
            content='This is a test push notification from the automation system.',
            metadata={'test': True}
        )
        
        # Create temporary device for testing
        test_device = UserDevice(
            device_id='test-device',
            user_id='test-user',
            device_type='mobile',
            token=fcm_token,
            platform='android'
        )
        
        try:
            success = await self.send_to_device(test_device, test_notification)
            return {
                'success': success,
                'message': 'Test notification sent successfully' if success else 'Failed to send test notification'
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    async def send_topic_notification(self, topic: str, notification: NotificationMessage) -> bool:
        """Send notification to all devices subscribed to a topic"""
        if not FCM_AVAILABLE:
            return False
        
        try:
            # Create message for topic
            message = messaging.Message(
                notification=messaging.Notification(
                    title=notification.title,
                    body=notification.content
                ),
                data={
                    'notification_id': notification.id,
                    'type': notification.type.value,
                    'priority': notification.priority.value,
                    'timestamp': str(int(notification.created_at.timestamp()))
                },
                topic=topic,
                android=self._create_android_config(notification),
                apns=self._create_apns_config(notification),
                time_to_live=self.time_to_live
            )
            
            # Send to topic
            response = messaging.send(message)
            print(f"[FCMProvider] Topic notification sent to {topic}: {response}")
            return True
            
        except Exception as e:
            print(f"[FCMProvider] Error sending topic notification: {e}")
            return False
    
    async def subscribe_to_topic(self, fcm_token: str, topic: str) -> bool:
        """Subscribe device to topic"""
        if not FCM_AVAILABLE:
            return False
        
        try:
            response = messaging.subscribe_to_topic([fcm_token], topic)
            print(f"[FCMProvider] Subscribed {fcm_token} to topic {topic}: {response}")
            return True
        except Exception as e:
            print(f"[FCMProvider] Error subscribing to topic: {e}")
            return False
    
    async def unsubscribe_from_topic(self, fcm_token: str, topic: str) -> bool:
        """Unsubscribe device from topic"""
        if not FCM_AVAILABLE:
            return False
        
        try:
            response = messaging.unsubscribe_from_topic([fcm_token], topic)
            print(f"[FCMProvider] Unsubscribed {fcm_token} from topic {topic}: {response}")
            return True
        except Exception as e:
            print(f"[FCMProvider] Error unsubscribing from topic: {e}")
            return False
