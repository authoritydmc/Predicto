#!/usr/bin/env python
"""Test script for match creation job"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from automation.matches.scheduler import MatchScheduler
from automation.logging_config import setup_logging

logger = setup_logging()
logger.info("="*50)
logger.info("Starting Match Creation Test")
logger.info("="*50)

try:
    from scraper.manager import ScraperManager
    from firebase_manager import FirebaseManager
    
    # Initialize
    fm = FirebaseManager()
    scraper_mgr = ScraperManager()
    
    # Create scheduler
    scheduler = MatchScheduler(fm, scraper_mgr)
    
    # Run match creation
    logger.info("Searching for upcoming matches...")
    scheduled = scheduler.discover_and_schedule(sport='cricket', days_ahead=3)
    
    logger.info(f"Successfully scheduled {scheduled} new matches")
    logger.info("="*50)
    logger.info("Match Creation Test Completed")
    logger.info("="*50)
    
    sys.exit(0)
    
except Exception as e:
    logger.error(f"Test failed: {e}", exc_info=True)
    sys.exit(1)
