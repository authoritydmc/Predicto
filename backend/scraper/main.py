"""
Live Score Scraper - Main Entry Point

CLI interface for the modular scraper.

Usage:
    python -m scraper.main cricket <team_a> <team_b> [options]
    python -m scraper.main cricket --match-url <url>
    
Examples:
    python -m scraper.main cricket DC CSK --sources cricbuzz,google
    python -m scraper.main cricket --match-url https://www.cricbuzz.com/live-cricket-scores/152031/...
    python -m scraper.main cricket MI RCB --api-key cricapi=YOUR_API_KEY
"""

import sys
import json
import argparse
from typing import Optional

from .manager import ScraperManager
from .base import logger, info, error


def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(
        description='Live Score Scraper - Fetch live scores from multiple sources',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  # Fetch cricket score by team names
  python -m scraper.main cricket DC CSK
  
  # Fetch from specific sources (in order)
  python -m scraper.main cricket DC CSK --sources cricbuzz,google
  
  # Fetch from direct match URL
  python -m scraper.main cricket --match-url https://www.cricbuzz.com/live-cricket-scores/152031/...
  
  # Use API key for premium sources
  python -m scraper.main cricket DC CSK --api-key cricapi=YOUR_API_KEY
  
  # List available sources
  python -m scraper.main cricket --list-sources
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
                       help='Direct match URL to scrape (alternative to team names)')
    
    parser.add_argument('--sources', '-s',
                       help='Comma-separated list of sources to try (e.g., cricbuzz,google,cricapi)')
    
    parser.add_argument('--api-key', '-k',
                       help='API key for premium sources (format: source=key, e.g., cricapi=YOUR_KEY)')
    
    parser.add_argument('--match-id', '-i',
                       help='Match identifier (optional)')
    
    parser.add_argument('--list-sources', '-l', action='store_true',
                       help='List available sources for the sport and exit')
    
    parser.add_argument('--verbose', '-v', action='store_true',
                       help='Enable verbose logging')
    
    parser.add_argument('--timeout', '-t', type=int, default=15,
                       help='Request timeout in seconds (default: 15)')
    
    parser.add_argument('--output', '-o', choices=['json', 'pretty'], default='json',
                       help='Output format (default: json)')
    
    return parser.parse_args()


def parse_api_key(api_key_str: str) -> dict:
    """Parse API key string into dict"""
    result = {}
    if not api_key_str:
        return result
    
    # Format: source=key or source1=key1,source2=key2
    pairs = api_key_str.split(',')
    for pair in pairs:
        if '=' in pair:
            source, key = pair.split('=', 1)
            result[source.strip()] = key.strip()
    
    return result


def main():
    """Main entry point"""
    args = parse_args()
    
    # Print header
    info("=" * 50)
    info("Live Score Scraper")
    info("=" * 50)
    
    # Create manager
    sources = args.sources.split(',') if args.sources else None
    api_keys = parse_api_key(args.api_key) if args.api_key else {}
    
    manager = ScraperManager(scraper_order=sources, api_keys=api_keys)
    
    # List sources if requested
    if args.list_sources:
        available = manager.get_available_sources(args.sport)
        info(f"Available sources for {args.sport}:")
        for source in available:
            info(f"  - {source}")
        return 0
    
    # Validate arguments
    if not args.match_url and (not args.team_a or not args.team_b):
        error("Error: Either provide --match-url or both team names")
        return 1
    
    # Fetch score
    result = manager.get_score(
        sport=args.sport,
        team_a=args.team_a,
        team_b=args.team_b,
        match_url=args.match_url,
        match_id=args.match_id
    )
    
    # Output result
    if result:
        if args.output == 'pretty':
            print(json.dumps(result, indent=2))
        else:
            print(json.dumps(result))
        return 0
    else:
        error("Failed to fetch score from all sources")
        error_output = {"error": "Failed to fetch score from all sources", "sport": args.sport}
        print(json.dumps(error_output))
        return 1


if __name__ == '__main__':
    sys.exit(main())
