"""
Enhanced Automation Orchestrator Package
Provides comprehensive automation system for match management, scraping, and scoring
"""

from .automation_orchestrator import AutomationOrchestrator, AutomationTask, AutomationStatus
from .match_manager import MatchManager, MatchInfo
from .scraper_manager import ScraperManager, ScraperConfig, ScraperStatus
from .scoring_engine import ScoringEngine, ProcessingJob, ProcessingStatus
from .status_monitor import StatusMonitor, ComponentStatus, ComponentHealth, AutomationStatus as MonitorStatus
from .config_manager import ConfigManager, AutomationConfig, ScraperConfig as ConfigScraperConfig, MatchSourceConfig, ComponentConfig
from .enhanced_websocket_logger import EnhancedWebSocketLogger, LogLevel, LogEntry
from .main import EnhancedAutomationSystem

__version__ = "2.0.0"
__author__ = "Automation Team"

__all__ = [
    # Core orchestrator
    "AutomationOrchestrator",
    "AutomationTask", 
    "AutomationStatus",
    "EnhancedAutomationSystem",
    
    # Match management
    "MatchManager",
    "MatchInfo",
    
    # Scraper management
    "ScraperManager",
    "ScraperConfig",
    "ScraperStatus",
    
    # Scoring engine
    "ScoringEngine",
    "ProcessingJob",
    "ProcessingStatus",
    
    # Status monitoring
    "StatusMonitor",
    "ComponentStatus",
    "ComponentHealth",
    "MonitorStatus",
    
    # Configuration management
    "ConfigManager",
    "AutomationConfig",
    "ConfigScraperConfig",
    "MatchSourceConfig", 
    "ComponentConfig",
    
    # Logging
    "EnhancedWebSocketLogger",
    "LogLevel",
    "LogEntry"
]
