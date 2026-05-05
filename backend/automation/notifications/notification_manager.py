"""
Notification Manager
Manages notification delivery, queuing, and retry logic
"""

import asyncio
import uuid
from typing import Dict, Any, List, Optional, Set
from datetime import datetime, timedelta
from dataclasses import dataclass, field
import json

from .notification_base import (
    NotificationMessage, NotificationConfig, NotificationProvider,
    NotificationStatus, NotificationPriority, NotificationType,
    NotificationEvent, NotificationRegistry, NotificationTemplate
)
from .providers.discord_provider import DiscordProvider
from ..base.firebase_client import FirebaseClient
from ..scheduler.websocket_logger import WebSocketLogger


@dataclass
class NotificationStats:
    """Notification statistics"""
    total_sent: int = 0
    total_failed: int = 0
    total_pending: int = 0
    provider_stats: Dict[str, Dict[str, int]] = field(default_factory=dict)
    last_sent: Optional[datetime] = None
    last_error: Optional[str] = None


class NotificationManager:
    """
    Central notification manager
    Handles notification delivery, queuing, and provider management
    """
    
    def __init__(self, firebase_client: FirebaseClient, logger: WebSocketLogger):
        self.client = firebase_client
        self.logger = logger
        self.running = False
        
        # Provider registry
        self.providers: Dict[str, NotificationProvider] = {}
        
        # Notification queue
        self.notification_queue: List[NotificationMessage] = []
        self.processing_queue: Set[str] = set()
        
        # Configuration
        self.config: Dict[str, Any] = {}
        self.provider_configs: Dict[str, NotificationConfig] = {}
        
        # Templates
        self.template_registry = NotificationRegistry()
        
        # Statistics
        self.stats = NotificationStats()
        
        # Rate limiting
        self.provider_last_sent: Dict[str, datetime] = {}
        
        # Initialize default templates
        self._initialize_default_mappings()
    
    def _initialize_default_mappings(self):
        """Initialize default event-to-template mappings"""
        mappings = {
            'match.created': ['match_created'],
            'match.started': ['match_started'],
            'match.completed': ['match_completed'],
            'match.score_updated': ['score_updated'],
            'automation.error': ['automation_error'],
            'automation.started': ['automation_started'],
            'automation.stopped': ['automation_stopped'],
            'scraper.error': ['scraper_error'],
            'scoring.completed': ['scoring_completed'],
            'system.alert': ['system_alert']
        }
        
        for event, template_ids in mappings.items():
            self.template_registry.map_event_to_templates(event, template_ids)
    
    async def start(self):
        """Start the notification manager"""
        if self.running:
            return
        
        self.running = True
        self.logger.info('notification_manager', 'Notification manager starting')
        
        # Load configuration
        await self._load_configuration()
        
        # Initialize providers
        await self._initialize_providers()
        
        # Start processing loop
        asyncio.create_task(self._processing_loop())
        
        self.logger.info('notification_manager', 'Notification manager started')
    
    async def stop(self):
        """Stop the notification manager"""
        self.running = False
        self.logger.info('notification_manager', 'Notification manager stopped')
    
    async def _load_configuration(self):
        """Load notification configuration from Firebase"""
        try:
            # Load main config
            config_data = self.client.get('notifications_config') or {}
            self.config = {
                'enabled': config_data.get('enabled', True),
                'max_queue_size': config_data.get('max_queue_size', 1000),
                'retry_delay': config_data.get('retry_delay', 300),  # 5 minutes
                'cleanup_interval': config_data.get('cleanup_interval', 3600),  # 1 hour
                'default_priority': config_data.get('default_priority', 'normal'),
                'global_rate_limit': config_data.get('global_rate_limit', 50)  # per minute
            }
            
            # Load provider configs
            providers_data = self.client.get('notifications_config/providers') or {}
            self.provider_configs = {}
            
            for provider_name, provider_data in providers_data.items():
                self.provider_configs[provider_name] = NotificationConfig.from_dict(provider_data)
            
            self.logger.info('notification_manager', f'Loaded configuration for {len(self.provider_configs)} providers')
            
        except Exception as e:
            self.logger.error('notification_manager', f'Error loading configuration: {str(e)}')
    
    async def _initialize_providers(self):
        """Initialize notification providers"""
        self.providers.clear()
        
        for provider_name, config in self.provider_configs.items():
            try:
                if provider_name == 'discord':
                    provider = DiscordProvider(config)
                else:
                    self.logger.warning('notification_manager', f'Unknown provider: {provider_name}')
                    continue
                
                # Validate configuration
                errors = provider.validate_config()
                if errors:
                    self.logger.error('notification_manager', f'Invalid config for {provider_name}: {errors}')
                    continue
                
                self.providers[provider_name] = provider
                self.logger.info('notification_manager', f'Initialized provider: {provider_name}')
                
            except Exception as e:
                self.logger.error('notification_manager', f'Error initializing provider {provider_name}: {str(e)}')
    
    async def _processing_loop(self):
        """Main notification processing loop"""
        while self.running:
            try:
                # Process queue
                await self._process_queue()
                
                # Cleanup old notifications
                await self._cleanup_old_notifications()
                
                # Sleep
                await asyncio.sleep(10)  # Process every 10 seconds
                
            except Exception as e:
                self.logger.error('notification_manager', f'Processing loop error: {str(e)}')
                await asyncio.sleep(30)
    
    async def _process_queue(self):
        """Process notification queue"""
        if not self.notification_queue:
            return
        
        # Get notifications ready to send
        now = datetime.now()
        ready_notifications = [
            n for n in self.notification_queue
            if n.status == NotificationStatus.PENDING and 
               (not n.delay_until or n.delay_until <= now) and
               n.id not in self.processing_queue
        ]
        
        # Sort by priority
        priority_order = {
            NotificationPriority.CRITICAL: 0,
            NotificationPriority.HIGH: 1,
            NotificationPriority.NORMAL: 2,
            NotificationPriority.LOW: 3
        }
        
        ready_notifications.sort(key=lambda n: priority_order.get(n.priority, 2))
        
        # Process notifications
        for notification in ready_notifications[:10]:  # Process max 10 at a time
            if not self.running:
                break
            
            self.processing_queue.add(notification.id)
            asyncio.create_task(self._send_notification(notification))
    
    async def _send_notification(self, notification: NotificationMessage):
        """Send notification to all suitable providers"""
        try:
            notification.status = NotificationStatus.SENDING
            
            # Find suitable providers
            suitable_providers = [
                (name, provider) for name, provider in self.providers.items()
                if provider.config.should_send_notification(notification)
            ]
            
            if not suitable_providers:
                self.logger.warning('notification_manager', f'No suitable providers for notification {notification.id}')
                notification.status = NotificationStatus.FAILED
                notification.retry_count += 1
                return
            
            # Try each provider
            success = False
            for provider_name, provider in suitable_providers:
                try:
                    if await provider.send_notification(notification):
                        success = True
                        self._update_stats(provider_name, 'sent')
                        self.logger.info('notification_manager', f'Sent notification {notification.id} via {provider_name}')
                    else:
                        self._update_stats(provider_name, 'failed')
                        self.logger.warning('notification_manager', f'Failed to send {notification.id} via {provider_name}')
                
                except Exception as e:
                    self._update_stats(provider_name, 'failed')
                    self.logger.error('notification_manager', f'Error sending {notification.id} via {provider_name}: {str(e)}')
            
            # Update notification status
            if success:
                notification.status = NotificationStatus.SENT
                notification.sent_at = datetime.now()
                self.stats.total_sent += 1
                self.stats.last_sent = notification.sent_at
            else:
                notification.status = NotificationStatus.FAILED
                notification.retry_count += 1
                self.stats.total_failed += 1
                self.stats.last_error = f"Failed to send via any provider"
            
            # Handle retries
            if notification.status == NotificationStatus.FAILED and notification.retry_count < notification.max_retries:
                notification.status = NotificationStatus.RETRYING
                notification.delay_until = datetime.now() + timedelta(seconds=self.config.get('retry_delay', 300))
                self.logger.info('notification_manager', f'Scheduling retry for notification {notification.id}')
        
        finally:
            self.processing_queue.discard(notification.id)
            
            # Remove from queue if completed
            if notification.status in [NotificationStatus.SENT, NotificationStatus.CANCELLED]:
                if notification in self.notification_queue:
                    self.notification_queue.remove(notification)
    
    def _update_stats(self, provider_name: str, result: str):
        """Update provider statistics"""
        if provider_name not in self.stats.provider_stats:
            self.stats.provider_stats[provider_name] = {'sent': 0, 'failed': 0}
        
        self.stats.provider_stats[provider_name][result] += 1
    
    async def _cleanup_old_notifications(self):
        """Clean up old completed notifications"""
        if not self.config.get('cleanup_interval'):
            return
        
        cutoff_time = datetime.now() - timedelta(hours=24)
        
        # Remove old sent/failed notifications
        original_length = len(self.notification_queue)
        self.notification_queue = [
            n for n in self.notification_queue
            if n.status not in [NotificationStatus.SENT, NotificationStatus.FAILED] or
               n.created_at > cutoff_time
        ]
        
        if len(self.notification_queue) != original_length:
            self.logger.info('notification_manager', f'Cleaned up {original_length - len(self.notification_queue)} old notifications')
    
    async def send_notification(self, 
                             title: str, 
                             content: str, 
                             notification_type: NotificationType = NotificationType.CUSTOM,
                             priority: NotificationPriority = None,
                             metadata: Dict[str, Any] = None,
                             target_providers: List[str] = None,
                             exclude_providers: List[str] = None) -> str:
        """
        Send a notification
        
        Args:
            title: Notification title
            content: Notification content
            notification_type: Type of notification
            priority: Notification priority
            metadata: Additional metadata
            target_providers: Specific providers to use
            exclude_providers: Providers to exclude
            
        Returns:
            Notification ID
        """
        if not self.config.get('enabled', True):
            return ""
        
        notification_id = str(uuid.uuid4())
        
        notification = NotificationMessage(
            id=notification_id,
            type=notification_type,
            title=title,
            content=content,
            priority=priority or NotificationPriority(self.config.get('default_priority', 'normal')),
            metadata=metadata or {},
            target_providers=target_providers or [],
            exclude_providers=exclude_providers or []
        )
        
        # Add to queue
        self.notification_queue.append(notification)
        self.stats.total_pending += 1
        
        self.logger.info('notification_manager', f'Queued notification {notification_id}: {title}')
        
        return notification_id
    
    async def send_event_notification(self, event: NotificationEvent) -> List[str]:
        """
        Send notification based on event
        
        Args:
            event: Event that triggered notifications
            
        Returns:
            List of notification IDs
        """
        notification_ids = []
        
        try:
            # Get templates for event
            templates = self.template_registry.get_templates_for_event(event.event_type)
            
            if not templates:
                self.logger.warning('notification_manager', f'No templates found for event: {event.event_type}')
                return notification_ids
            
            # Create notifications from templates
            for template in templates:
                try:
                    title, content = template.render(**event.data)
                    
                    notification_id = await self.send_notification(
                        title=title,
                        content=content,
                        notification_type=NotificationType(event.event_type.replace('.', '_')),
                        metadata=event.data
                    )
                    
                    if notification_id:
                        notification_ids.append(notification_id)
                
                except Exception as e:
                    self.logger.error('notification_manager', f'Error rendering template {template.template_id}: {str(e)}')
        
        except Exception as e:
            self.logger.error('notification_manager', f'Error processing event {event.event_type}: {str(e)}')
        
        return notification_ids
    
    async def trigger_event(self, 
                          event_type: str, 
                          data: Dict[str, Any], 
                          source: str = "automation") -> List[str]:
        """
        Trigger a notification event
        
        Args:
            event_type: Type of event
            data: Event data
            source: Event source
            
        Returns:
            List of notification IDs
        """
        event = NotificationEvent(
            event_type=event_type,
            data=data,
            source=source
        )
        
        return await self.send_event_notification(event)
    
    async def test_provider(self, provider_name: str) -> Dict[str, Any]:
        """Test a notification provider"""
        if provider_name not in self.providers:
            return {
                'success': False,
                'error': f'Provider {provider_name} not found'
            }
        
        provider = self.providers[provider_name]
        
        if hasattr(provider, 'test_webhook'):
            return await provider.test_webhook()
        else:
            # Generic test
            test_notification = NotificationMessage(
                id='test-' + str(int(datetime.now().timestamp())),
                type=NotificationType.SYSTEM_ALERT,
                title='🧪 Test Notification',
                content='This is a test notification from the automation system.',
                metadata={'test': True, 'provider': provider_name}
            )
            
            try:
                success = await provider.send_notification(test_notification)
                return {
                    'success': success,
                    'message': 'Test notification sent successfully' if success else 'Failed to send test notification'
                }
            except Exception as e:
                return {
                    'success': False,
                    'error': str(e)
                }
    
    async def update_provider_config(self, provider_name: str, config_data: Dict[str, Any]) -> bool:
        """Update provider configuration"""
        try:
            # Update in memory
            if provider_name in self.provider_configs:
                # Update existing config
                for key, value in config_data.items():
                    if hasattr(self.provider_configs[provider_name], key):
                        setattr(self.provider_configs[provider_name], key, value)
                    elif key == 'settings':
                        self.provider_configs[provider_name].settings.update(value)
            else:
                # Create new config
                self.provider_configs[provider_name] = NotificationConfig(
                    provider_name=provider_name,
                    **config_data
                )
            
            # Save to Firebase
            config_path = f'notifications_config/providers/{provider_name}'
            self.client.set(config_path, self.provider_configs[provider_name].to_dict())
            
            # Reinitialize providers
            await self._initialize_providers()
            
            self.logger.info('notification_manager', f'Updated configuration for provider: {provider_name}')
            return True
        
        except Exception as e:
            self.logger.error('notification_manager', f'Error updating provider config {provider_name}: {str(e)}')
            return False
    
    def get_status(self) -> Dict[str, Any]:
        """Get notification manager status"""
        return {
            'running': self.running,
            'enabled': self.config.get('enabled', True),
            'queue_size': len(self.notification_queue),
            'processing': len(self.processing_queue),
            'providers': {
                name: {
                    'enabled': provider.config.enabled,
                    'last_sent': self.provider_last_sent.get(name),
                    'stats': self.stats.provider_stats.get(name, {})
                }
                for name, provider in self.providers.items()
            },
            'statistics': {
                'total_sent': self.stats.total_sent,
                'total_failed': self.stats.total_failed,
                'total_pending': self.stats.total_pending,
                'last_sent': self.stats.last_sent.isoformat() if self.stats.last_sent else None,
                'last_error': self.stats.last_error
            },
            'config': self.config
        }
