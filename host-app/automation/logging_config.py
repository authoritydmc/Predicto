"""Centralized logging configuration for automation system"""
import logging
import os
from datetime import datetime
import sys

def setup_logging(
    log_level=logging.INFO,
    log_file='logs/automation.log',
    enable_websocket=False
):
    """
    Setup logging for automation system
    
    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR)
        log_file: Path to log file
        enable_websocket: Whether to enable WebSocket logging
    
    Returns:
        logger instance
    """
    # Create logs directory if not exists
    log_dir = os.path.dirname(log_file)
    if log_dir and not os.path.exists(log_dir):
        os.makedirs(log_dir)
    
    # Root logger
    logger = logging.getLogger('automation')
    logger.setLevel(log_level)
    
    # Clear existing handlers
    logger.handlers.clear()
    
    # Formatter
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(log_level)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # File handler
    if log_file:
        file_handler = logging.FileHandler(log_file)
        file_handler.setLevel(log_level)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    
    # WebSocket handler (optional)
    if enable_websocket:
        try:
            from automation.logging_config import WebSocketLogHandler
            ws_handler = WebSocketLogHandler()
            ws_handler.setLevel(log_level)
            ws_handler.setFormatter(formatter)
            logger.addHandler(ws_handler)
        except ImportError:
            pass  # WebSocket not available
    
    return logger

class WebSocketLogHandler(logging.Handler):
    """Custom logging handler that sends logs via WebSocket"""
    
    def __init__(self):
        super().__init__()
        self.clients = set()
    
    def add_client(self, websocket):
        """Add a WebSocket client"""
        self.clients.add(websocket)
    
    def remove_client(self, websocket):
        """Remove a WebSocket client"""
        self.clients.discard(websocket)
    
    def emit(self, record):
        """Send log record to all connected WebSocket clients"""
        try:
            msg = self.format(record)
            for client in list(self.clients):
                try:
                    # This would need to be async in practice
                    # For now, just store in a buffer
                    pass
                except:
                    self.remove_client(client)
        except:
            self.handleError(record)

def get_logger(name):
    """Get a logger for a specific module"""
    return logging.getLogger(f"automation.{name}")
