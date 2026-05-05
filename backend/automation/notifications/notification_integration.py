"""
Notification Integration with Automation System
Integrates Discord notifications with automation events
"""

import asyncio
from typing import Dict, Any, List
from datetime import datetime

from .notification_manager import NotificationManager, NotificationEvent
from ..base.firebase_client import FirebaseClient
from ..scheduler.websocket_logger import WebSocketLogger


class NotificationIntegration:
    """
    Integrates notifications with the automation system
    Handles event listening and notification triggering
    """
    
    def __init__(self, firebase_client: FirebaseClient, logger: WebSocketLogger):
        self.client = firebase_client
        self.logger = logger
        self.notification_manager: NotificationManager = None
        
    async def start(self):
        """Start notification integration"""
        try:
            # Initialize notification manager
            self.notification_manager = NotificationManager(self.client, self.logger)
            await self.notification_manager.start()
            
            self.logger.info('notification_integration', 'Notification integration started')
            
            # Set up event listeners
            self._setup_event_listeners()
            
        except Exception as e:
            self.logger.error('notification_integration', f'Failed to start notification integration: {str(e)}')
    
    async def stop(self):
        """Stop notification integration"""
        if self.notification_manager:
            await self.notification_manager.stop()
        
        self.logger.info('notification_integration', 'Notification integration stopped')
    
    def _setup_event_listeners(self):
        """Set up event listeners for automation events"""
        # This will be called by automation components to trigger notifications
        pass
    
    async def on_match_created(self, match_data: Dict[str, Any]):
        """Handle match created event"""
        await self.notification_manager.trigger_event('match.created', match_data)
    
    async def on_match_started(self, match_data: Dict[str, Any]):
        """Handle match started event"""
        await self.notification_manager.trigger_event('match.started', match_data)
    
    async def on_match_completed(self, match_data: Dict[str, Any]):
        """Handle match completed event"""
        await self.notification_manager.trigger_event('match.completed', match_data)
    
    async def on_score_updated(self, score_data: Dict[str, Any]):
        """Handle score updated event"""
        await self.notification_manager.trigger_event('match.score_updated', score_data)
    
    async def on_automation_error(self, error_data: Dict[str, Any]):
        """Handle automation error event"""
        await self.notification_manager.trigger_event('automation.error', error_data)
    
    async def on_automation_started(self, system_data: Dict[str, Any]):
        """Handle automation started event"""
        await self.notification_manager.trigger_event('automation.started', system_data)
    
    async def on_automation_stopped(self, system_data: Dict[str, Any]):
        """Handle automation stopped event"""
        await self.notification_manager.trigger_event('automation.stopped', system_data)
    
    async def on_scraper_error(self, scraper_data: Dict[str, Any]):
        """Handle scraper error event"""
        await self.notification_manager.trigger_event('scraper.error', scraper_data)
    
    async def on_scoring_completed(self, scoring_data: Dict[str, Any]):
        """Handle scoring completed event"""
        await self.notification_manager.trigger_event('scoring.completed', scoring_data)
    
    async def on_system_alert(self, alert_data: Dict[str, Any]):
        """Handle system alert event"""
        await self.notification_manager.trigger_event('system.alert', alert_data)
    
    async def send_custom_notification(self, 
                                     title: str, 
                                     content: str, 
                                     metadata: Dict[str, Any] = None) -> str:
        """Send custom notification"""
        return await self.notification_manager.send_notification(
            title=title,
            content=content,
            metadata=metadata or {}
        )
    
    async def test_discord_notification(self) -> Dict[str, Any]:
        """Test Discord notification"""
        return await self.notification_manager.test_provider('discord')
    
    async def update_discord_config(self, config: Dict[str, Any]) -> bool:
        """Update Discord configuration"""
        return await self.notification_manager.update_provider_config('discord', config)
    
    def get_notification_status(self) -> Dict[str, Any]:
        """Get notification system status"""
        if not self.notification_manager:
            return {'status': 'not_initialized'}
        
        return self.notification_manager.get_status()


# Global notification integration instance
_notification_integration: NotificationIntegration = None


async def initialize_notifications(firebase_client: FirebaseClient, logger: WebSocketLogger) -> NotificationIntegration:
    """Initialize global notification integration"""
    global _notification_integration
    _notification_integration = NotificationIntegration(firebase_client, logger)
    await _notification_integration.start()
    return _notification_integration


def get_notification_integration() -> NotificationIntegration:
    """Get global notification integration instance"""
    return _notification_integration


# Decorator for automatic notification triggering
def notify_on_event(event_type: str):
    """Decorator to automatically send notifications on function events"""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            try:
                result = await func(*args, **kwargs)
                
                # Trigger notification if integration is available
                integration = get_notification_integration()
                if integration and result:
                    # Extract relevant data from result
                    if isinstance(result, dict):
                        await integration.notification_manager.trigger_event(event_type, result)
                
                return result
            except Exception as e:
                # Send error notification
                integration = get_notification_integration()
                if integration:
                    await integration.on_automation_error({
                        'function': func.__name__,
                        'error': str(e),
                        'timestamp': datetime.now().isoformat()
                    })
                raise
        
        return wrapper
    return decorator
