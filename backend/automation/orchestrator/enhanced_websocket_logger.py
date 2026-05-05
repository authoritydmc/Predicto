"""
Enhanced WebSocket Logger
Provides structured logging with debug window integration
"""

import json
import time
import socket
import threading
from typing import Dict, Any, Optional, List
from datetime import datetime
from dataclasses import dataclass, asdict
from enum import Enum

try:
    import websocket
    WEBSOCKET_AVAILABLE = True
except ImportError:
    WEBSOCKET_AVAILABLE = False


class LogLevel(Enum):
    DEBUG = "debug"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class LogEntry:
    """Structured log entry"""
    timestamp: int
    level: LogLevel
    component: str
    message: str
    data: Optional[Dict[str, Any]] = None
    thread_id: Optional[str] = None
    correlation_id: Optional[str] = None

    def __post_init__(self):
        if self.data is None:
            self.data = {}


class EnhancedWebSocketLogger:
    """
    Enhanced WebSocket logger with structured logging
    Integrates with host control app debug window
    """
    
    def __init__(self, host: str = 'localhost', port: int = 9222):
        self.host = host
        self.port = port
        self.ws_url = f"ws://{host}:{port}"
        
        # WebSocket connection
        self.ws = None
        self.connected = False
        self.reconnect_attempts = 0
        self.max_reconnect_attempts = 5
        
        # Log buffering
        self.log_buffer: List[LogEntry] = []
        self.max_buffer_size = 1000
        
        # Component registration
        self.registered_components: Dict[str, Dict[str, Any]] = {}
        
        # Debug settings
        self.debug_mode = True
        self.log_levels = {
            LogLevel.DEBUG: True,
            LogLevel.INFO: True,
            LogLevel.WARNING: True,
            LogLevel.ERROR: True,
            LogLevel.CRITICAL: True
        }
        
        # Statistics
        self.stats = {
            'total_logs': 0,
            'logs_by_level': {level.value: 0 for level in LogLevel},
            'logs_by_component': {},
            'connection_attempts': 0,
            'last_connection': None
        }
        
        # Start connection thread
        self.message_handler = None
        self._start_connection_thread()
    
    def _start_connection_thread(self):
        """Start WebSocket connection thread"""
        if WEBSOCKET_AVAILABLE:
            connection_thread = threading.Thread(target=self._connection_loop, daemon=True)
            connection_thread.start()
        else:
            print(f"[WebSocketLogger] WebSocket library not available, using fallback logging")
    
    def _connection_loop(self):
        """WebSocket connection loop with reconnection"""
        while True:
            try:
                if not self.connected:
                    self._connect()
                
                if self.connected and self.ws:
                    # Process any buffered logs
                    self._flush_buffer()
                
                time.sleep(5)  # Check connection every 5 seconds
                
            except Exception as e:
                print(f"[WebSocketLogger] Connection loop error: {e}")
                time.sleep(10)
    
    def _connect(self):
        """Establish WebSocket connection"""
        try:
            self.stats['connection_attempts'] += 1
            
            if WEBSOCKET_AVAILABLE:
                self.ws = websocket.WebSocketApp(
                    self.ws_url,
                    on_open=self._on_open,
                    on_message=self._on_message,
                    on_error=self._on_error,
                    on_close=self._on_close
                )
                
                # Start WebSocket in separate thread
                ws_thread = threading.Thread(target=self.ws.run_forever, daemon=True)
                ws_thread.start()
                
                # Wait for connection
                time.sleep(2)
                
                if self.connected:
                    self.stats['last_connection'] = int(time.time() * 1000)
                    self.reconnect_attempts = 0
                    print(f"[WebSocketLogger] Connected to {self.ws_url}")
            else:
                # Fallback to socket connection
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.connect((self.host, self.port))
                sock.close()
                self.connected = True
                self.stats['last_connection'] = int(time.time() * 1000)
                print(f"[WebSocketLogger] Connected via socket to {self.host}:{self.port}")
                
        except Exception as e:
            print(f"[WebSocketLogger] Connection failed: {e}")
            self.reconnect_attempts += 1
            
            if self.reconnect_attempts >= self.max_reconnect_attempts:
                print(f"[WebSocketLogger] Max reconnection attempts reached")
                time.sleep(60)  # Wait 1 minute before trying again
            else:
                time.sleep(10)  # Wait 10 seconds before retry
    
    def _on_open(self, ws):
        """WebSocket connection opened"""
        self.connected = True
        print("[WebSocketLogger] WebSocket connection opened")
        
        # Send registration message
        self._send_message({
            'type': 'logger_registration',
            'component': 'automation_orchestrator',
            'timestamp': int(time.time() * 1000)
        })
    
    def _on_message(self, ws, message):
        """Handle incoming WebSocket message"""
        try:
            data = json.loads(message)
            
            # Call custom handler if registered
            if self.message_handler:
                self.message_handler(data)
                
            self._handle_control_message(data)
        except Exception as e:
            print(f"[WebSocketLogger] Error parsing message: {e}")
    
    def _on_error(self, ws, error):
        """WebSocket error"""
        print(f"[WebSocketLogger] WebSocket error: {error}")
        self.connected = False
    
    def _on_close(self, ws, close_status_code, close_msg):
        """WebSocket connection closed"""
        print("[WebSocketLogger] WebSocket connection closed")
        self.connected = False
    
    def _handle_control_message(self, data: Dict[str, Any]):
        """Handle control messages from host app"""
        message_type = data.get('type')
        
        if message_type == 'debug_config':
            # Update debug configuration
            self.debug_mode = data.get('debug_mode', True)
            log_levels = data.get('log_levels', {})
            for level_name, enabled in log_levels.items():
                try:
                    level = LogLevel(level_name)
                    self.log_levels[level] = enabled
                except ValueError:
                    pass
        
        elif message_type == 'get_status':
            # Send status response
            self._send_message({
                'type': 'logger_status',
                'data': self.get_status(),
                'timestamp': int(time.time() * 1000)
            })
        
        elif message_type == 'clear_logs':
            # Clear log buffer
            self.log_buffer.clear()
            self._send_message({
                'type': 'logs_cleared',
                'timestamp': int(time.time() * 1000)
            })
    
    def _send_message(self, message: Dict[str, Any]):
        """Send message via WebSocket"""
        if self.connected and self.ws:
            try:
                self.ws.send(json.dumps(message))
            except Exception as e:
                print(f"[WebSocketLogger] Error sending message: {e}")
                self.connected = False
    
    def _flush_buffer(self):
        """Flush buffered logs"""
        if not self.log_buffer:
            return
        
        logs_to_send = self.log_buffer.copy()
        self.log_buffer.clear()
        
        for log_entry in logs_to_send:
            message = {
                'type': 'log_entry',
                'data': asdict(log_entry),
                'timestamp': int(time.time() * 1000)
            }
            self._send_message(message)
    
    def register_component(self, component_name: str, component_info: Dict[str, Any]):
        """Register a component for logging"""
        self.registered_components[component_name] = component_info
        
        message = {
            'type': 'component_registration',
            'component': component_name,
            'info': component_info,
            'timestamp': int(time.time() * 1000)
        }
        
        self._send_message(message)
    
    def log(self, level: LogLevel, component: str, message: str, data: Dict[str, Any] = None, correlation_id: str = None):
        """Log a message"""
        # Check if level is enabled
        if not self.log_levels.get(level, True):
            return
        
        # Create log entry
        log_entry = LogEntry(
            timestamp=int(time.time() * 1000),
            level=level,
            component=component,
            message=message,
            data=data,
            thread_id=str(threading.current_thread().ident),
            correlation_id=correlation_id
        )
        
        # Update statistics
        self.stats['total_logs'] += 1
        self.stats['logs_by_level'][level.value] += 1
        self.stats['logs_by_component'][component] = self.stats['logs_by_component'].get(component, 0) + 1
        
        # Add to buffer or send immediately
        if self.connected:
            message = {
                'type': 'log_entry',
                'data': asdict(log_entry),
                'timestamp': int(time.time() * 1000)
            }
            self._send_message(message)
        else:
            # Buffer for when connection is restored
            self.log_buffer.append(log_entry)
            
            # Trim buffer if too large
            if len(self.log_buffer) > self.max_buffer_size:
                self.log_buffer.pop(0)
        
        # Also print to console for critical errors
        if level in [LogLevel.ERROR, LogLevel.CRITICAL]:
            print(f"[{level.value.upper()}][{component}] {message}")
    
    def debug(self, component: str, message: str, data: Dict[str, Any] = None, correlation_id: str = None):
        """Log debug message"""
        self.log(LogLevel.DEBUG, component, message, data, correlation_id)
    
    def info(self, component: str, message: str, data: Dict[str, Any] = None, correlation_id: str = None):
        """Log info message"""
        self.log(LogLevel.INFO, component, message, data, correlation_id)
    
    def warning(self, component: str, message: str, data: Dict[str, Any] = None, correlation_id: str = None):
        """Log warning message"""
        self.log(LogLevel.WARNING, component, message, data, correlation_id)
    
    def error(self, component: str, message: str, data: Dict[str, Any] = None, correlation_id: str = None):
        """Log error message"""
        self.log(LogLevel.ERROR, component, message, data, correlation_id)
    
    def critical(self, component: str, message: str, data: Dict[str, Any] = None, correlation_id: str = None):
        """Log critical message"""
        self.log(LogLevel.CRITICAL, component, message, data, correlation_id)
    
    def broadcast(self, component: str, message: str):
        """Broadcast raw message (for compatibility)"""
        if self.connected:
            try:
                data = json.loads(message) if message.startswith('{') else {'message': message}
                broadcast_message = {
                    'type': 'broadcast',
                    'component': component,
                    'data': data,
                    'timestamp': int(time.time() * 1000)
                }
                self._send_message(broadcast_message)
            except Exception as e:
                print(f"[WebSocketLogger] Error broadcasting message: {e}")
    
    def get_status(self) -> Dict[str, Any]:
        """Get logger status"""
        return {
            'connected': self.connected,
            'ws_url': self.ws_url,
            'buffer_size': len(self.log_buffer),
            'registered_components': self.registered_components,
            'debug_mode': self.debug_mode,
            'enabled_levels': [level.value for level, enabled in self.log_levels.items() if enabled],
            'statistics': self.stats,
            'reconnect_attempts': self.reconnect_attempts
        }
    
    def get_recent_logs(self, component: str = None, level: LogLevel = None, limit: int = 100) -> List[Dict[str, Any]]:
        """Get recent logs from buffer"""
        logs = self.log_buffer.copy()
        
        # Filter by component
        if component:
            logs = [log for log in logs if log.component == component]
        
        # Filter by level
        if level:
            logs = [log for log in logs if log.level == level]
        
        # Sort by timestamp (newest first) and limit
        logs.sort(key=lambda log: log.timestamp, reverse=True)
        
        return [asdict(log) for log in logs[:limit]]
    
    def clear_logs(self):
        """Clear log buffer"""
        self.log_buffer.clear()
        
        message = {
            'type': 'logs_cleared',
            'timestamp': int(time.time() * 1000)
        }
        self._send_message(message)
    
    def set_debug_mode(self, enabled: bool):
        """Enable/disable debug mode"""
        self.debug_mode = enabled
        
        message = {
            'type': 'debug_mode_changed',
            'enabled': enabled,
            'timestamp': int(time.time() * 1000)
        }
        self._send_message(message)
    
    def set_log_level(self, level: LogLevel, enabled: bool):
        """Enable/disable specific log level"""
        self.log_levels[level] = enabled
        
        message = {
            'type': 'log_level_changed',
            'level': level.value,
            'enabled': enabled,
            'timestamp': int(time.time() * 1000)
        }
        self._send_message(message)
