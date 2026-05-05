"""
Configuration Management System
Centralized configuration management for automation system
"""

import json
import os
from typing import Dict, Any, Optional, List, Union
from datetime import datetime
from dataclasses import dataclass, asdict, field
from pathlib import Path

from ..base.firebase_client import FirebaseClient
from ..scheduler.websocket_logger import WebSocketLogger


@dataclass
class AutomationConfig:
    """Main automation configuration"""
    # General settings
    enabled: bool = True
    debug_mode: bool = False
    log_level: str = "info"
    
    # Task intervals (seconds)
    match_creation_interval: int = 300  # 5 minutes
    scraping_interval: int = 60  # 1 minute
    scoring_interval: int = 30  # 30 seconds
    
    # Concurrency limits
    max_concurrent_tasks: int = 3
    max_concurrent_scrapers: int = 2
    max_concurrent_score_jobs: int = 2
    
    # Retry settings
    enable_retries: bool = True
    max_retries: int = 3
    retry_delay: int = 60  # seconds
    
    # Performance settings
    cache_ttl: int = 300  # 5 minutes
    request_timeout: int = 30  # seconds
    batch_size: int = 10
    
    # Alert thresholds
    max_error_rate: float = 0.2  # 20%
    max_response_time: int = 30000  # 30 seconds
    min_success_rate: float = 0.8  # 80%
    max_consecutive_failures: int = 5
    heartbeat_timeout: int = 60000  # 1 minute


@dataclass
class ScraperConfig:
    """Scraper-specific configuration"""
    enabled: bool = True
    priority: int = 1
    api_key: Optional[str] = None
    timeout: int = 30
    retry_count: int = 3
    success_rate_threshold: float = 0.7
    cooldown_duration: int = 300  # 5 minutes


@dataclass
class MatchSourceConfig:
    """Match source configuration"""
    enabled: bool = True
    priority: int = 1
    api_key: Optional[str] = None
    fetch_interval: int = 300  # 5 minutes
    batch_size: int = 50


@dataclass
class ComponentConfig:
    """Component-specific configuration"""
    enabled: bool = True
    debug_mode: bool = False
    custom_settings: Dict[str, Any] = field(default_factory=dict)


