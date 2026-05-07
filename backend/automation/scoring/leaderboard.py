"""Leaderboard updater for matches and tournaments"""
import logging
from typing import Dict, List
from datetime import datetime

logger = logging.getLogger(__name__)

class LeaderboardManager:
    """Manages match and tournament leaderboards"""
    
    def __init__(self, firebase_client):
        self.firebase = firebase_client
    
    def update_match_leaderboard(self, sport: str, tournament_id: str, match_id: str) -> bool:
        """Update leaderboard for a specific match"""
        try:
            # Get match results
            results_ref = self.firebase.db.document(
                f"tournaments/{sport}/{tournament_id}/matches/{match_id}"
            ).collection('results')
            
            results = results_ref.stream()
            
            leaderboard = []
            for doc in results:
                data = doc.to_dict()
                leaderboard.append({
                    'userId': doc.id,
                    'total': data.get('total', 0),
                    'p1Score': data.get('p1Score', 0),
                    'p2Score': data.get('p2Score', 0),
                    'penalty': data.get('penalty', 0)
                })
            
            # Sort by total score descending
            leaderboard.sort(key=lambda x: x['total'], reverse=True)
            
            # Add rank
            for i, entry in enumerate(leaderboard, 1):
                entry['rank'] = i
            
            # Save to match document
            match_ref = self.firebase.db.document(
                f"tournaments/{sport}/{tournament_id}/matches/{match_id}"
            )
            
            match_ref.update({
                'leaderboard': leaderboard,
                'leaderboard_updated_at': datetime.utcnow().isoformat()
            })
            
            logger.info(f"Updated match leaderboard for {match_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error updating match leaderboard: {e}")
            return False
    
    def update_tournament_leaderboard(self, sport: str, tournament_id: str) -> bool:
        """Update overall tournament leaderboard"""
        try:
            matches_ref = self.firebase.db.collection(
                f"tournaments/{sport}/{tournament_id}/matches"
            )
            
            # Get all completed matches with calculated scores
            matches = matches_ref.where("score_calculated", "==", True).stream()
            
            # Aggregate scores by user
            user_totals = {}
            
            for match_doc in matches:
                match_id = match_doc.id
                results_ref = matches_ref.document(match_id).collection('results')
                results = results_ref.stream()
                
                for result_doc in results:
                    user_id = result_doc.id
                    data = result_doc.to_dict()
                    
                    if user_id not in user_totals:
                        user_totals[user_id] = {
                            'total': 0,
                            'matches_played': 0,
                            'p1_total': 0,
                            'p2_total': 0,
                            'penalty_total': 0
                        }
                    
                    user_totals[user_id]['total'] += data.get('total', 0)
                    user_totals[user_id]['p1_total'] += data.get('p1Score', 0)
                    user_totals[user_id]['p2_total'] += data.get('p2Score', 0)
                    user_totals[user_id]['penalty_total'] += data.get('penalty', 0)
                    user_totals[user_id]['matches_played'] += 1
            
            # Convert to leaderboard format
            leaderboard = []
            for user_id, totals in user_totals.items():
                leaderboard.append({
                    'userId': user_id,
                    'total': totals['total'],
                    'matchesPlayed': totals['matches_played'],
                    'p1Total': totals['p1_total'],
                    'p2Total': totals['p2_total'],
                    'penaltyTotal': totals['penalty_total']
                })
            
            # Sort by total descending
            leaderboard.sort(key=lambda x: x['total'], reverse=True)
            
            # Add rank
            for i, entry in enumerate(leaderboard, 1):
                entry['rank'] = i
            
            # Save to tournament document
            tournament_ref = self.firebase.db.document(
                f"tournaments/{sport}/{tournament_id}"
            )
            
            tournament_ref.update({
                'leaderboard': leaderboard,
                'leaderboard_updated_at': datetime.utcnow().isoformat()
            })
            
            logger.info(f"Updated tournament leaderboard for {tournament_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error updating tournament leaderboard: {e}")
            return False
    
    def update_all_tournament_leaderboards(self, sport: str = None) -> int:
        """Update all tournament leaderboards"""
        updated = 0
        try:
            sports = [sport] if sport else ['cricket', 'football']
            
            for s in sports:
                tournaments_ref = self.firebase.db.collection(f"tournaments/{s}")
                tournaments = tournaments_ref.stream()
                
                for tour_doc in tournaments:
                    if self.update_tournament_leaderboard(s, tour_doc.id):
                        updated += 1
            
            return updated
            
        except Exception as e:
            logger.error(f"Error updating all leaderboards: {e}")
            return updated
