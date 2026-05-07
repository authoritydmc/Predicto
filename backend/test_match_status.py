#!/usr/bin/env python
"""Test script for match status handler"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from automation.logging_config import setup_logging

logger = setup_logging()
logger.info("="*50)
logger.info("Starting Match Status Handler Test")
logger.info("="*50)

try:
    from automation.matches.live_matches import get_live_matches, update_match_status
    from automation.matches.status_manager import MatchStatusManager
    from firebase_manager import FirebaseManager
    
    # Initialize
    fm = FirebaseManager()
    status_mgr = MatchStatusManager(fm)
    
    # Get live matches
    logger.info("Fetching live matches...")
    matches = get_live_matches(fm, sport='cricket')
    logger.info(f"Found {len(matches)} live matches")
    
    # Process each match
    updated = 0
    for match in matches:
        logger.info(f"Processing match: {match.get('id')}")
        updates = status_mgr.process_match_status(match)
        
        if updates:
            update_match_status(
                fm,
                match.get('sport'),
                match.get('tournament_id'),
                match.get('id'),
                updates
            )
            updated += 1
            logger.info(f"Updated match with: {updates}")
        else:
            logger.info("No status changes needed")
    
    logger.info(f"Successfully processed {updated} matches")
    logger.info("="*50)
    logger.info("Match Status Handler Test Completed")
    logger.info("="*50)
    
    sys.exit(0)
    
except Exception as e:
    logger.error(f"Test failed: {e}", exc_info=True)
    sys.exit(1)
