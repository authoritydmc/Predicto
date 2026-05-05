"""
Status Monitor and WebSocket Integration
Monitors automation status and provides real-time updates to host control app
"""

import json
import time
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from enum import Enum

from ..base.firebase_client import FirebaseClient
from ..scheduler.websocket_logger import WebSocketLogger


class ComponentStatus(Enum):
    RUNNING = "running"
    STOPPED = "stopped"
    ERROR = "error"
    IDLE = "idle"


@dataclass
class AutomationStatus:
    """Overall automation status"""
    orchestrator_running: bool
    total_tasks: int
    running_tasks: int
    error_tasks: int
    last_update: int
    uptime: int


@dataclass
class ComponentHealth:
    """Component health status"""
    name: str
    status: ComponentStatus
    last_heartbeat: int
    error_count: int
    last_error: Optional[str] = None
    metrics: Dict[str, Any] = None

    def __post_init__(self):
        if self.metrics is None:
            self.metrics = {}


class StatusMonitor:
    """
    Monitors automation system status and health
    Provides WebSocket integration for host control app
    """
    
    def __init__(self, firebase_client: FirebaseClient, logger: WebSocketLogger):
        self.client = firebase_client
        self.logger = logger
        self.running = False
        
        # Status tracking
        self.automation_status = AutomationStatus(
            orchestrator_running=False,
            total_tasks=0,
            running_tasks=0,
            error_tasks=0,
            last_update=0,
            uptime=0
        )
        
        # Component health tracking
        self.component_health: Dict[str, ComponentHealth] = {}
        
        # Performance metrics
        self.performance_history: List[Dict[str, Any]] = []
        self.max_history_size = 1000
        
        # Alert thresholds
        self.alert_thresholds = self._load_alert_thresholds()
        
        # Start time
        self.start_time = int(time.time() * 1000)
    
    def _load_alert_thresholds(self) -> Dict[str, Any]:
        """Load alert thresholds from Firebase"""
        thresholds = self.client.get('automation_config/alert_thresholds') or {}
        
        defaults = {
            'max_error_rate': 0.2,  # 20% error rate
            'max_response_time': 30000,  # 30 seconds
            'min_success_rate': 0.8,  # 80% success rate
            'max_consecutive_failures': 5,
            'heartbeat_timeout': 60000  # 1 minute
        }
        
        return {**defaults, **thresholds}
    
    def start(self):
        """Start the status monitor"""
        self.running = True
        self.automation_status.orchestrator_running = True
        self.start_time = int(time.time() * 1000)
        
        self.logger.info('status_monitor', 'Status monitor started')
        
        # Initialize component health
        self._initialize_component_health()
        
        # Start monitoring loop
        self._monitoring_loop()
    
    def stop(self):
        """Stop the status monitor"""
        self.running = False
        self.automation_status.orchestrator_running = False
        
        self.logger.info('status_monitor', 'Status monitor stopped')
    
    def _initialize_component_health(self):
        """Initialize component health tracking"""
        components = ['match_manager', 'scraper_manager', 'scoring_engine', 'status_monitor']
        
        for component in components:
            self.component_health[component] = ComponentHealth(
                name=component,
                status=ComponentStatus.RUNNING,
                last_heartbeat=int(time.time() * 1000),
                error_count=0
            )
    
    def _monitoring_loop(self):
        """Main monitoring loop"""
        while self.running:
            try:
                # Update uptime
                self.automation_status.uptime = int(time.time() * 1000) - self.start_time
                
                # Check component health
                self._check_component_health()
                
                # Collect performance metrics
                self._collect_performance_metrics()
                
                # Check for alerts
                self._check_alerts()
                
                # Broadcast status update
                self._broadcast_status_update()
                
                # Sleep
                time.sleep(30)  # Update every 30 seconds
                
            except Exception as e:
                self.logger.error('status_monitor', f'Monitoring loop error: {str(e)}')
                time.sleep(10)
    
    def update_automation_status(self, tasks: Dict[str, Any]):
        """Update automation status from orchestrator"""
        total_tasks = len(tasks)
        running_tasks = len([t for t in tasks.values() if t.get('status') == 'running'])
        error_tasks = len([t for t in tasks.values() if t.get('status') == 'error'])
        
        self.automation_status.total_tasks = total_tasks
        self.automation_status.running_tasks = running_tasks
        self.automation_status.error_tasks = error_tasks
        self.automation_status.last_update = int(time.time() * 1000)
    
    def update_component_status(self, component_name: str, status: ComponentStatus, 
                               metrics: Dict[str, Any] = None, error: str = None):
        """Update individual component status"""
        if component_name not in self.component_health:
            self.component_health[component_name] = ComponentHealth(
                name=component_name,
                status=status,
                last_heartbeat=int(time.time() * 1000),
                error_count=0
            )
        
        component = self.component_health[component_name]
        component.status = status
        component.last_heartbeat = int(time.time() * 1000)
        
        if metrics:
            component.metrics.update(metrics)
        
        if error and status == ComponentStatus.ERROR:
            component.error_count += 1
            component.last_error = error
        elif status == ComponentStatus.RUNNING:
            component.error_count = 0  # Reset error count on recovery
        
        # Broadcast component status change
        self._broadcast_component_status(component)
    
    def _check_component_health(self):
        """Check health of all components"""
        current_time = int(time.time() * 1000)
        heartbeat_timeout = self.alert_thresholds.get('heartbeat_timeout', 60000)
        
        for component_name, component in self.component_health.items():
            # Check heartbeat timeout
            if current_time - component.last_heartbeat > heartbeat_timeout:
                if component.status != ComponentStatus.ERROR:
                    component.status = ComponentStatus.ERROR
                    component.last_error = f"Heartbeat timeout ({heartbeat_timeout}ms)"
                    component.error_count += 1
                    
                    self.logger.warning('status_monitor', f'Component {component_name} heartbeat timeout')
                    self._broadcast_component_status(component)
            
            # Check error thresholds
            if component.error_count >= self.alert_thresholds.get('max_consecutive_failures', 5):
                self._trigger_alert('component_error', {
                    'component': component_name,
                    'error_count': component.error_count,
                    'last_error': component.last_error
                })
    
    def _collect_performance_metrics(self):
        """Collect performance metrics"""
        current_time = int(time.time() * 1000)
        
        metrics = {
            'timestamp': current_time,
            'uptime': self.automation_status.uptime,
            'total_tasks': self.automation_status.total_tasks,
            'running_tasks': self.automation_status.running_tasks,
            'error_tasks': self.automation_status.error_tasks,
            'component_health': {
                name: {
                    'status': component.status.value,
                    'error_count': component.error_count,
                    'last_heartbeat': component.last_heartbeat,
                    'metrics': component.metrics
                }
                for name, component in self.component_health.items()
            }
        }
        
        # Add to history
        self.performance_history.append(metrics)
        
        # Trim history
        if len(self.performance_history) > self.max_history_size:
            self.performance_history.pop(0)
    
    def _check_alerts(self):
        """Check for alert conditions"""
        # Check error rate
        if self.automation_status.total_tasks > 0:
            error_rate = self.automation_status.error_tasks / self.automation_status.total_tasks
            if error_rate > self.alert_thresholds.get('max_error_rate', 0.2):
                self._trigger_alert('high_error_rate', {
                    'error_rate': error_rate,
                    'error_tasks': self.automation_status.error_tasks,
                    'total_tasks': self.automation_status.total_tasks
                })
        
        # Check component-specific metrics
        for component_name, component in self.component_health.items():
            # Check scraper success rate
            if component_name == 'scraper_manager':
                success_rate = component.metrics.get('success_rate', 1.0)
                if success_rate < self.alert_thresholds.get('min_success_rate', 0.8):
                    self._trigger_alert('low_success_rate', {
                        'component': component_name,
                        'success_rate': success_rate
                    })
    
    def _trigger_alert(self, alert_type: str, data: Dict[str, Any]):
        """Trigger an alert"""
        alert = {
            'type': alert_type,
            'data': data,
            'timestamp': int(time.time() * 1000),
            'severity': self._get_alert_severity(alert_type)
        }
        
        self.logger.warning('status_monitor', f'Alert triggered: {alert_type} - {data}')
        
        # Broadcast alert
        self._broadcast_alert(alert)
        
        # Save to Firebase
        self._save_alert(alert)
    
    def _get_alert_severity(self, alert_type: str) -> str:
        """Get alert severity level"""
        severity_map = {
            'high_error_rate': 'high',
            'component_error': 'high',
            'low_success_rate': 'medium',
            'heartbeat_timeout': 'medium'
        }
        return severity_map.get(alert_type, 'medium')
    
    def _broadcast_status_update(self):
        """Broadcast overall status update"""
        status_data = {
            'automation_status': asdict(self.automation_status),
            'component_health': {
                name: asdict(component) 
                for name, component in self.component_health.items()
            },
            'timestamp': int(time.time() * 1000)
        }
        
        message = {
            'type': 'status_update',
            'data': status_data,
            'timestamp': int(time.time() * 1000)
        }
        
        self.logger.broadcast('status_monitor', json.dumps(message))
    
    def _broadcast_component_status(self, component: ComponentHealth):
        """Broadcast component status change"""
        message = {
            'type': 'component_status',
            'data': asdict(component),
            'timestamp': int(time.time() * 1000)
        }
        
        self.logger.broadcast('status_monitor', json.dumps(message))
    
    def _broadcast_alert(self, alert: Dict[str, Any]):
        """Broadcast alert"""
        message = {
            'type': 'alert',
            'data': alert,
            'timestamp': int(time.time() * 1000)
        }
        
        self.logger.broadcast('status_monitor', json.dumps(message))
    
    def _save_alert(self, alert: Dict[str, Any]):
        """Save alert to Firebase"""
        alerts_path = f"automation_alerts/{alert['timestamp']}"
        self.client.set(alerts_path, alert)
    
    def get_status(self) -> Dict[str, Any]:
        """Get current status"""
        return {
            'running': self.running,
            'automation_status': asdict(self.automation_status),
            'component_health': {
                name: asdict(component) 
                for name, component in self.component_health.items()
            },
            'performance_summary': self._get_performance_summary(),
            'recent_alerts': self._get_recent_alerts(),
            'alert_thresholds': self.alert_thresholds
        }
    
    def _get_performance_summary(self) -> Dict[str, Any]:
        """Get performance summary from recent history"""
        if not self.performance_history:
            return {}
        
        # Get last hour of data
        one_hour_ago = int(time.time() * 1000) - 3600000
        recent_data = [m for m in self.performance_history if m['timestamp'] > one_hour_ago]
        
        if not recent_data:
            return {}
        
        # Calculate averages
        avg_running_tasks = sum(m['running_tasks'] for m in recent_data) / len(recent_data)
        avg_error_tasks = sum(m['error_tasks'] for m in recent_data) / len(recent_data)
        
        return {
            'period': '1 hour',
            'data_points': len(recent_data),
            'avg_running_tasks': round(avg_running_tasks, 2),
            'avg_error_tasks': round(avg_error_tasks, 2),
            'peak_running_tasks': max(m['running_tasks'] for m in recent_data),
            'peak_error_tasks': max(m['error_tasks'] for m in recent_data)
        }
    
    def _get_recent_alerts(self) -> List[Dict[str, Any]]:
        """Get recent alerts from Firebase"""
        alerts = self.client.get('automation_alerts') or {}
        
        # Get alerts from last 24 hours
        one_day_ago = int(time.time() * 1000) - 86400000
        recent_alerts = [
            {**alert, 'timestamp': int(timestamp)}
            for timestamp, alert in alerts.items()
            if int(timestamp) > one_day_ago
        ]
        
        # Sort by timestamp (newest first)
        recent_alerts.sort(key=lambda a: a['timestamp'], reverse=True)
        
        return recent_alerts[:50]  # Return last 50 alerts
    
    def get_detailed_metrics(self, component: str = None) -> Dict[str, Any]:
        """Get detailed metrics for a component or all components"""
        if component:
            if component not in self.component_health:
                return {}
            
            comp_health = self.component_health[component]
            component_history = [
                m for m in self.performance_history
                if 'component_health' in m and component in m['component_health']
            ]
            
            return {
                'component': component,
                'current_status': asdict(comp_health),
                'history': component_history[-100:],  # Last 100 data points
                'performance_trends': self._calculate_trends(component_history)
            }
        else:
            return {
                'all_components': {
                    name: self.get_detailed_metrics(name)
                    for name in self.component_health.keys()
                }
            }
    
    def _calculate_trends(self, history: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate performance trends from history"""
        if len(history) < 2:
            return {}
        
        # Simple trend calculation
        recent = history[-10:]  # Last 10 data points
        older = history[-20:-10] if len(history) >= 20 else history[:-10]
        
        if not older:
            return {}
        
        # Calculate averages
        recent_avg_errors = sum(m['error_tasks'] for m in recent) / len(recent)
        older_avg_errors = sum(m['error_tasks'] for m in older) / len(older)
        
        error_trend = 'increasing' if recent_avg_errors > older_avg_errors else 'decreasing' if recent_avg_errors < older_avg_errors else 'stable'
        
        return {
            'error_trend': error_trend,
            'recent_avg_errors': round(recent_avg_errors, 2),
            'older_avg_errors': round(older_avg_errors, 2),
            'data_points': len(recent)
        }
