"""
Entry point for cricket score calculator
Can be run standalone or triggered by scheduler
"""

import sys
import os
import argparse
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from base.firebase_client import FirebaseClient
from base.prediction_fetcher import PredictionFetcher
from base.result_processor import ResultProcessor
from base.leaderboard_updater import LeaderboardUpdater
from cricket.cricket_calculator import CricketCalculator


def main():
    """Main entry point for cricket score calculation"""
    parser = argparse.ArgumentParser(description='Cricket score calculator')
    parser.add_argument('--tournament', type=str, help='Specific tournament ID to process')
    parser.add_argument('--match', type=str, help='Specific match ID to process')
    args = parser.parse_args()
    
    print("=" * 80)
    print("[Cricket Calculator] Starting...")
    print(f"[Cricket Calculator] Arguments: tournament={args.tournament}, match={args.match}")
    print("=" * 80)
    
    # Initialize Firebase client
    print("[Cricket Calculator] Initializing Firebase client...")
    try:
        firebase_client = FirebaseClient()
        print("[Cricket Calculator] Firebase client initialized successfully")
    except Exception as e:
        print(f"[Cricket Calculator] ERROR initializing Firebase: {e}")
        sys.exit(1)
    
    # Initialize cricket calculator
    print("[Cricket Calculator] Initializing cricket calculator...")
    calculator = CricketCalculator()
    print("[Cricket Calculator] Cricket calculator initialized")
    
    # Initialize result processor
    print("[Cricket Calculator] Initializing result processor...")
    processor = ResultProcessor(firebase_client, calculator)
    print("[Cricket Calculator] Result processor initialized")
    
    # Initialize leaderboard updater
    print("[Cricket Calculator] Initializing leaderboard updater...")
    leaderboard_updater = LeaderboardUpdater(firebase_client)
    print("[Cricket Calculator] Leaderboard updater initialized")
    
    # Get all cricket tournaments
    print("[Cricket Calculator] Fetching cricket tournaments from Firebase...")
    tournaments = firebase_client.get('cricket')
    
    if not tournaments:
        print("[Cricket Calculator] WARNING: No cricket tournaments found")
        sys.exit(0)
    
    print(f"[Cricket Calculator] Found {len(tournaments)} cricket tournament(s)")
    
    total_processed = 0
    total_matches = 0
    tournaments_to_process = []
    
    # Filter tournaments if specific tournament provided
    if args.tournament:
        print(f"[Cricket Calculator] Filtering for specific tournament: {args.tournament}")
        if args.tournament in tournaments:
            tournaments_to_process = [(args.tournament, tournaments[args.tournament])]
            print(f"[Cricket Calculator] Tournament {args.tournament} found")
        else:
            print(f"[Cricket Calculator] ERROR: Tournament {args.tournament} not found")
            sys.exit(1)
    else:
        print("[Cricket Calculator] Processing all tournaments")
        tournaments_to_process = list(tournaments.items())
    
    # Process each tournament
    for tournament_id, tournament_data in tournaments_to_process:
        if not isinstance(tournament_data, dict):
            print(f"[Cricket Calculator] Skipping invalid tournament data for {tournament_id}")
            continue
        
        matches = tournament_data.get('matches', {})
        if not matches:
            print(f"[Cricket Calculator] No matches found in tournament {tournament_id}")
            continue
        
        print(f"[Cricket Calculator] Processing tournament: {tournament_id} ({len(matches)} matches)")
        
        # Filter matches if specific match provided
        matches_to_process = []
        if args.match:
            print(f"[Cricket Calculator] Filtering for specific match: {args.match}")
            if args.match in matches:
                matches_to_process = [(args.match, matches[args.match])]
                print(f"[Cricket Calculator] Match {args.match} found")
            else:
                print(f"[Cricket Calculator] WARNING: Match {args.match} not found in tournament {tournament_id}")
                continue
        else:
            print(f"[Cricket Calculator] Processing all matches in tournament")
            matches_to_process = list(matches.items())
        
        # Process each match
        for match_id, match_data in matches_to_process:
            if not isinstance(match_data, dict):
                print(f"[Cricket Calculator] Skipping invalid match data for {match_id}")
                continue
            
            # Check if match has meta and is not reconciled
            meta = match_data.get('meta', {})
            if not meta:
                print(f"[Cricket Calculator] Skipping match {match_id}: no metadata found")
                continue
            
            # Skip if already reconciled
            if meta.get('reconciled', False):
                print(f"[Cricket Calculator] Skipping match {match_id}: already reconciled")
                continue
            
            # Skip if match is not completed
            status = meta.get('status', '')
            if status not in ['done', 'completed']:
                print(f"[Cricket Calculator] Skipping match {match_id}: not completed (status: {status})")
                continue
            
            print(f"[Cricket Calculator] {'=' * 60}")
            print(f"[Cricket Calculator] Processing match: {match_id}")
            print(f"[Cricket Calculator] Match title: {meta.get('matchTitle', 'N/A')}")
            print(f"[Cricket Calculator] Teams: {meta.get('teamA', 'N/A')} vs {meta.get('teamB', 'N/A')}")
            print(f"[Cricket Calculator] Status: {status}")
            print(f"[Cricket Calculator] {'=' * 60}")
            
            try:
                print(f"[Cricket Calculator] Fetching predictions for match {match_id}...")
                result = processor.process_match('cricket', tournament_id, match_id)
                
                if result.get('success'):
                    processed = result.get('processed', 0)
                    total = result.get('total', 0)
                    total_processed += processed
                    print(f"[Cricket Calculator] SUCCESS: Match {match_id} processed")
                    print(f"[Cricket Calculator] - Predictions processed: {processed}/{total}")
                    
                    # Update tournament leaderboard after processing match
                    print(f"[Cricket Calculator] Updating tournament leaderboard...")
                    leaderboard_result = leaderboard_updater.update_tournament_leaderboard('cricket', tournament_id)
                    if leaderboard_result.get('success'):
                        updated_count = leaderboard_result.get('updated', 0)
                        print(f"[Cricket Calculator] SUCCESS: Leaderboard updated for tournament {tournament_id}")
                        print(f"[Cricket Calculator] - Participants updated: {updated_count}")
                    else:
                        print(f"[Cricket Calculator] WARNING: Leaderboard update failed: {leaderboard_result.get('error')}")
                else:
                    print(f"[Cricket Calculator] ERROR: Match {match_id} processing failed")
                    print(f"[Cricket Calculator] - Error: {result.get('error')}")
            except Exception as e:
                print(f"[Cricket Calculator] ERROR: Exception processing match {match_id}")
                print(f"[Cricket Calculator] - Exception: {str(e)}")
                import traceback
                print(f"[Cricket Calculator] - Traceback: {traceback.format_exc()}")
            
            total_matches += 1
    
    print("=" * 80)
    print(f"[Cricket Calculator] COMPLETED")
    print(f"[Cricket Calculator] - Total matches processed: {total_matches}")
    print(f"[Cricket Calculator] - Total predictions scored: {total_processed}")
    print("=" * 80)
    sys.exit(0)


if __name__ == '__main__':
    main()
