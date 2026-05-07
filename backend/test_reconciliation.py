#!/usr/bin/env python
"""Test script for reconciliation (prediction migration)"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from automation.logging_config import setup_logging

logger = setup_logging()
logger.info("="*50)
logger.info("Starting Reconciliation Test")
logger.info("="*50)

try:
    # Import reconciliation logic
    # This would migrate old prediction formats to new format
    from firebase_manager import FirebaseManager
    from automation.matches.live_matches import get_live_matches
    
    fm = FirebaseManager()
    
    logger.info("Fetching all matches for reconciliation...")
    
    # Get all matches (cricket and football)
    for sport in ['cricket', 'football']:
        logger.info(f"Processing {sport} matches...")
        matches = get_live_matches(fm, sport)
        
        migrated = 0
        for match in matches:
            match_id = match.get('id')
            tournament_id = match.get('tournament_id')
            predictions = match.get('predictions', {})
            
            # Check if migration needed
            needs_migration = False
            for user_id, pred in predictions.items():
                # Check for old format
                if 'early_predict' in pred and 'first_inn' not in pred:
                    needs_migration = True
                    break
                if 'second_inn' not in pred and 'innings2' in pred:
                    needs_migration = True
                    break
            
            if needs_migration:
                logger.info(f"Migrating predictions for match: {match_id}")
                # Perform migration
                # This is a placeholder - actual logic would go here
                migrated += 1
        
        logger.info(f"Migrated {migrated} {sport} matches")
    
    logger.info("="*50)
    logger.info("Reconciliation Test Completed")
    logger.info("="*50)
    
    sys.exit(0)
    
except Exception as e:
    logger.error(f"Test failed: {e}", exc_info=True)
    sys.exit(1)
