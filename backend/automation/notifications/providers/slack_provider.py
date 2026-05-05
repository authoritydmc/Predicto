"""
Slack notification provider
Sends notifications to Slack channels via webhooks
"""

import asyncio
import aiohttp
import json
from typing import Dict, Any, List
from datetime import datetime

from ..notification_base import NotificationProvider, NotificationMessage, NotificationConfig


class SlackProvider(NotificationProvider):
    """Slack webhook notification provider"""
    
    def __init__(self, config: NotificationConfig):
        super().__init__(config)
        self.webhook_url = config.settings.get('webhook_url')
        self.username = config.settings.get('username', 'Automation Bot')
        self.icon_emoji = config.settings.get('icon_emoji', ':robot_face:')
        self.icon_url = config.settings.get('icon_url')
        self.channel = config.settings.get('channel')
        self.enable_blocks = config.settings.get('enable_blocks', True)
    
    async def send_notification(self, notification: NotificationMessage) -> bool:
        """Send notification to Slack webhook"""
        if not self.webhook_url:
            return False
        
        # Check rate limit
        if not self.check_rate_limit():
            return False
        
        try:
            # Prepare Slack payload
            payload = self._prepare_payload(notification)
            
            # Send to Slack
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=self.config.timeout)) as session:
                async with session.post(
                    self.webhook_url,
                    json=payload,
                    headers={'Content-Type': 'application/json'}
                ) as response:
                    if response.status == 200:  # Slack success response
                        result = await response.json()
                        if result.get('ok'):
                            self.increment_sent_count()
                            return True
                        else:
                            print(f"[SlackProvider] Slack API error: {result.get('error', 'Unknown error')}")
                            return False
                    else:
                        error_text = await response.text()
                        print(f"[SlackProvider] HTTP error: {response.status} - {error_text}")
                        return False
        
        except asyncio.TimeoutError:
            print(f"[SlackProvider] Timeout sending notification: {notification.id}")
            return False
        except Exception as e:
            print(f"[SlackProvider] Exception sending notification: {e}")
            return False
    
    def _prepare_payload(self, notification: NotificationMessage) -> Dict[str, Any]:
        """Prepare Slack webhook payload"""
        payload = {
            'username': self.username,
            'text': notification.title,
            'attachments': []
        }
        
        if self.icon_emoji:
            payload['icon_emoji'] = self.icon_emoji
        elif self.icon_url:
            payload['icon_url'] = self.icon_url
        
        if self.channel:
            payload['channel'] = self.channel
        
        # Create attachment
        attachment = {
            'color': self._get_color(notification.priority),
            'text': notification.content,
            'footer': f'Automation System • {notification.type.value}',
            'ts': int(notification.created_at.timestamp())
        }
        
        # Add metadata fields
        if notification.metadata:
            fields = []
            
            # Common metadata fields
            if 'match_id' in notification.metadata:
                fields.append({
                    'title': 'Match ID',
                    'value': notification.metadata['match_id'],
                    'short': True
                })
            
            if 'tournament_id' in notification.metadata:
                fields.append({
                    'title': 'Tournament',
                    'value': notification.metadata['tournament_id'],
                    'short': True
                })
            
            if 'sport' in notification.metadata:
                fields.append({
                    'title': 'Sport',
                    'value': notification.metadata['sport'].title(),
                    'short': True
                })
            
            if 'component' in notification.metadata:
                fields.append({
                    'title': 'Component',
                    'value': notification.metadata['component'],
                    'short': True
                })
            
            if 'error' in notification.metadata:
                fields.append({
                    'title': 'Error',
                    'value': f"```{notification.metadata['error'][:500]}```",
                    'short': False
                })
            
            if 'predictions_count' in notification.metadata:
                fields.append({
                    'title': 'Predictions',
                    'value': str(notification.metadata['predictions_count']),
                    'short': True
                })
            
            if 'score' in notification.metadata:
                fields.append({
                    'title': 'Score',
                    'value': notification.metadata['score'],
                    'short': True
                })
            
            if fields:
                attachment['fields'] = fields
        
        payload['attachments'] = [attachment]
        
        return payload
    
    def _get_color(self, priority) -> str:
        """Get Slack color based on priority"""
        color_map = {
            'low': '#6f7c7c',      # Gray
            'normal': '#36a64f',   # Green
            'high': '#ff9500',     # Orange
            'critical': '#ff0000'   # Red
        }
        return color_map.get(priority.value, '#36a64f')
    
    def validate_config(self) -> List[str]:
        """Validate Slack configuration"""
        errors = []
        
        if not self.webhook_url:
            errors.append("Webhook URL is required")
        elif not self.webhook_url.startswith('https://hooks.slack.com/'):
            errors.append("Invalid Slack webhook URL format")
        
        # Check webhook URL format
        if self.webhook_url:
            try:
                import re
                pattern = r'https://hooks\.slack\.com/services/.+/.+/.+'
                if not re.match(pattern, self.webhook_url):
                    errors.append("Webhook URL does not match expected Slack format")
            except:
                pass
        
        # Validate username
        if self.username and len(self.username) > 80:
            errors.append("Slack username must be 80 characters or less")
        
        # Validate rate limit
        if self.config.rate_limit < 1 or self.config.rate_limit > 60:
            errors.append("Rate limit must be between 1 and 60 messages per minute")
        
        return errors
    
    def get_provider_info(self) -> Dict[str, Any]:
        """Get Slack provider information"""
        return {
            'name': 'Slack',
            'description': 'Send notifications to Slack channels via webhooks',
            'features': [
                'Rich attachments with colors and fields',
                'Custom username and icon',
                'Rate limiting',
                'Timeout handling',
                'Metadata formatting'
            ],
            'required_settings': [
                'webhook_url: Slack webhook URL'
            ],
            'optional_settings': [
                'username: Bot username (max 80 chars)',
                'icon_emoji: Bot icon emoji (e.g., :robot_face:)',
                'icon_url: Bot icon image URL',
                'channel: Override channel',
                'enable_blocks: Enable block formatting (default: true)'
            ],
            'supported_events': [
                'match_created', 'match_started', 'match_completed',
                'score_updated', 'automation_error', 'scoring_completed'
            ],
            'rate_limits': {
                'webhook': '1 request per second per workspace',
                'recommended': '10 messages per minute'
            }
        }
    
    async def test_webhook(self) -> Dict[str, Any]:
        """Test the Slack webhook connection"""
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
            pattern = r'https://hooks\.slack\.com/services/([^/]+)/([^/]+)/([^/]+)'
            match = re.match(pattern, self.webhook_url)
            
            if match:
                team_id, channel_id, webhook_token = match.groups()
                return {
                    'team_id': team_id,
                    'channel_id': channel_id,
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
