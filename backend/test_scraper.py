#!/usr/bin/env python
"""Test script for scraper job"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from automation.logging_config import setup_logging

logger = setup_logging()
logger.info("="*50)
logger.info("Starting Scraper Test")
logger.info("="*50)

try:
    from automation.scraper.runner import run_scraper_for_live_matches
    from scraper.manager import ScraperManager
    from firebase_manager import FirebaseManager
    
    # Initialize
    fm = FirebaseManager()
    scraper_mgr = ScraperManager()
    
    # Run scraper
    logger.info("Running scraper for live matches...")
    updated = run_scraper_for_live_matches(fm, scraper_mgr)
    
    logger.info(f"Successfully updated {updated} matches")
    logger.info("="*50)
    logger.info("Scraper Test Completed")
    logger.info("="*50)
    
    sys.exit(0)
    
except Exception as e:
    logger.error(f"Test failed: {e}", exc_info=True)
    sys.exit(1)
