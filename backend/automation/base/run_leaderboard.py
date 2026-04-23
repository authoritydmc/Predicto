"""
Entry point for tournament leaderboard updater
Can be run standalone or triggered by scheduler
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from firebase_client import FirebaseClient
from leaderboard_updater import LeaderboardUpdater


def main():
    """Main entry point for leaderboard update"""
    print("[Leaderboard Updater] Starting...")
    
    # Initialize Firebase client
    try:
        firebase_client = FirebaseClient()
    except Exception as e:
        print(f"[Leaderboard Updater] Error initializing Firebase: {e}")
        sys.exit(1)
    
    # Initialize leaderboard updater
    updater = LeaderboardUpdater(firebase_client)
    
    # Update leaderboards for all sports
    sports = ['cricket', 'football']
    total_updated = 0
    
    for sport in sports:
        print(f"[Leaderboard Updater] Processing {sport} tournaments...")
        
        # Get all tournaments for this sport
        tournaments = firebase_client.get(sport)
        
        if not tournaments:
            print(f"[Leaderboard Updater] No {sport} tournaments found")
            continue
        
        # Process each tournament
        for tournament_id, tournament_data in tournaments.items():
            if not isinstance(tournament_data, dict):
                continue
            
            print(f"[Leaderboard Updater] Updating leaderboard for: {sport}/{tournament_id}")
            
            try:
                result = updater.update_tournament_leaderboard(sport, tournament_id)
                if result.get('success'):
                    total_updated += result.get('updated', 0)
                    print(f"[Leaderboard Updater] Tournament {tournament_id} updated: {result.get('updated')} participants")
                else:
                    print(f"[Leaderboard Updater] Tournament {tournament_id} failed: {result.get('error')}")
            except Exception as e:
                print(f"[Leaderboard Updater] Error updating tournament {tournament_id}: {e}")
    
    print(f"[Leaderboard Updater] Completed. Updated {total_updated} tournament leaderboards")
    sys.exit(0)


if __name__ == '__main__':
    main()