class ConfigManager:
    """
    Centralized configuration management
    Handles configuration loading, saving, and validation
    """
    
    def __init__(self, firebase_client: FirebaseClient, logger: WebSocketLogger):
        self.client = firebase_client
        self.logger = logger
        
        # Configuration objects
        self.automation_config = AutomationConfig()
        self.scraper_configs: Dict[str, ScraperConfig] = {}
        self.match_source_configs: Dict[str, MatchSourceConfig] = {}
        self.component_configs: Dict[str, ComponentConfig] = {}
        
        # Configuration file path
        self.config_file_path = Path(__file__).parent.parent.parent / 'automation_config.json'
        
        # Load configurations
        self._load_all_configs()
        
        # Register self as component
        self.logger.register_component('config_manager', {
            'type': 'config_manager',
            'version': '1.0.0',
            'config_file': str(self.config_file_path)
        })
    
    def _load_all_configs(self):
        """Load all configurations from Firebase and local file"""
        try:
            # Load from Firebase first
            self._load_from_firebase()
            
            # Then load from local file (for development/backup)
            self._load_from_file()
            
            # Initialize default configs if needed
            self._initialize_default_configs()
            
            # Validate configurations
            self._validate_configs()
            
            self.logger.info('config_manager', 'All configurations loaded successfully')
            
        except Exception as e:
            self.logger.error('config_manager', f'Error loading configurations: {str(e)}')
            # Use defaults if loading fails
            self._initialize_default_configs()
    
    def _load_from_firebase(self):
        """Load configuration from Firebase"""
        try:
            # Load main automation config
            automation_data = self.client.get('automation_config/main')
            if automation_data:
                self.automation_config = AutomationConfig(**automation_data)
            
            # Load scraper configs
            scraper_data = self.client.get('automation_config/scraper_configs')
            if scraper_data:
                for name, config in scraper_data.items():
                    self.scraper_configs[name] = ScraperConfig(**config)
            
            # Load match source configs
            match_source_data = self.client.get('automation_config/match_sources')
            if match_source_data:
                for name, config in match_source_data.items():
                    self.match_source_configs[name] = MatchSourceConfig(**config)
            
            # Load component configs
            component_data = self.client.get('automation_config/components')
            if component_data:
                for name, config in component_data.items():
                    self.component_configs[name] = ComponentConfig(**config)
            
            self.logger.info('config_manager', 'Configuration loaded from Firebase')
            
        except Exception as e:
            self.logger.warning('config_manager', f'Failed to load from Firebase: {str(e)}')
    
    def _load_from_file(self):
        """Load configuration from local file"""
        try:
            if self.config_file_path.exists():
                with open(self.config_file_path, 'r') as f:
                    file_config = json.load(f)
                
                # Update configurations (local file takes precedence for development)
                if 'automation' in file_config:
                    automation_data = file_config['automation']
                    for key, value in automation_data.items():
                        if hasattr(self.automation_config, key):
                            setattr(self.automation_config, key, value)
                
                if 'scrapers' in file_config:
                    for name, config in file_config['scrapers'].items():
                        if name not in self.scraper_configs:
                            self.scraper_configs[name] = ScraperConfig()
                        for key, value in config.items():
                            if hasattr(self.scraper_configs[name], key):
                                setattr(self.scraper_configs[name], key, value)
                
                self.logger.info('config_manager', f'Configuration loaded from file: {self.config_file_path}')
            
        except Exception as e:
            self.logger.warning('config_manager', f'Failed to load from file: {str(e)}')
    
    def _initialize_default_configs(self):
        """Initialize default configurations"""
        # Default scraper configs
        default_scrapers = {
            'cricbuzz': ScraperConfig(enabled=True, priority=1),
            'cricapi': ScraperConfig(enabled=True, priority=2),
            'google': ScraperConfig(enabled=True, priority=3),
            'apifootball': ScraperConfig(enabled=True, priority=1)
        }
        
        for name, config in default_scrapers.items():
            if name not in self.scraper_configs:
                self.scraper_configs[name] = config
        
        # Default match source configs
        default_match_sources = {
            'cricapi': MatchSourceConfig(enabled=True, priority=1),
            'cricbuzz': MatchSourceConfig(enabled=True, priority=2),
            'manual': MatchSourceConfig(enabled=True, priority=3)
        }
        
        for name, config in default_match_sources.items():
            if name not in self.match_source_configs:
                self.match_source_configs[name] = config
        
        # Default component configs
        default_components = {
            'match_manager': ComponentConfig(enabled=True),
            'scraper_manager': ComponentConfig(enabled=True),
            'scoring_engine': ComponentConfig(enabled=True),
            'status_monitor': ComponentConfig(enabled=True)
        }
        
        for name, config in default_components.items():
            if name not in self.component_configs:
                self.component_configs[name] = config
    
    def _validate_configs(self):
        """Validate configuration values"""
        errors = []
        
        # Validate automation config
        if self.automation_config.match_creation_interval < 60:
            errors.append("match_creation_interval must be at least 60 seconds")
        
        if self.automation_config.scraping_interval < 30:
            errors.append("scraping_interval must be at least 30 seconds")
        
        if self.automation_config.max_concurrent_tasks < 1:
            errors.append("max_concurrent_tasks must be at least 1")
        
        # Validate scraper configs
        for name, config in self.scraper_configs.items():
            if config.priority < 1:
                errors.append(f"scraper {name}: priority must be at least 1")
            if config.timeout < 5:
                errors.append(f"scraper {name}: timeout must be at least 5 seconds")
        
        if errors:
            error_msg = "Configuration validation errors: " + "; ".join(errors)
            self.logger.error('config_manager', error_msg)
            raise ValueError(error_msg)
        
        self.logger.info('config_manager', 'Configuration validation passed')
    
    def save_config(self, component: str = None, to_firebase: bool = True, to_file: bool = True):
        """Save configuration to Firebase and/or local file"""
        try:
            if to_firebase:
                self._save_to_firebase(component)
            
            if to_file:
                self._save_to_file()
            
            self.logger.info('config_manager', f'Configuration saved: component={component}, firebase={to_firebase}, file={to_file}')
            
        except Exception as e:
            self.logger.error('config_manager', f'Error saving configuration: {str(e)}')
            raise
    
    def _save_to_firebase(self, component: str = None):
        """Save configuration to Firebase"""
        if component is None or component == 'automation':
            self.client.set('automation_config/main', asdict(self.automation_config))
        
        if component is None or component == 'scrapers':
            scraper_data = {name: asdict(config) for name, config in self.scraper_configs.items()}
            self.client.set('automation_config/scraper_configs', scraper_data)
        
        if component is None or component == 'match_sources':
            match_source_data = {name: asdict(config) for name, config in self.match_source_configs.items()}
            self.client.set('automation_config/match_sources', match_source_data)
        
        if component is None or component == 'components':
            component_data = {name: asdict(config) for name, config in self.component_configs.items()}
            self.client.set('automation_config/components', component_data)
    
    def _save_to_file(self):
        """Save configuration to local file"""
        config_data = {
            'automation': asdict(self.automation_config),
            'scrapers': {name: asdict(config) for name, config in self.scraper_configs.items()},
            'match_sources': {name: asdict(config) for name, config in self.match_source_configs.items()},
            'components': {name: asdict(config) for name, config in self.component_configs.items()},
            'saved_at': datetime.now().isoformat(),
            'version': '1.0.0'
        }
        
        # Create directory if it doesn't exist
        self.config_file_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(self.config_file_path, 'w') as f:
            json.dump(config_data, f, indent=2)
        
        self.logger.info('config_manager', f'Configuration saved to file: {self.config_file_path}')
    
    def update_automation_config(self, updates: Dict[str, Any], save: bool = True) -> Dict[str, Any]:
        """Update automation configuration"""
        try:
            # Apply updates
            for key, value in updates.items():
                if hasattr(self.automation_config, key):
                    setattr(self.automation_config, key, value)
                else:
                    self.logger.warning('config_manager', f'Unknown automation config key: {key}')
            
            # Validate after update
            self._validate_configs()
            
            # Save if requested
            if save:
                self.save_config('automation')
            
            self.logger.info('config_manager', f'Automation config updated: {updates}')
            
            return {'success': True, 'config': asdict(self.automation_config)}
            
        except Exception as e:
            self.logger.error('config_manager', f'Error updating automation config: {str(e)}')
            return {'success': False, 'error': str(e)}
    
    def update_scraper_config(self, scraper_name: str, updates: Dict[str, Any], save: bool = True) -> Dict[str, Any]:
        """Update scraper configuration"""
        try:
            if scraper_name not in self.scraper_configs:
                self.scraper_configs[scraper_name] = ScraperConfig()
            
            config = self.scraper_configs[scraper_name]
            
            # Apply updates
            for key, value in updates.items():
                if hasattr(config, key):
                    setattr(config, key, value)
                else:
                    self.logger.warning('config_manager', f'Unknown scraper config key: {key}')
            
            # Validate after update
            self._validate_configs()
            
            # Save if requested
            if save:
                self.save_config('scrapers')
            
            self.logger.info('config_manager', f'Scraper config updated: {scraper_name} - {updates}')
            
            return {'success': True, 'config': asdict(config)}
            
        except Exception as e:
            self.logger.error('config_manager', f'Error updating scraper config: {str(e)}')
            return {'success': False, 'error': str(e)}
    
    def update_component_config(self, component_name: str, updates: Dict[str, Any], save: bool = True) -> Dict[str, Any]:
        """Update component configuration"""
        try:
            if component_name not in self.component_configs:
                self.component_configs[component_name] = ComponentConfig()
            
            config = self.component_configs[component_name]
            
            # Apply updates
            for key, value in updates.items():
                if hasattr(config, key):
                    setattr(config, key, value)
                elif key == 'custom_settings':
                    config.custom_settings.update(value)
                else:
                    self.logger.warning('config_manager', f'Unknown component config key: {key}')
            
            # Save if requested
            if save:
                self.save_config('components')
            
            self.logger.info('config_manager', f'Component config updated: {component_name} - {updates}')
            
            return {'success': True, 'config': asdict(config)}
            
        except Exception as e:
            self.logger.error('config_manager', f'Error updating component config: {str(e)}')
            return {'success': False, 'error': str(e)}
    
    def get_config(self, component: str = None) -> Dict[str, Any]:
        """Get configuration"""
        if component == 'automation':
            return asdict(self.automation_config)
        elif component == 'scrapers':
            return {name: asdict(config) for name, config in self.scraper_configs.items()}
        elif component == 'match_sources':
            return {name: asdict(config) for name, config in self.match_source_configs.items()}
        elif component == 'components':
            return {name: asdict(config) for name, config in self.component_configs.items()}
        elif component and component in self.component_configs:
            return asdict(self.component_configs[component])
        elif component and component in self.scraper_configs:
            return asdict(self.scraper_configs[component])
        elif component and component in self.match_source_configs:
            return asdict(self.match_source_configs[component])
        else:
            # Return all configs
            return {
                'automation': asdict(self.automation_config),
                'scrapers': {name: asdict(config) for name, config in self.scraper_configs.items()},
                'match_sources': {name: asdict(config) for name, config in self.match_source_configs.items()},
                'components': {name: asdict(config) for name, config in self.component_configs.items()}
            }
    
    def reset_config(self, component: str = None) -> Dict[str, Any]:
        """Reset configuration to defaults"""
        try:
            if component == 'automation' or component is None:
                self.automation_config = AutomationConfig()
            
            if component == 'scrapers' or component is None:
                self.scraper_configs.clear()
            
            if component == 'match_sources' or component is None:
                self.match_source_configs.clear()
            
            if component == 'components' or component is None:
                self.component_configs.clear()
            
            # Re-initialize defaults
            self._initialize_default_configs()
            
            # Validate
            self._validate_configs()
            
            # Save
            self.save_config()
            
            self.logger.info('config_manager', f'Configuration reset: {component or "all"}')
            
            return {'success': True, 'message': f'Configuration reset: {component or "all"}'}
            
        except Exception as e:
            self.logger.error('config_manager', f'Error resetting configuration: {str(e)}')
            return {'success': False, 'error': str(e)}
    
    def export_config(self, file_path: str = None) -> str:
        """Export configuration to file"""
        if file_path is None:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            file_path = f'automation_config_export_{timestamp}.json'
        
        config_data = {
            'automation': asdict(self.automation_config),
            'scrapers': {name: asdict(config) for name, config in self.scraper_configs.items()},
            'match_sources': {name: asdict(config) for name, config in self.match_source_configs.items()},
            'components': {name: asdict(config) for name, config in self.component_configs.items()},
            'exported_at': datetime.now().isoformat(),
            'version': '1.0.0'
        }
        
        with open(file_path, 'w') as f:
            json.dump(config_data, f, indent=2)
        
        self.logger.info('config_manager', f'Configuration exported to: {file_path}')
        
        return file_path
    
    def import_config(self, file_path: str, merge: bool = True) -> Dict[str, Any]:
        """Import configuration from file"""
        try:
            with open(file_path, 'r') as f:
                config_data = json.load(f)
            
            if not merge:
                # Reset everything first
                self.reset_config()
            
            # Import automation config
            if 'automation' in config_data:
                for key, value in config_data['automation'].items():
                    if hasattr(self.automation_config, key):
                        setattr(self.automation_config, key, value)
            
            # Import scraper configs
            if 'scrapers' in config_data:
                for name, config in config_data['scrapers'].items():
                    if name not in self.scraper_configs:
                        self.scraper_configs[name] = ScraperConfig()
                    for key, value in config.items():
                        if hasattr(self.scraper_configs[name], key):
                            setattr(self.scraper_configs[name], key, value)
            
            # Import match source configs
            if 'match_sources' in config_data:
                for name, config in config_data['match_sources'].items():
                    if name not in self.match_source_configs:
                        self.match_source_configs[name] = MatchSourceConfig()
                    for key, value in config.items():
                        if hasattr(self.match_source_configs[name], key):
                            setattr(self.match_source_configs[name], key, value)
            
            # Import component configs
            if 'components' in config_data:
                for name, config in config_data['components'].items():
                    if name not in self.component_configs:
                        self.component_configs[name] = ComponentConfig()
                    for key, value in config.items():
                        if hasattr(self.component_configs[name], key):
                            setattr(self.component_configs[name], key, value)
                        elif key == 'custom_settings':
                            self.component_configs[name].custom_settings.update(value)
            
            # Validate and save
            self._validate_configs()
            self.save_config()
            
            self.logger.info('config_manager', f'Configuration imported from: {file_path}')
            
            return {'success': True, 'message': f'Configuration imported from: {file_path}'}
            
        except Exception as e:
            self.logger.error('config_manager', f'Error importing configuration: {str(e)}')
            return {'success': False, 'error': str(e)}
