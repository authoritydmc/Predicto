#!/usr/bin/env python3
"""
Reconciliation Helper Script
Handles early prediction migration and reconciliation tasks
Can be run standalone or triggered by automation system
"""

import sys
import os
import json
import time
import argparse
from typing import Dict, Any, List, Optional
from datetime import datetime

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from base.firebase_client import FirebaseClient
from scheduler.websocket_logger import WebSocketLogger


class ReconciliationHelper:
    """
    Helper class for prediction reconciliation and migration
    """
    
    def __init__(self, firebase_client: FirebaseClient, logger: WebSocketLogger):
        self.client = firebase_client
        self.logger = logger
        
    def migrate_early_predictions(self, sport: str, tournament_id: str, match_id: str) -> Dict[str, Any]:
        """
        Migrate early predictions to live predictions for a specific match
        
        Args:
            sport: Sport type
            tournament_id: Tournament ID  
            match_id: Match ID
            
        Returns:
            Migration results
        """
        try:
            self.logger.info('reconciliation_helper', f'Starting early prediction migration for {sport}/{tournament_id}/{match_id}')
            
            # Get match metadata to check status and batting team
            match_meta = self.client.get(f"prod/tournaments/{sport}/{tournament_id}/matches/{match_id}/meta")
            if not match_meta:
                self.logger.error('reconciliation_helper', f'No metadata found for match {match_id}')
                return {'success': False, 'error': 'Match metadata not found'}
            
            current_status = match_meta.get('status', '')
            batting_first = match_meta.get('battingFirst')
            
            if current_status != 'live' or not batting_first:
                self.logger.info('reconciliation_helper', f'Match {match_id} not live or no battingFirst, skipping migration')
                return {'success': True, 'migrated': 0, 'message': 'No migration needed'}
            
            # Get all predictions for this match
            predictions_path = f"prod/tournaments/{sport}/{tournament_id}/matches/{match_id}/predictions"
            all_predictions = self.client.get(predictions_path) or {}
            
            migrated_count = 0
            migration_results = []
            
            for username, prediction_data in all_predictions.items():
                if isinstance(prediction_data, dict) and 'early_predict' in prediction_data:
                    early_pred = prediction_data['early_predict']
                    
                    # Check if early prediction needs migration
                    if early_pred.get('first') and not early_pred.get('migrated', False):
                        self.logger.info('reconciliation_helper', f'Migrating early prediction for user: {username}')
                        
                        # Extract correct runs based on actual batting team
                        first_innings = early_pred['first'].get('first_innings', {})
                        actual_runs = None
                        
                        if batting_first == 'teamA':
                            actual_runs = first_innings.get('teamA_batting_first')
                        elif batting_first == 'teamB':
                            actual_runs = first_innings.get('teamB_batting_first')
                        
                        if actual_runs:
                            # Create live prediction structure
                            live_prediction = {
                                'predictionId': early_pred['first'].get('predictionId', int(time.time() * 1000)),
                                'winnerTeam': early_pred['first'].get('winnerTeam'),
                                'runs': actual_runs,
                                'battingFirst': batting_first,
                                'migratedFrom': 'early_prediction',
                                'createdAt': early_pred['first'].get('createdAt'),
                                'updatedAt': int(time.time() * 1000)
                            }
                            
                            # Update prediction with migrated live data
                            update_path = f"{predictions_path}/{username}"
                            update_data = {
                                'first_inn': live_prediction,
                                'early_predict.migrated': True,
                                'early_predict.migratedAt': int(time.time() * 1000),
                                'early_predict.migratedTo': 'first_inn',
                                'updatedAt': int(time.time() * 1000)
                            }
                            
                            self.client.update(update_path, update_data)
                            migrated_count += 1
                            
                            migration_results.append({
                                'username': username,
                                'success': True,
                                'actual_runs': actual_runs,
                                'batting_first': batting_first
                            })
                            
                            self.logger.info('reconciliation_helper', f'Successfully migrated early prediction for {username}: {actual_runs} runs')
                        else:
                            self.logger.warning('reconciliation_helper', f'Could not extract runs for early prediction migration: {username}')
                            migration_results.append({
                                'username': username,
                                'success': False,
                                'error': 'Could not extract runs'
                            })
            
            # Log migration summary
            self.logger.info('reconciliation_helper', f'Migration summary: {migrated_count} predictions migrated for match {match_id}')
            
            # Store migration event in Firebase
            migration_event = {
                'type': 'early_prediction_migration',
                'sport': sport,
                'tournament_id': tournament_id,
                'match_id': match_id,
                'timestamp': int(time.time() * 1000),
                'migrated_count': migrated_count,
                'results': migration_results
            }
            
            self.client.set('automation_events/migrations', migration_event)
            
            return {
                'success': True,
                'migrated': migrated_count,
                'total_processed': len(all_predictions),
                'results': migration_results
            }
            
        except Exception as e:
            self.logger.error('reconciliation_helper', f'Error during migration: {str(e)}')
            return {'success': False, 'error': str(e)}
    
    def reconcile_match_predictions(self, sport: str, tournament_id: str, match_id: str, 
                              force: bool = False) -> Dict[str, Any]:
        """
        Trigger reconciliation for a specific match
        
        Args:
            sport: Sport type
            tournament_id: Tournament ID
            match_id: Match ID
            force: Force reconciliation even if already done
            
        Returns:
            Reconciliation result
        """
        try:
            self.logger.info('reconciliation_helper', f'Starting reconciliation for {sport}/{tournament_id}/{match_id}')
            
            # Run the scoring calculator
            scoring_script = os.path.join(os.path.dirname(__file__), '..', 'automation', 'cricket', 'run_calculator.py')
            cmd = [
                sys.executable,
                scoring_script,
                '--tournament', tournament_id,
                '--match', match_id,
                '--innings', 'both',
                '--env', 'prod'
            ]
            
            if force:
                cmd.append('--force')
            
            self.logger.info('reconciliation_helper', f'Executing: {" ".join(cmd)}')
            
            result = subprocess.run(
                cmd,
                cwd=os.path.join(os.path.dirname(__file__), '..', 'automation'),
                capture_output=True,
                text=True,
                timeout=300  # 5 minutes
            )
            
            if result.returncode == 0:
                self.logger.info('reconciliation_helper', f'Reconciliation completed successfully for {match_id}')
                return {
                    'success': True,
                    'output': result.stdout[:1000] if result.stdout else '',
                    'command': ' '.join(cmd)
                }
            else:
                self.logger.error('reconciliation_helper', f'Reconciliation failed for {match_id}: {result.stderr[:200] if result.stderr else "Unknown error"}')
                return {
                    'success': False,
                    'error': result.stderr[:200] if result.stderr else 'Reconciliation failed'
                }
                
        except subprocess.TimeoutExpired:
            self.logger.error('reconciliation_helper', f'Reconciliation timed out for {match_id}')
            return {'success': False, 'error': 'Reconciliation timed out'}
        except Exception as e:
            self.logger.error('reconciliation_helper', f'Exception during reconciliation: {str(e)}')
            return {'success': False, 'error': str(e)}
    
    def get_live_matches_for_scraping(self, sport: str = 'cricket') -> List[str]:
        """
        Get all live matches that need scraping
        
        Args:
            sport: Sport type (default: cricket)
            
        Returns:
            List of match IDs in format sport/tournament_id/match_id
        """
        try:
            self.logger.info('reconciliation_helper', f'Getting live matches for {sport}')
            
            # Get all tournaments for the sport
            tournaments = self.client.get(f'prod/tournaments/{sport}') or {}
            
            live_matches = []
            for tournament_id, tournament_data in tournaments.items():
                matches = tournament_data.get('matches', {})
                for match_id, match_data in matches.items():
                    status = match_data.get('status', '')
                    if status in ['live', 'in_progress']:
                        live_matches.append(f"{sport}/{tournament_id}/{match_id}")
            
            self.logger.info('reconciliation_helper', f'Found {len(live_matches)} live matches for {sport}')
            return live_matches
            
        except Exception as e:
            self.logger.error('reconciliation_helper', f'Error getting live matches: {str(e)}')
            return []


