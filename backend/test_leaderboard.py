#!/usr/bin/env python
"""Test script for leaderboard update"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from automation.logging_config import setup_logging

logger = setup_logging()
logger.info("="*50)
logger.info("Starting Leaderboard Update Test")
logger.info("="*50)

try:
    from automation.scoring.leaderboard import LeaderboardManager
    from firebase_manager import FirebaseManager
    
    # Initialize
    fm = FirebaseManager()
    lb_manager = LeaderboardManager(fm)
    
    # Get details from command line or use defaults
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--sport', default='cricket')
    parser.add_argument('--tournament-id', required=True)
    parser.add_argument('--all', action='store_true', help='Update all tournaments')
    args = parser.parse_args()
    
    if args.all:
        logger.info("Updating all tournament leaderboards...")
        updated = lb_manager.update_all_tournament_leaderboards(args.sport)
        logger.info(f"Updated {updated} tournament leaderboards")
    else:
        logger.info(f"Updating leaderboard for tournament: {args.tournament_id}")
        success = lb_manager.update_tournament_leaderboard(args.sport, args.tournament_id)
        
        if success:
            logger.info("Leaderboard update completed successfully")
        else:
            logger.warning("Leaderboard update failed")
    
    logger.info("="*50)
    logger.info("Leaderboard Update Test Completed")
    logger.info("="*50)
    
    sys.exit(0)
    
except Exception as e:
    logger.error(f"Test failed: {e}", exc_info=True)
    sys.exit(1)
