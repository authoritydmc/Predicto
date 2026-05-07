"""Run scrapers for live matches"""
import logging
from typing import List, Dict
from datetime import datetime

from automation.matches.live_matches import get_live_matches, update_match_status

logger = logging.getLogger(__name__)

def run_scraper_for_live_matches(firebase_client, scraper_manager) -> int:
    """
    Run scrapers for all live matches
    
    Returns: Number of matches updated
    """
    try:
        # Get all live matches
        live_matches = get_live_matches(firebase_client)
        
        updated_count = 0
        
        for match in live_matches:
            try:
                updated = _update_match_with_scraper(
                    firebase_client, 
                    scraper_manager, 
                    match
                )
                if updated:
                    updated_count += 1
            except Exception as e:
                logger.error(f"Error updating match {match.get('id')}: {e}")
        
        logger.info(f"Updated {updated_count} matches with scraper data")
        return updated_count
        
    except Exception as e:
        logger.error(f"Error running scraper for live matches: {e}")
        return 0

def _update_match_with_scraper(firebase_client, scraper_manager, match: Dict) -> bool:
    """Update a single match with scraper data"""
    try:
        sport = match.get('sport', 'cricket')
        team1 = match.get('team1', '')
        team2 = match.get('team2', '')
        
        # Run scraper
        if sport == 'cricket':
            scraper_data = scraper_manager.get_cricket_score(team1, team2)
        elif sport == 'football':
            scraper_data = scraper_manager.get_football_score(team1, team2)
        else:
            logger.warning(f"Unknown sport: {sport}")
            return False
        
        if not scraper_data:
            logger.warning(f"No scraper data for {team1} vs {team2}")
            return False
        
        # Update match with scraper data
        updates = {
            'live_score': scraper_data,
            'updated_at': datetime.utcnow().isoformat()
        }
        
        # Update match status based on scraper data
        if 'status' in scraper_data:
            updates['live_score.status'] = scraper_data['status']
        
        # Save to Firebase
        update_match_status(
            firebase_client,
            sport,
            match.get('tournament_id'),
            match.get('id'),
            updates
        )
        
        logger.info(f"Updated match {match.get('id')} with scraper data")
        return True
        
    except Exception as e:
        logger.error(f"Error updating match with scraper: {e}")
        return False
