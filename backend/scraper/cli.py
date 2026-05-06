"""
Live Score Scraper CLI Wrapper

Standalone CLI that can be run directly.
"""

import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scraper.manager import ScraperManager
from scraper.base import logger, info, error
import json
import argparse
from typing import Optional


def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(
        description='Live Score Scraper - Fetch live scores from multiple sources',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  # Fetch cricket score by team names
  python cli.py cricket DC CSK
  
  # Fetch from specific sources (in order)
  python cli.py cricket DC CSK --sources cricbuzz,google
  
  # Fetch from direct match URL
  python cli.py cricket --match-url https://www.cricbuzz.com/live-cricket-scores/152031/...
  
  # List available sources
  python cli.py cricket --list-sources
        '''
    )
    
    # Positional arguments
    parser.add_argument('sport', choices=['cricket', 'football'],
                       help='Sport to fetch scores for')
    
    parser.add_argument('team_a', nargs='?',
                       help='First team name/abbreviation')
    
    parser.add_argument('team_b', nargs='?',
                       help='Second team name/abbreviation')
    
    # Optional arguments
    parser.add_argument('--match-url', '-u',
                       help='Direct match URL to scrape')
    
    parser.add_argument('--sources', '-s',
                       help='Comma-separated list of sources to try')
    
    parser.add_argument('--match-id', '-i',
                       help='Match identifier (optional)')
    
    parser.add_argument('--list-sources', '-l', action='store_true',
                       help='List available sources for the sport and exit')
    
    parser.add_argument('--output', '-o', choices=['json', 'pretty'], default='json',
                       help='Output format (default: json)')
    
    return parser.parse_args()


def main():
    """Main entry point"""
    args = parse_args()
    
    # Print header
    info("=" * 50)
    info("Live Score Scraper")
    info("=" * 50)
    
    # Debug: Print all received arguments
    info(f"[DEBUG CLI] Received args: {vars(args)}")
    info(f"[DEBUG CLI] sport: {args.sport}")
    info(f"[DEBUG CLI] team_a: {args.team_a}")
    info(f"[DEBUG CLI] team_b: {args.team_b}")
    info(f"[DEBUG CLI] match_url: {args.match_url}")
    info(f"[DEBUG CLI] sources: {args.sources}")
    
    # Create manager
    sources = args.sources.split(',') if args.sources else None
    manager = ScraperManager(scraper_order=sources)
    
    # List sources if requested
    if args.list_sources:
        available = manager.get_available_sources(args.sport)
        info(f"Available sources for {args.sport}:")
        for source in available:
            info(f"  - {source}")
        return 0
    
    # Validate arguments
    if not args.match_url and (not args.team_a or not args.team_b):
        error("[DEBUG CLI] Validation failed: no match_url and missing team names")
        error("Error: Either provide --match-url or both team names")
        return 1
    
    # Fetch score
    info("[DEBUG CLI] Starting score fetch...")
    result = manager.get_score(
        sport=args.sport,
        team_a=args.team_a,
        team_b=args.team_b,
        match_url=args.match_url,
        match_id=args.match_id
    )
    
    info(f"[DEBUG CLI] Scraper result: {result}")
    
    # Output result
    if result:
        info("[DEBUG CLI] Success - outputting result")
        if args.output == 'pretty':
            print(json.dumps(result, indent=2))
        else:
            print(json.dumps(result))
        return 0
    else:
        error("[DEBUG CLI] Failed to fetch score from all sources")
        error_output = {"error": "Failed to fetch score from all sources", "sport": args.sport}
        print(json.dumps(error_output))
        return 1


if __name__ == '__main__':
    sys.exit(main())