def main():
    """Main CLI interface"""
    parser = argparse.ArgumentParser(description='Reconciliation Helper Script')
    parser.add_argument('--action', type=str, choices=['migrate', 'reconcile', 'get-live-matches'], 
                       required=True, help='Action to perform')
    parser.add_argument('--sport', type=str, default='cricket',
                       help='Sport type (default: cricket)')
    parser.add_argument('--tournament', type=str, required=True,
                       help='Tournament ID')
    parser.add_argument('--match', type=str, required=True,
                       help='Match ID')
    parser.add_argument('--force', action='store_true',
                       help='Force operation')
    parser.add_argument('--env', type=str, choices=['local', 'prod'], default='prod',
                       help='Environment mode')
    
    args = parser.parse_args()
    
    try:
        # Initialize Firebase client
        firebase_client = FirebaseClient()
        logger = WebSocketLogger(firebase_client)
        
        # Initialize helper
        helper = ReconciliationHelper(firebase_client, logger)
        
        if args.action == 'migrate':
            result = helper.migrate_early_predictions(
                args.sport, args.tournament, args.match
            )
            print(f"Migration Result: {result}")
            
        elif args.action == 'reconcile':
            result = helper.reconcile_match_predictions(
                args.sport, args.tournament, args.match, args.force
            )
            print(f"Reconciliation Result: {result}")
            
        elif args.action == 'get-live-matches':
            live_matches = helper.get_live_matches_for_scraping(args.sport)
            print(f"Live Matches: {live_matches}")
            
        else:
            parser.print_help()
            
    except Exception as e:
        print(f"Error: {str(e)}")


if __name__ == '__main__':
    main()
