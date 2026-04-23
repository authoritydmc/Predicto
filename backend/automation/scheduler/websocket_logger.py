"""
WebSocket logger for real-time logging to Control Panel
"""

import json
import socket
import threading
from typing import Optional, Dict, Any
from datetime import datetime


class WebSocketLogger:
    """Sends log messages to WebSocket server for real-time display"""
    
    def __init__(self, host: str = 'localhost', port: int = 9222):
        """
        Initialize WebSocket logger
        
        Args:
            host: WebSocket server host
            port: WebSocket server port
        """
        self.host = host
        self.port = port
        self.enabled = True
    
    def log(self, level: str, source: str, message: str, extra: Optional[Dict[str, Any]] = None):
        """
        Send log message to WebSocket server
        
        Args:
            level: Log level (info, error, warning, debug)
            source: Source of the log (scheduler, cricket_calculator, etc.)
            message: Log message
            extra: Additional data to include
        """
        if not self.enabled:
            return
        
        log_data = {
            'level': level,
            'source': source,
            'message': message,
            'timestamp': int(datetime.now().timestamp() * 1000)
        }
        
        if extra:
            log_data.update(extra)
        
        # Send in separate thread to avoid blocking
        thread = threading.Thread(target=self._send_log, args=(log_data,))
        thread.daemon = True
        thread.start()
    
    def _send_log(self, log_data: Dict[str, Any]):
        """Send log data to WebSocket server"""
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(1)  # Short timeout
            sock.connect((self.host, self.port))
            sock.sendall(json.dumps(log_data).encode('utf-8'))
            sock.close()
        except (socket.error, ConnectionRefusedError, socket.timeout):
            # WebSocket server not available - silently fail
            self.enabled = False
    
    def info(self, source: str, message: str, extra: Optional[Dict[str, Any]] = None):
        """Log info message"""
        self.log('info', source, message, extra)
    
    def error(self, source: str, message: str, extra: Optional[Dict[str, Any]] = None):
        """Log error message"""
        self.log('error', source, message, extra)
    
    def warning(self, source: str, message: str, extra: Optional[Dict[str, Any]] = None):
        """Log warning message"""
        self.log('warning', source, message, extra)
    
    def debug(self, source: str, message: str, extra: Optional[Dict[str, Any]] = None):
        """Log debug message"""
        self.log('debug', source, message, extra)
