"""
Base classes and interfaces for notification delivery system
Defines the core architecture for multi-platform notifications
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional, Union
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
import json


class NotificationStatus(Enum):
    """Notification delivery status"""
    PENDING = "pending"
    SENDING = "sending"
    SENT = "sent"
    FAILED = "failed"
    RETRYING = "retrying"
    CANCELLED = "cancelled"


class NotificationPriority(Enum):
    """Notification priority levels"""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"


class NotificationType(Enum):
    """Notification types"""
    MATCH_CREATED = "match_created"
    MATCH_STARTED = "match_started"
    MATCH_COMPLETED = "match_completed"
    SCORE_UPDATED = "score_updated"
    AUTOMATION_ERROR = "automation_error"
    AUTOMATION_STARTED = "automation_started"
    AUTOMATION_STOPPED = "automation_stopped"
    SCRAPER_ERROR = "scraper_error"
    SCORING_COMPLETED = "scoring_completed"
    SYSTEM_ALERT = "system_alert"
    CUSTOM = "custom"


@dataclass
class NotificationMessage:
    """Core notification message structure"""
    id: str
    type: NotificationType
    title: str
    content: str
    priority: NotificationPriority = NotificationPriority.NORMAL
    status: NotificationStatus = NotificationStatus.PENDING
    created_at: datetime = field(default_factory=datetime.now)
    sent_at: Optional[datetime] = None
    retry_count: int = 0
    max_retries: int = 3
    delay_until: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    target_providers: List[str] = field(default_factory=list)
    exclude_providers: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage"""
        return {
            'id': self.id,
            'type': self.type.value,
            'title': self.title,
            'content': self.content,
            'priority': self.priority.value,
            'status': self.status.value,
            'created_at': self.created_at.isoformat(),
            'sent_at': self.sent_at.isoformat() if self.sent_at else None,
            'retry_count': self.retry_count,
            'max_retries': self.max_retries,
            'delay_until': self.delay_until.isoformat() if self.delay_until else None,
            'metadata': self.metadata,
            'target_providers': self.target_providers,
            'exclude_providers': self.exclude_providers
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'NotificationMessage':
        """Create from dictionary"""
        return cls(
            id=data['id'],
            type=NotificationType(data['type']),
            title=data['title'],
            content=data['content'],
            priority=NotificationPriority(data.get('priority', 'normal')),
            status=NotificationStatus(data.get('status', 'pending')),
            created_at=datetime.fromisoformat(data['created_at']),
            sent_at=datetime.fromisoformat(data['sent_at']) if data.get('sent_at') else None,
            retry_count=data.get('retry_count', 0),
            max_retries=data.get('max_retries', 3),
            delay_until=datetime.fromisoformat(data['delay_until']) if data.get('delay_until') else None,
            metadata=data.get('metadata', {}),
            target_providers=data.get('target_providers', []),
            exclude_providers=data.get('exclude_providers', [])
        )


@dataclass
class NotificationConfig:
    """Configuration for a notification provider"""
    provider_name: str
    enabled: bool = True
    priority: int = 1  # Lower number = higher priority
    settings: Dict[str, Any] = field(default_factory=dict)
    rate_limit: int = 10  # Messages per minute
    retry_attempts: int = 3
    timeout: int = 30  # seconds
    supported_types: List[NotificationType] = field(default_factory=list)
    excluded_types: List[NotificationType] = field(default_factory=list)
    
    def should_send_notification(self, notification: NotificationMessage) -> bool:
        """Check if this provider should send the notification"""
        if not self.enabled:
            return False
        
        # Check if notification type is supported
        if self.supported_types and notification.type not in self.supported_types:
            return False
        
        # Check if notification type is excluded
        if notification.type in self.excluded_types:
            return False
        
        # Check if provider is in exclude list
        if self.provider_name in notification.exclude_providers:
            return False
        
        # Check if provider is in target list (if specified)
        if notification.target_providers and self.provider_name not in notification.target_providers:
            return False
        
        return True
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage"""
        return {
            'provider_name': self.provider_name,
            'enabled': self.enabled,
            'priority': self.priority,
            'settings': self.settings,
            'rate_limit': self.rate_limit,
            'retry_attempts': self.retry_attempts,
            'timeout': self.timeout,
            'supported_types': [t.value for t in self.supported_types],
            'excluded_types': [t.value for t in self.excluded_types]
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'NotificationConfig':
        """Create from dictionary"""
        return cls(
            provider_name=data['provider_name'],
            enabled=data.get('enabled', True),
            priority=data.get('priority', 1),
            settings=data.get('settings', {}),
            rate_limit=data.get('rate_limit', 10),
            retry_attempts=data.get('retry_attempts', 3),
            timeout=data.get('timeout', 30),
            supported_types=[NotificationType(t) for t in data.get('supported_types', [])],
            excluded_types=[NotificationType(t) for t in data.get('excluded_types', [])]
        )


class NotificationProvider(ABC):
    """Abstract base class for notification providers"""
    
    def __init__(self, config: NotificationConfig):
        self.config = config
        self.last_sent_time = 0
        self.messages_sent = 0
    
    @abstractmethod
    async def send_notification(self, notification: NotificationMessage) -> bool:
        """
        Send a notification
        
        Args:
            notification: The notification to send
            
        Returns:
            True if successful, False otherwise
        """
        pass
    
    @abstractmethod
    def validate_config(self) -> List[str]:
        """
        Validate provider configuration
        
        Returns:
            List of validation errors (empty if valid)
        """
        pass
    
    @abstractmethod
    def get_provider_info(self) -> Dict[str, Any]:
        """
        Get provider information
        
        Returns:
            Provider information dictionary
        """
        pass
    
    def check_rate_limit(self) -> bool:
        """Check if rate limit is exceeded"""
        import time
        current_time = time.time()
        
        # Reset counter every minute
        if current_time - self.last_sent_time > 60:
            self.messages_sent = 0
            self.last_sent_time = current_time
        
        return self.messages_sent < self.config.rate_limit
    
    def increment_sent_count(self):
        """Increment the sent message counter"""
        self.messages_sent += 1
        import time
        self.last_sent_time = time.time()


@dataclass
class NotificationEvent:
    """Event that triggers notifications"""
    event_type: str
    data: Dict[str, Any]
    timestamp: datetime = field(default_factory=datetime.now)
    source: str = "automation"
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'event_type': self.event_type,
            'data': self.data,
            'timestamp': self.timestamp.isoformat(),
            'source': self.source
        }


class NotificationTemplate:
    """Template for generating notification messages"""
    
    def __init__(self, template_id: str, title_template: str, content_template: str):
        self.template_id = template_id
        self.title_template = title_template
        self.content_template = content_template
    
    def render(self, **kwargs) -> tuple[str, str]:
        """
        Render the template with provided data
        
        Args:
            **kwargs: Template variables
            
        Returns:
            Tuple of (title, content)
        """
        try:
            title = self.title_template.format(**kwargs)
            content = self.content_template.format(**kwargs)
            return title, content
        except KeyError as e:
            raise ValueError(f"Missing template variable: {e}")
        except Exception as e:
            raise ValueError(f"Template rendering error: {e}")


class NotificationRegistry:
    """Registry for notification templates and event mappings"""
    
    def __init__(self):
        self.templates: Dict[str, NotificationTemplate] = {}
        self.event_mappings: Dict[str, List[str]] = {}  # event_type -> template_ids
        self.default_templates = self._create_default_templates()
    
    def _create_default_templates(self) -> Dict[str, NotificationTemplate]:
        """Create default notification templates"""
        return {
            'match_created': NotificationTemplate(
                'match_created',
                '🏏 New Match Discovered: {team_a} vs {team_b}',
                'A new match has been automatically discovered and scheduled:\n\n**{team_a} vs {team_b}**\n📅 **Date**: {date}\n📍 **Venue**: {venue}\n🏆 **Tournament**: {tournament_id}\n\n*This match was automatically created by the Automation Service.*'
            ),
            'match_started': NotificationTemplate(
                'match_started',
                '🚀 Match Started: {team_a} vs {team_b}',
                'The match has begun!\n\n**{team_a} vs {team_b}**\nLive scoring is now available.'
            ),
            'match_completed': NotificationTemplate(
                'match_completed',
                '✅ Match Completed: {team_a} vs {team_b}',
                'Match finished!\n\n**Winner: {winner}**\nFinal Score: {score}\nPredictions processed: {predictions_count}'
            ),
            'score_updated': NotificationTemplate(
                'score_updated',
                '📊 Score Update: {team_a} vs {team_b}',
                'Live score update:\n\n**{team_a}: {score_a} ({overs_a})**\n**{team_b}: {score_b} ({overs_b})**\nStatus: {status}'
            ),
            'automation_error': NotificationTemplate(
                'automation_error',
                '⚠️ Automation Error',
                'An error occurred in the automation system:\n\n**Component**: {component}\n**Error**: {error}\n**Time**: {time}'
            ),
            'automation_started': NotificationTemplate(
                'automation_started',
                '🤖 Automation System Started',
                'The enhanced automation system has started successfully.\n\nComponents: {components}\nMode: {mode}'
            ),
            'automation_stopped': NotificationTemplate(
                'automation_stopped',
                '🛑 Automation System Stopped',
                'The enhanced automation system has stopped.\n\nReason: {reason}\nUptime: {uptime}'
            ),
            'scraper_error': NotificationTemplate(
                'scraper_error',
                '🔍 Scraper Error',
                'A scraper encountered an error:\n\n**Scraper**: {scraper}\n**Match**: {match}\n**Error**: {error}'
            ),
            'scoring_completed': NotificationTemplate(
                'scoring_completed',
                '📈 Scoring Completed',
                'Score processing completed for:\n\n**Match**: {team_a} vs {team_b}\n**Predictions**: {predictions_count}\n**Time**: {time}'
            ),
            'system_alert': NotificationTemplate(
                'system_alert',
                '🚨 System Alert',
                'System alert:\n\n**Alert**: {alert}\n**Severity**: {severity}\n**Details**: {details}'
            )
        }
    
    def register_template(self, template: NotificationTemplate):
        """Register a notification template"""
        self.templates[template.template_id] = template
    
    def get_template(self, template_id: str) -> Optional[NotificationTemplate]:
        """Get a template by ID"""
        return self.templates.get(template_id)
    
    def render_notification(self, template_id: str, **kwargs) -> tuple[str, str]:
        """Render a notification from template"""
        template = self.get_template(template_id)
        if not template:
            raise ValueError(f"Template not found: {template_id}")
        return template.render(**kwargs)
    
    def map_event_to_templates(self, event_type: str, template_ids: List[str]):
        """Map an event type to template IDs"""
        self.event_mappings[event_type] = template_ids
    
    def get_templates_for_event(self, event_type: str) -> List[NotificationTemplate]:
        """Get all templates for an event type"""
        template_ids = self.event_mappings.get(event_type, [])
        
        # If no mapping exists, try to find templates by event type name
        if not template_ids:
            template_id = event_type.replace('.', '_')
            if template_id in self.templates:
                template_ids = [template_id]
        
        return [self.templates[tid] for tid in template_ids if tid in self.templates]
