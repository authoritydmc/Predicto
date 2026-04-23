"""
Main entry point for the scheduler
Run this to start the automation scheduler
"""

import os
import sys
from automation.base.firebase_client import FirebaseClient
from automation.scheduler.scheduler import Scheduler
from automation.scheduler.websocket_logger import WebSocketLogger


def main():
    """Main entry point"""
    # Initialize Firebase client
    firebase_client = FirebaseClient()
    
    # Initialize WebSocket logger
    logger = WebSocketLogger(host='localhost', port=9222)
    
    # Initialize scheduler
    scheduler = Scheduler(firebase_client, logger)
    
    # Load tasks from Firebase
    scheduler.load_tasks_from_firebase()
    
    # Start scheduler loop
    logger.info('scheduler', 'Starting automation scheduler')
    try:
        scheduler.start()
    except KeyboardInterrupt:
        logger.info('scheduler', 'Scheduler stopped')
        scheduler.stop()


if __name__ == '__main__':
    main()
