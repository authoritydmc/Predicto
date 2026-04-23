"""
Entry point for football score calculator
Can be run standalone or triggered by scheduler
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from base.firebase_client import FirebaseClient
from base.prediction_fetcher import PredictionFetcher
from base.result_processor import ResultProcessor
from football.football_calculator import FootballCalculator


def main():
    """Main entry point for football score calculation"""
    print("[Football Calculator] Starting...")
    
    # Initialize Firebase client
    try:
        firebase_client = FirebaseClient()
    except Exception as e:
        print(f"[Football Calculator] Error initializing Firebase: {e}")
        sys.exit(1)
    
    # Initialize football calculator
    calculator = FootballCalculator()
    
    # Initialize result processor
    processor = ResultProcessor(firebase_client, calculator)
    
    # Get all football tournaments
    print("[Football Calculator] Fetching football tournaments...")
    tournaments = firebase_client.get('football')
    
    if not tournaments:
        print("[Football Calculator] No football tournaments found")
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
        
        print(f"[Football Calculator] Processing tournament: {tournament_id}")
        
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
            
            print(f"[Football Calculator] Processing match: {match_id}")
            
            try:
                result = processor.process_match('football', tournament_id, match_id)
                if result.get('success'):
                    total_processed += result.get('processed', 0)
                    print(f"[Football Calculator] Match {match_id} processed: {result.get('processed')} predictions")
                else:
                    print(f"[Football Calculator] Match {match_id} failed: {result.get('error')}")
            except Exception as e:
                print(f"[Football Calculator] Error processing match {match_id}: {e}")
            
            total_matches += 1
    
    print(f"[Football Calculator] Completed. Processed {total_processed} predictions from {total_matches} matches")
    sys.exit(0)


if __name__ == '__main__':
    main()
