"""
Entry point for cricket score calculator
Can be run standalone or triggered by scheduler
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from base.firebase_client import FirebaseClient
from base.prediction_fetcher import PredictionFetcher
from base.result_processor import ResultProcessor
from cricket.cricket_calculator import CricketCalculator


def main():
    """Main entry point for cricket score calculation"""
    print("[Cricket Calculator] Starting...")
    
    # Initialize Firebase client
    try:
        firebase_client = FirebaseClient()
    except Exception as e:
        print(f"[Cricket Calculator] Error initializing Firebase: {e}")
        sys.exit(1)
    
    # Initialize cricket calculator
    calculator = CricketCalculator()
    
    # Initialize result processor
    processor = ResultProcessor(firebase_client, calculator)
    
    # Get all cricket tournaments
    print("[Cricket Calculator] Fetching cricket tournaments...")
    tournaments = firebase_client.get('cricket')
    
    if not tournaments:
        print("[Cricket Calculator] No cricket tournaments found")
        sys.exit(0)
    
    total_processed = 0
    total_matches = 0
    
    # Process each tournament
    for tournament_id, tournament_data in tournaments.items():
        if not isinstance(tournament_data, dict):
            continue
        
        matches = tournament_data.get('matches', {})
        if not matches:
            continue
        
        print(f"[Cricket Calculator] Processing tournament: {tournament_id}")
        
        # Process each match
        for match_id, match_data in matches.items():
            if not isinstance(match_data, dict):
                continue
            
            # Check if match has meta and is not reconciled
            meta = match_data.get('meta', {})
            if not meta:
                continue
            
            # Skip if already reconciled
            if meta.get('reconciled', False):
                continue
            
            # Skip if match is not completed
            status = meta.get('status', '')
            if status not in ['done', 'completed']:
                continue
            
            print(f"[Cricket Calculator] Processing match: {match_id}")
            
            try:
                result = processor.process_match('cricket', tournament_id, match_id)
                if result.get('success'):
                    total_processed += result.get('processed', 0)
                    print(f"[Cricket Calculator] Match {match_id} processed: {result.get('processed')} predictions")
                else:
                    print(f"[Cricket Calculator] Match {match_id} failed: {result.get('error')}")
            except Exception as e:
                print(f"[Cricket Calculator] Error processing match {match_id}: {e}")
            
            total_matches += 1
    
    print(f"[Cricket Calculator] Completed. Processed {total_processed} predictions from {total_matches} matches")
    sys.exit(0)


if __name__ == '__main__':
    main()
