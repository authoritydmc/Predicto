"""
Discord notification provider
Sends notifications to Discord channels via webhooks
"""

import asyncio
import aiohttp
import json
from typing import Dict, Any, List
from datetime import datetime

from ..notification_base import NotificationProvider, NotificationMessage, NotificationConfig


class DiscordProvider(NotificationProvider):
    """Discord webhook notification provider"""
    
    def __init__(self, config: NotificationConfig):
        super().__init__(config)
        self.webhook_url = config.settings.get('webhook_url')
        self.username = config.settings.get('username', 'Automation Bot')
        self.avatar_url = config.settings.get('avatar_url')
        self.enable_embeds = config.settings.get('enable_embeds', True)
        self.default_color = config.settings.get('default_color', 0x3498db)
    
    async def send_notification(self, notification: NotificationMessage) -> bool:
        """Send notification to Discord webhook"""
        if not self.webhook_url:
            return False
        
        # Check rate limit
        if not self.check_rate_limit():
            return False
        
        try:
            # Prepare Discord payload
            payload = self._prepare_payload(notification)
            
            # Send to Discord
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=self.config.timeout)) as session:
                async with session.post(
                    self.webhook_url,
                    json=payload,
                    headers={'Content-Type': 'application/json'}
                ) as response:
                    if response.status == 204:  # Discord success response
                        self.increment_sent_count()
                        return True
                    else:
                        error_text = await response.text()
                        print(f"[DiscordProvider] Error sending notification: {response.status} - {error_text}")
                        return False
        
        except asyncio.TimeoutError:
            print(f"[DiscordProvider] Timeout sending notification: {notification.id}")
            return False
        except Exception as e:
            print(f"[DiscordProvider] Exception sending notification: {e}")
            return False
    
    def _prepare_payload(self, notification: NotificationMessage) -> Dict[str, Any]:
        """Prepare Discord webhook payload"""
        payload = {
            'username': self.username,
            'content': None,
            'embeds': []
        }
        
        if self.avatar_url:
            payload['avatar_url'] = self.avatar_url
        
        # Create embed if enabled
        if self.enable_embeds:
            embed = self._create_embed(notification)
            payload['embeds'] = [embed]
        else:
            # Simple text message
            payload['content'] = f"**{notification.title}**\n{notification.content}"
        
        return payload
    
    def _create_embed(self, notification: NotificationMessage) -> Dict[str, Any]:
        """Create Discord embed for notification"""
        # Determine embed color based on priority
        color_map = {
            'low': 0x95a5a6,      # Gray
            'normal': 0x3498db,    # Blue
            'high': 0xf39c12,      # Orange
            'critical': 0xe74c3c    # Red
        }
        color = color_map.get(notification.priority.value, self.default_color)
        
        embed = {
            'title': notification.title,
            'description': notification.content,
            'color': color,
            'timestamp': notification.created_at.isoformat(),
            'footer': {
                'text': f'Automation System • {notification.type.value}'
            }
        }
        
        # Add metadata fields if available
        if notification.metadata:
            fields = []
            
            # Common metadata fields
            if 'match_id' in notification.metadata:
                fields.append({
                    'name': 'Match ID',
                    'value': notification.metadata['match_id'],
                    'inline': True
                })
            
            if 'tournament_id' in notification.metadata:
                fields.append({
                    'name': 'Tournament',
                    'value': notification.metadata['tournament_id'],
                    'inline': True
                })
            
            if 'sport' in notification.metadata:
                fields.append({
                    'name': 'Sport',
                    'value': notification.metadata['sport'].title(),
                    'inline': True
                })
            
            if 'component' in notification.metadata:
                fields.append({
                    'name': 'Component',
                    'value': notification.metadata['component'],
                    'inline': True
                })
            
            if 'error' in notification.metadata:
                fields.append({
                    'name': 'Error',
                    'value': f"```{notification.metadata['error'][:500]}```",
                    'inline': False
                })
            
            if 'predictions_count' in notification.metadata:
                fields.append({
                    'name': 'Predictions',
                    'value': str(notification.metadata['predictions_count']),
                    'inline': True
                })
            
            if 'score' in notification.metadata:
                fields.append({
                    'name': 'Score',
                    'value': notification.metadata['score'],
                    'inline': True
                })
            
            if fields:
                embed['fields'] = fields
        
        return embed
    
    def validate_config(self) -> List[str]:
        """Validate Discord configuration"""
        errors = []
        
        if not self.webhook_url:
            errors.append("Webhook URL is required")
        elif not self.webhook_url.startswith('https://discord.com/api/webhooks/'):
            errors.append("Invalid Discord webhook URL format")
        
        # Check webhook URL format
        if self.webhook_url:
            try:
                import re
                pattern = r'https://discord\.com/api/webhooks/\d+/.+'
                if not re.match(pattern, self.webhook_url):
                    errors.append("Webhook URL does not match expected Discord format")
            except:
                pass
        
        # Validate username
        if self.username and len(self.username) > 32:
            errors.append("Discord username must be 32 characters or less")
        
        # Validate rate limit
        if self.config.rate_limit < 1 or self.config.rate_limit > 120:
            errors.append("Rate limit must be between 1 and 120 messages per minute")
        
        return errors
    
    def get_provider_info(self) -> Dict[str, Any]:
        """Get Discord provider information"""
        return {
            'name': 'Discord',
            'description': 'Send notifications to Discord channels via webhooks',
            'features': [
                'Rich embeds with colors and fields',
                'Custom username and avatar',
                'Rate limiting',
                'Timeout handling',
                'Metadata formatting'
            ],
            'required_settings': [
                'webhook_url: Discord webhook URL'
            ],
            'optional_settings': [
                'username: Bot username (max 32 chars)',
                'avatar_url: Bot avatar image URL',
                'enable_embeds: Enable rich embeds (default: true)',
                'default_color: Default embed color (hex)'
            ],
            'supported_events': [
                'match_created', 'match_started', 'match_completed',
                'score_updated', 'automation_error', 'scoring_completed'
            ],
            'rate_limits': {
                'webhook': '30 requests per second per webhook',
                'recommended': '10 messages per minute'
            }
        }
    
    async def test_webhook(self) -> Dict[str, Any]:
        """Test the Discord webhook connection"""
        if not self.webhook_url:
            return {
                'success': False,
                'error': 'No webhook URL configured'
            }
        
        test_notification = NotificationMessage(
            id='test-' + str(int(datetime.now().timestamp())),
            type=NotificationType.SYSTEM_ALERT,
            title='🧪 Test Notification',
            content='This is a test notification from the automation system.',
            metadata={'test': True}
        )
        
        try:
            success = await self.send_notification(test_notification)
            return {
                'success': success,
                'message': 'Test notification sent successfully' if success else 'Failed to send test notification'
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_webhook_info(self) -> Dict[str, Any]:
        """Get webhook information from URL"""
        if not self.webhook_url:
            return {'error': 'No webhook URL configured'}
        
        try:
            import re
            pattern = r'https://discord\.com/api/webhooks/(\d+)/(.+)'
            match = re.match(pattern, self.webhook_url)
            
            if match:
                webhook_id, webhook_token = match.groups()
                return {
                    'webhook_id': webhook_id,
                    'webhook_token': webhook_token[:10] + '...',  # Partial token for security
                    'valid_format': True
                }
            else:
                return {
                    'valid_format': False,
                    'error': 'Invalid webhook URL format'
                }
        except Exception as e:
            return {
                'valid_format': False,
                'error': str(e)
            }
