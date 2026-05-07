#!/usr/bin/env python
"""Test script for score calculator"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from automation.logging_config import setup_logging

logger = setup_logging()
logger.info("="*50)
logger.info("Starting Score Calculator Test")
logger.info("="*50)

try:
    from automation.scoring.calculator import ScoreCalculator
    from firebase_manager import FirebaseManager
    
    # Initialize
    fm = FirebaseManager()
    calculator = ScoreCalculator(fm)
    
    # Get match details from command line or use defaults
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--sport', default='cricket')
    parser.add_argument('--tournament-id', required=True)
    parser.add_argument('--match-id', required=True)
    args = parser.parse_args()
    
    logger.info(f"Calculating scores for match: {args.match_id}")
    logger.info(f"Tournament: {args.tournament_id}, Sport: {args.sport}")
    
    # Calculate scores
    success = calculator.calculate_match_scores(
        args.sport,
        args.tournament_id,
        args.match_id
    )
    
    if success:
        logger.info("Score calculation completed successfully")
    else:
        logger.warning("Score calculation failed or match not ready")
    
    logger.info("="*50)
    logger.info("Score Calculator Test Completed")
    logger.info("="*50)
    
    sys.exit(0 if success else 1)
    
except Exception as e:
    logger.error(f"Test failed: {e}", exc_info=True)
    sys.exit(1)
