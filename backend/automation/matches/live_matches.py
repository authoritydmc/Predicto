"""Get all live matches from Firebase"""
import logging
from typing import List, Dict, Optional
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

def get_live_matches(firebase_client, sport: str = "cricket") -> List[Dict]:
    """
    Fetch all live matches from Firebase
    
    Args:
        firebase_client: Firebase client instance
        sport: Sport type (cricket/football)
    
    Returns:
        List of live match objects
    """
    try:
        # Get all tournaments for the sport
        tournaments_ref = firebase_client.db.collection(f"tournaments/{sport}")
        tournaments = tournaments_ref.stream()
        
        live_matches = []
        
        for tournament_doc in tournaments:
            tournament_id = tournament_doc.id
            tournament_data = tournament_doc.to_dict()
            
            # Get matches for this tournament
            matches_ref = tournaments_ref.document(tournament_id).collection("matches")
            
            # Query for live or recently completed matches
            # Consider matches that are:
            # - Status: live, first_innings_live, second_innings_live
            # - Or completed in last 2 hours (for final processing)
            two_hours_ago = datetime.utcnow() - timedelta(hours=2)
            
            matches = matches_ref.where("status", "in", [
                "live", "first_innings_live", "second_innings_live",
                "innings_break", "first_innings_done", "second_innings_done"
            ]).stream()
            
            for match_doc in matches:
                match_data = match_doc.to_dict()
                match_data['id'] = match_doc.id
                match_data['tournament_id'] = tournament_id
                match_data['sport'] = sport
                live_matches.append(match_data)
        
        logger.info(f"Found {len(live_matches)} live matches")
        return live_matches
        
    except Exception as e:
        logger.error(f"Error fetching live matches: {e}")
        return []

def get_match_by_id(firebase_client, sport: str, tournament_id: str, match_id: str) -> Optional[Dict]:
    """Get a specific match by ID"""
    try:
        match_ref = firebase_client.db.document(
            f"tournaments/{sport}/{tournament_id}/matches/{match_id}"
        )
        doc = match_ref.get()
        if doc.exists:
            data = doc.to_dict()
            data['id'] = doc.id
            data['tournament_id'] = tournament_id
            data['sport'] = sport
            return data
        return None
    except Exception as e:
        logger.error(f"Error fetching match {match_id}: {e}")
        return None

def update_match_status(firebase_client, sport: str, tournament_id: str, match_id: str, updates: Dict):
    """Update match status and related fields"""
    try:
        match_ref = firebase_client.db.document(
            f"tournaments/{sport}/{tournament_id}/matches/{match_id}"
        )
        updates['updated_at'] = datetime.utcnow().isoformat()
        match_ref.update(updates)
        logger.info(f"Updated match {match_id} with {updates}")
        return True
    except Exception as e:
        logger.error(f"Error updating match {match_id}: {e}")
        return False
