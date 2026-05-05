"""
Web Push API Provider
Handles push notifications to web browsers using Web Push Protocol
"""

import asyncio
import json
import base64
from typing import Dict, Any, List, Optional
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.backends import default_backend
from pywebpush import webpush, WebPushException

from ..notification_base import NotificationProvider, NotificationConfig, NotificationMessage
from ..push_notification_system import UserDevice


class WebPushProvider(NotificationProvider):
    """Web Push API notification provider for browsers"""
    
    def __init__(self, config: NotificationConfig):
        super().__init__(config)
        
        # VAPID keys for authentication
        self.vapid_private_key = config.settings.get('vapid_private_key')
        self.vapid_public_key = config.settings.get('vapid_public_key')
        self.vapid_email = config.settings.get('vapid_email')
        
        # Web Push settings
        self.ttl = config.settings.get('ttl', 86400)  # 24 hours
        self.urgency = config.settings.get('urgency', 'normal')
        
        # Initialize VAPID keys if not provided
        if not self.vapid_private_key or not self.vapid_public_key:
            self._generate_vapid_keys()
    
    def _generate_vapid_keys(self):
        """Generate VAPID keys for Web Push authentication"""
        try:
            # Generate ECDSA key pair
            private_key = ec.generate_private_key(ec.SECP256R1(), default_backend())
            
            # Get public key
            public_key = private_key.public_key()
            
            # Serialize keys
            private_bytes = private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption()
            )
            
            public_bytes = public_key.public_bytes(
                encoding=serialization.Encoding.X962,
                format=serialization.PublicFormat.UncompressedPoint
            )
            
            # Convert to base64url format
            self.vapid_private_key = base64.urlsafe_b64encode(
                private_bytes
            ).rstrip(b'=').decode('utf-8')
            
            self.vapid_public_key = base64.urlsafe_b64encode(
                public_bytes
            ).rstrip(b'=').decode('utf-8')
            
            # Save to config
            self.config.settings['vapid_private_key'] = self.vapid_private_key
            self.config.settings['vapid_public_key'] = self.vapid_public_key
            
            print(f"[WebPushProvider] Generated new VAPID keys")
            print(f"[WebPushProvider] Public key: {self.vapid_public_key}")
            
        except Exception as e:
            print(f"[WebPushProvider] Error generating VAPID keys: {e}")
            raise
    
    async def send_notification(self, notification: NotificationMessage) -> bool:
        """Send notification via Web Push API"""
        # Web Push requires device-specific subscription info
        # This method would be called with a device-specific notification
        return True
    
    async def send_to_device(self, device: UserDevice, notification: NotificationMessage) -> bool:
        """Send notification to specific device"""
        if not device.metadata.get('subscription'):
            print(f"[WebPushProvider] No subscription info for device {device.device_id}")
            return False
        
        # Check rate limit
        if not self.check_rate_limit():
            return False
        
        try:
            subscription_info = device.metadata['subscription']
            
            # Prepare push message
            push_data = {
                'title': notification.title,
                'body': notification.content,
                'icon': '/assets/icons/notification-icon.png',
                'badge': '/assets/icons/badge-icon.png',
                'tag': notification.id,  # Group similar notifications
                'data': {
                    'notification_id': notification.id,
                    'type': notification.type.value,
                    'priority': notification.priority.value,
                    'metadata': notification.metadata,
                    'url': '/notifications'  # Click action
                },
                'actions': self._get_notification_actions(notification),
                'vibrate': [200, 100, 200],  # Vibration pattern
                'requireInteraction': notification.priority == NotificationPriority.CRITICAL,
                'silent': notification.priority == NotificationPriority.LOW
            }
            
            # Add timestamp for Android
            if device.platform in ['android', 'chrome']:
                push_data['timestamp'] = int(notification.created_at.timestamp() * 1000)
            
            # Send push notification
            response = webpush(
                subscription_info=subscription_info,
                data=json.dumps(push_data),
                vapid_private_key=self.vapid_private_key,
                vapid_claims={
                    'sub': f'mailto:{self.vapid_email}' if self.vapid_email else None
                },
                ttl=self.ttl,
                urgency=self.urgency
            )
            
            self.increment_sent_count()
            print(f"[WebPushProvider] Notification sent to device {device.device_id}")
            return True
            
        except WebPushException as e:
            if e.response and e.response.status_code == 410:
                # Subscription expired, remove device
                print(f"[WebPushProvider] Subscription expired for device {device.device_id}")
                # TODO: Mark device as disabled
                return False
            else:
                print(f"[WebPushProvider] WebPush error: {e}")
                return False
                
        except Exception as e:
            print(f"[WebPushProvider] Error sending notification: {e}")
            return False
    
    def _get_notification_actions(self, notification: NotificationMessage) -> List[Dict[str, str]]:
        """Get notification actions based on type"""
        actions = []
        
        if notification.type.value == 'match_created':
            actions = [
                {'action': 'view', 'title': 'View Match'},
                {'action': 'predict', 'title': 'Make Prediction'}
            ]
        elif notification.type.value == 'match_completed':
            actions = [
                {'action': 'results', 'title': 'View Results'},
                {'action': 'leaderboard', 'title': 'Leaderboard'}
            ]
        elif notification.type.value == 'automation_error':
            actions = [
                {'action': 'dashboard', 'title': 'Dashboard'},
                {'action': 'dismiss', 'title': 'Dismiss'}
            ]
        elif notification.type.value == 'system_alert':
            actions = [
                {'action': 'view', 'title': 'View Details'},
                {'action': 'dismiss', 'title': 'Dismiss'}
            ]
        
        return actions
    
    def validate_config(self) -> List[str]:
        """Validate Web Push configuration"""
        errors = []
        
        if not self.vapid_private_key:
            errors.append("VAPID private key is required")
        
        if not self.vapid_public_key:
            errors.append("VAPID public key is required")
        
        if not self.vapid_email:
            errors.append("VAPID email is required for authentication")
        
        # Validate TTL
        if self.ttl < 0 or self.ttl > 2419200:  # 28 days max
            errors.append("TTL must be between 0 and 2419200 seconds (28 days)")
        
        # Validate urgency
        valid_urgencies = ['very-low', 'low', 'normal', 'high']
        if self.urgency not in valid_urgencies:
            errors.append(f"Urgency must be one of: {', '.join(valid_urgencies)}")
        
        return errors
    
    def get_provider_info(self) -> Dict[str, Any]:
        """Get Web Push provider information"""
        return {
            'name': 'Web Push API',
            'description': 'Send push notifications to web browsers using Web Push Protocol',
            'features': [
                'Cross-browser support (Chrome, Firefox, Safari)',
                'Rich notifications with actions',
                'VAPID authentication for security',
                'Background sync support',
                'Custom vibration patterns',
                'Interactive notifications'
            ],
            'required_settings': [
                'vapid_private_key: VAPID private key for authentication',
                'vapid_public_key: VAPID public key for client subscription',
                'vapid_email: Email for VAPID claims'
            ],
            'optional_settings': [
                'ttl: Time-to-live in seconds (default: 86400)',
                'urgency: Message urgency (very-low, low, normal, high)',
                'icon: Default notification icon URL',
                'badge: Default badge icon URL'
            ],
            'supported_platforms': [
                'Chrome (Desktop & Mobile)',
                'Firefox (Desktop & Mobile)',
                'Safari (Desktop & Mobile)',
                'Edge (Desktop & Mobile)'
            ],
            'limitations': [
                'Requires HTTPS in production',
                'User must grant permission',
                'Subscription can expire',
                'Payload size limit (4KB)'
            ]
        }
    
    def get_vapid_public_key(self) -> str:
        """Get VAPID public key for client subscription"""
        return self.vapid_public_key
    
    async def test_notification(self, subscription_info: Dict[str, Any]) -> Dict[str, Any]:
        """Test Web Push notification"""
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
            device_type='web',
            token='test-token',
            platform='chrome',
            metadata={'subscription': subscription_info}
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
    
    def get_client_subscription_data(self) -> Dict[str, Any]:
        """Get data needed for client-side subscription"""
        return {
            'publicKey': self.vapid_public_key,
            'applicationServerKey': self.vapid_public_key
        }
