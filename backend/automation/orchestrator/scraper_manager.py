"""
Enhanced Scraper Manager
Manages multiple scrapers with intelligent fallback and match detection
"""

import requests
import json
import time
import re
from typing import Dict, List, Optional, Any, Callable
from datetime import datetime
from dataclasses import dataclass
from enum import Enum

from ..base.firebase_client import FirebaseClient
from ..scheduler.websocket_logger import WebSocketLogger
from scraper.live_score_scraper import ScraperManager as BaseScraperManager


class ScraperStatus(Enum):
    ACTIVE = "active"
    FAILED = "failed"
    DISABLED = "disabled"
    TESTING = "testing"


@dataclass
class ScraperConfig:
    """Scraper configuration"""
    name: str
    enabled: bool
    priority: int
    success_rate: float = 0.0
    last_success: Optional[int] = None
    last_failure: Optional[int] = None
    consecutive_failures: int = 0
    max_failures: int = 5
    cooldown_until: Optional[int] = None


class ScraperManager:
    """
    Enhanced scraper manager with intelligent fallback
    Monitors scraper health and automatically adjusts priorities
    """
    
    def __init__(self, firebase_client: FirebaseClient, logger: WebSocketLogger):
        self.client = firebase_client
        self.logger = logger
        self.running = False
        
        # Base scraper manager
        self.base_scraper = BaseScraperManager()
        
        # Scraper configurations
        self.scraper_configs: Dict[str, ScraperConfig] = {}
        self._load_scraper_configs()
        
        # Performance tracking
        self.performance_history: Dict[str, List[Dict[str, Any]]] = {}
        
        # Match detection cache
        self.match_detection_cache: Dict[str, Dict[str, Any]] = {}
        self.cache_expiry = 300  # 5 minutes
    
    def _load_scraper_configs(self):
        """Load scraper configurations from Firebase"""
        config_data = self.client.get('automation_config/scraper_configs') or {}
        
        default_configs = {
            'cricbuzz': ScraperConfig('cricbuzz', True, 1),
            'cricapi': ScraperConfig('cricapi', True, 2),
            'google': ScraperConfig('google', True, 3),
            'apifootball': ScraperConfig('apifootball', True, 1)
        }
        
        for name, config in default_configs.items():
            if name in config_data:
                # Update with saved config
                saved = config_data[name]
                config.enabled = saved.get('enabled', True)
                config.priority = saved.get('priority', config.priority)
                config.success_rate = saved.get('success_rate', 0.0)
                config.last_success = saved.get('last_success')
                config.last_failure = saved.get('last_failure')
                config.consecutive_failures = saved.get('consecutive_failures', 0)
            
            self.scraper_configs[name] = config
    
    def start(self):
        """Start the scraper manager"""
        self.running = True
        self.logger.info('scraper_manager', 'Scraper manager started')
        
        # Initialize performance history
        for scraper_name in self.scraper_configs:
            self.performance_history[scraper_name] = []
    
    def stop(self):
        """Stop the scraper manager"""
        self.running = False
        self.logger.info('scraper_manager', 'Scraper manager stopped')
        
        # Save configurations
        self._save_scraper_configs()
    
    def scrape_match_score(self, match: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Scrape live score for a specific match with intelligent fallback
        
        Args:
            match: Match information
            
        Returns:
            Score data or None if all scrapers fail
        """
        match_id = match.get('matchId', match.get('id', ''))
        team_a = match.get('teamA', match.get('team_a', ''))
        team_b = match.get('teamB', match.get('team_b', ''))
        sport = match.get('sport', 'cricket')
        
        self.logger.info('scraper_manager', f'Scraping score for {team_a} vs {team_b}')
        
        # Check cache first
        cache_key = f"{match_id}_{team_a}_{team_b}"
        cached_data = self._get_from_cache(cache_key)
        if cached_data:
            self.logger.info('scraper_manager', f'Using cached data for {team_a} vs {team_b}')
            return cached_data
        
        # Get ordered list of available scrapers
        available_scrapers = self._get_available_scrapers(sport)
        
        if not available_scrapers:
            self.logger.error('scraper_manager', 'No scrapers available')
            return None
        
        # Try each scraper in order
        for scraper_name in available_scrapers:
            config = self.scraper_configs[scraper_name]
            
            # Check if scraper is in cooldown
            if config.cooldown_until and time.time() * 1000 < config.cooldown_until:
                self.logger.info('scraper_manager', f'Scraper {scraper_name} is in cooldown')
                continue
            
            self.logger.info('scraper_manager', f'Trying scraper: {scraper_name}')
            
            try:
                # Attempt to scrape
                start_time = time.time()
                result = self._scrape_with_scraper(scraper_name, match_id, team_a, team_b, sport)
                duration = time.time() - start_time
                
                if result:
                    # Success
                    self._record_success(scraper_name, duration)
                    self._cache_result(cache_key, result)
                    
                    self.logger.info('scraper_manager', f'Success with {scraper_name} in {duration:.2f}s')
                    return result
                else:
                    # Failure
                    self._record_failure(scraper_name, 'No data returned')
                    
            except Exception as e:
                self._record_failure(scraper_name, str(e))
                self.logger.error('scraper_manager', f'Scraper {scraper_name} error: {str(e)}')
        
        self.logger.error('scraper_manager', f'All scrapers failed for {team_a} vs {team_b}')
        return None
    
    def _scrape_with_scraper(self, scraper_name: str, match_id: str, team_a: str, team_b: str, sport: str) -> Optional[Dict[str, Any]]:
        """Scrape using a specific scraper"""
        if sport == 'cricket':
            return self.base_scraper.get_cricket_score_with_fallback(match_id, team_a, team_b)
        elif sport == 'football':
            return self.base_scraper.get_football_score_with_fallback(match_id, team_a, team_b)
        else:
            return None
    
    def _get_available_scrapers(self, sport: str) -> List[str]:
        """Get ordered list of available scrapers for a sport"""
        available = []
        
        # Filter by sport and enabled status
        sport_scrapers = {
            'cricket': ['cricbuzz', 'cricapi', 'google'],
            'football': ['apifootball']
        }
        
        for scraper_name in sport_scrapers.get(sport, []):
            config = self.scraper_configs.get(scraper_name)
            if config and config.enabled and config.cooldown_until is None:
                available.append(scraper_name)
        
        # Sort by priority and success rate
        available.sort(key=lambda name: (
            self.scraper_configs[name].priority,
            -self.scraper_configs[name].success_rate
        ))
        
        return available
    
    def _record_success(self, scraper_name: str, duration: float):
        """Record successful scrape"""
        config = self.scraper_configs[scraper_name]
        
        # Update config
        config.last_success = int(time.time() * 1000)
        config.consecutive_failures = 0
        config.cooldown_until = None
        
        # Update success rate
        history = self.performance_history[scraper_name]
        history.append({
            'success': True,
            'duration': duration,
            'timestamp': config.last_success
        })
        
        # Keep only last 50 attempts
        if len(history) > 50:
            history.pop(0)
        
        # Calculate success rate
        recent_attempts = history[-20:]  # Last 20 attempts
        successes = sum(1 for attempt in recent_attempts if attempt['success'])
        config.success_rate = successes / len(recent_attempts) if recent_attempts else 0
        
        # Broadcast success
        self._broadcast_scraper_event('scraper_success', {
            'scraper': scraper_name,
            'duration': duration,
            'success_rate': config.success_rate
        })
    
    def _record_failure(self, scraper_name: str, error: str):
        """Record failed scrape"""
        config = self.scraper_configs[scraper_name]
        
        # Update config
        config.last_failure = int(time.time() * 1000)
        config.consecutive_failures += 1
        
        # Check if should disable temporarily
        if config.consecutive_failures >= config.max_failures:
            config.cooldown_until = int(time.time() * 1000) + (config.consecutive_failures * 300000)  # 5 min * failures
            self.logger.warning('scraper_manager', f'Scraper {scraper_name} disabled due to consecutive failures')
        
        # Update performance history
        history = self.performance_history[scraper_name]
        history.append({
            'success': False,
            'error': error,
            'timestamp': config.last_failure
        })
        
        # Keep only last 50 attempts
        if len(history) > 50:
            history.pop(0)
        
        # Update success rate
        recent_attempts = history[-20:]  # Last 20 attempts
        successes = sum(1 for attempt in recent_attempts if attempt['success'])
        config.success_rate = successes / len(recent_attempts) if recent_attempts else 0
        
        # Broadcast failure
        self._broadcast_scraper_event('scraper_failure', {
            'scraper': scraper_name,
            'error': error,
            'consecutive_failures': config.consecutive_failures,
            'cooldown_until': config.cooldown_until
        })
    
    def _get_from_cache(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """Get cached result if not expired"""
        if cache_key not in self.match_detection_cache:
            return None
        
        cached = self.match_detection_cache[cache_key]
        if time.time() - cached['timestamp'] > self.cache_expiry:
            del self.match_detection_cache[cache_key]
            return None
        
        return cached['data']
    
    def _cache_result(self, cache_key: str, data: Dict[str, Any]):
        """Cache scrape result"""
        self.match_detection_cache[cache_key] = {
            'data': data,
            'timestamp': time.time()
        }
    
    def test_scraper(self, scraper_name: str, test_match: Dict[str, Any]) -> Dict[str, Any]:
        """
        Test a specific scraper
        
        Args:
            scraper_name: Name of scraper to test
            test_match: Test match data
            
        Returns:
            Test result
        """
        if scraper_name not in self.scraper_configs:
            return {'success': False, 'error': 'Scraper not found'}
        
        config = self.scraper_configs[scraper_name]
        original_enabled = config.enabled
        
        try:
            # Temporarily enable for testing
            config.enabled = True
            config.status = ScraperStatus.TESTING
            
            self.logger.info('scraper_manager', f'Testing scraper: {scraper_name}')
            
            # Run test
            start_time = time.time()
            result = self._scrape_with_scraper(
                scraper_name,
                test_match.get('matchId', ''),
                test_match.get('teamA', ''),
                test_match.get('teamB', ''),
                test_match.get('sport', 'cricket')
            )
            duration = time.time() - start_time
            
            # Restore original state
            config.enabled = original_enabled
            
            if result:
                return {
                    'success': True,
                    'result': result,
                    'duration': duration,
                    'scraper': scraper_name
                }
            else:
                return {
                    'success': False,
                    'error': 'No data returned',
                    'duration': duration,
                    'scraper': scraper_name
                }
                
        except Exception as e:
            # Restore original state
            config.enabled = original_enabled
            return {
                'success': False,
                'error': str(e),
                'scraper': scraper_name
            }
    
    def update_scraper_config(self, scraper_name: str, config_updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update scraper configuration"""
        if scraper_name not in self.scraper_configs:
            return {'success': False, 'error': 'Scraper not found'}
        
        config = self.scraper_configs[scraper_name]
        
        if 'enabled' in config_updates:
            config.enabled = config_updates['enabled']
        
        if 'priority' in config_updates:
            config.priority = config_updates['priority']
        
        if 'max_failures' in config_updates:
            config.max_failures = config_updates['max_failures']
        
        # Reset cooldown if enabling
        if config_updates.get('enabled', False):
            config.cooldown_until = None
            config.consecutive_failures = 0
        
        self._save_scraper_configs()
        
        self.logger.info('scraper_manager', f'Updated config for {scraper_name}')
        
        return {'success': True, 'scraper': scraper_name, 'config': config_updates}
    
    def _save_scraper_configs(self):
        """Save scraper configurations to Firebase"""
        config_data = {}
        for name, config in self.scraper_configs.items():
            config_data[name] = {
                'enabled': config.enabled,
                'priority': config.priority,
                'success_rate': config.success_rate,
                'last_success': config.last_success,
                'last_failure': config.last_failure,
                'consecutive_failures': config.consecutive_failures,
                'cooldown_until': config.cooldown_until
            }
        
        self.client.set('automation_config/scraper_configs', config_data)
    
    def _broadcast_scraper_event(self, event_type: str, data: Dict[str, Any]):
        """Broadcast scraper event via WebSocket"""
        message = {
            'type': 'scraper_event',
            'eventType': event_type,
            'data': data,
            'timestamp': int(time.time() * 1000)
        }
        
        self.logger.broadcast('scraper_manager', json.dumps(message))
    
    def get_status(self) -> Dict[str, Any]:
        """Get scraper manager status"""
        return {
            'running': self.running,
            'scrapers': {
                name: {
                    'enabled': config.enabled,
                    'status': 'active' if config.enabled and not config.cooldown_until else 'disabled' if not config.enabled else 'cooldown',
                    'priority': config.priority,
                    'success_rate': config.success_rate,
                    'consecutive_failures': config.consecutive_failures,
                    'cooldown_until': config.cooldown_until,
                    'last_success': config.last_success,
                    'last_failure': config.last_failure
                }
                for name, config in self.scraper_configs.items()
            },
            'cache_size': len(self.match_detection_cache),
            'performance_summary': {
                name: {
                    'total_attempts': len(history),
                    'recent_success_rate': sum(1 for h in history[-10:] if h['success']) / min(len(history), 10) if history else 0
                }
                for name, history in self.performance_history.items()
            }
        }
