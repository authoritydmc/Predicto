#!/usr/bin/env python3
"""
Automated Scraper Test Suite

Run this script to test all available scrapers:
    python test_scrapers.py

Or test individual scrapers:
    python test_scrapers.py --scraper cricbuzz
    python test_scrapers.py --scraper google
"""

import sys
import os
import json
import argparse
from typing import Optional

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scraper import ScraperManager, ScraperFactory
from scraper.base import info, error, warn, VERBOSE

# Test data
TEST_TEAMS = [
    ('DC', 'CSK'),
    ('MI', 'RCB'),
    ('KKR', 'SRH'),
]

TEST_URL = 'https://www.cricbuzz.com/live-cricket-scores/152031/dc-vs-csk-48th-match-indian-premier-league-2026'


def test_scraper_creation(sport: str, source: str) -> bool:
    """Test if scraper can be created"""
    try:
        scraper = ScraperFactory.create(sport, source)
        info(f"[TEST] {source}: Created successfully")
        return True
    except Exception as e:
        error(f"[TEST] {source}: Failed to create - {e}")
        return False


def test_cricbuzz_direct_url() -> bool:
    """Test Cricbuzz scraper with direct URL"""
    print("\n" + "="*60)
    info("TEST: Cricbuzz Scraper (Direct URL)")
    print("="*60)
    
    try:
        manager = ScraperManager(['cricbuzz'])
        result = manager.get_score(
            'cricket',
            team_a='DC',
            team_b='CSK',
            match_url=TEST_URL
        )
        
        if result:
            info(f"[PASS] Cricbuzz scraper working!")
            print(f"\nResult:")
            print(json.dumps(result, indent=2))
            return True
        else:
            error(f"[FAIL] Cricbuzz scraper returned no data")
            return False
            
    except Exception as e:
        error(f"[FAIL] Cricbuzz scraper exception: {e}")
        import traceback
        error(traceback.format_exc())
        return False


def test_cricbuzz_team_search() -> bool:
    """Test Cricbuzz scraper by team names"""
    print("\n" + "="*60)
    info("TEST: Cricbuzz Scraper (Team Search)")
    print("="*60)
    
    team_a, team_b = 'DC', 'CSK'
    info(f"Searching for: {team_a} vs {team_b}")
    
    try:
        manager = ScraperManager(['cricbuzz'])
        result = manager.get_score('cricket', team_a=team_a, team_b=team_b)
        
        if result:
            info(f"[PASS] Cricbuzz team search working!")
            return True
        else:
            warn(f"[WARN] Cricbuzz team search returned no data (match may not be live)")
            return False
            
    except Exception as e:
        error(f"[FAIL] Cricbuzz team search exception: {e}")
        return False


def test_google_scraper() -> bool:
    """Test Google scraper"""
    print("\n" + "="*60)
    info("TEST: Google Scraper (Experimental)")
    print("="*60)
    
    try:
        manager = ScraperManager(['google'])
        result = manager.get_score('cricket', team_a='DC', team_b='CSK')
        
        if result:
            info(f"[PASS] Google scraper working!")
            return True
        else:
            warn(f"[WARN] Google scraper returned no data (expected - experimental)")
            return False
            
    except Exception as e:
        error(f"[FAIL] Google scraper exception: {e}")
        return False


def test_cricapi_scraper() -> bool:
    """Test CricAPI scraper"""
    print("\n" + "="*60)
    info("TEST: CricAPI Scraper")
    print("="*60)
    
    # Check for API key
    api_key = os.environ.get('CRICAPI_KEY')
    
    if not api_key:
        warn("[SKIP] CricAPI scraper - No API key found")
        warn("Set CRICAPI_KEY environment variable to test")
        print("Get free API key at: https://www.cricapi.com/")
        return False
    
    try:
        manager = ScraperManager(['cricapi'], api_keys={'cricapi': api_key})
        result = manager.get_score('cricket', team_a='DC', team_b='CSK')
        
        if result:
            info(f"[PASS] CricAPI scraper working!")
            return True
        else:
            warn(f"[WARN] CricAPI scraper returned no data")
            return False
            
    except Exception as e:
        error(f"[FAIL] CricAPI scraper exception: {e}")
        return False


def test_fallback_chain() -> bool:
    """Test scraper fallback chain"""
    print("\n" + "="*60)
    info("TEST: Fallback Chain (cricbuzz -> google -> cricapi)")
    print("="*60)
    
    try:
        manager = ScraperManager(['cricbuzz', 'google', 'cricapi'])
        result = manager.get_score(
            'cricket',
            team_a='DC',
            team_b='CSK',
            match_url=TEST_URL
        )
        
        if result:
            source = result.get('_source', 'unknown')
            info(f"[PASS] Fallback chain working! Used source: {source}")
            return True
        else:
            error(f"[FAIL] All scrapers in fallback chain failed")
            return False
            
    except Exception as e:
        error(f"[FAIL] Fallback chain exception: {e}")
        return False


def list_available_scrapers():
    """List all available scrapers"""
    print("\n" + "="*60)
    info("Available Scrapers")
    print("="*60)
    
    for sport in ['cricket', 'football']:
        sources = ScraperFactory.get_available_sources(sport)
        print(f"\n{sport.upper()}:")
        for source in sources:
            # Try to create each scraper
            can_create = test_scraper_creation(sport, source)
            status = "✓" if can_create else "✗"
            print(f"  {status} {source}")


def run_all_tests():
    """Run complete test suite"""
    print("\n" + "="*60)
    info("SCRAPER TEST SUITE")
    print("="*60)
    
    results = {}
    
    # Core tests
    results['cricbuzz_direct_url'] = test_cricbuzz_direct_url()
    results['cricbuzz_team_search'] = test_cricbuzz_team_search()
    results['google_scraper'] = test_google_scraper()
    results['cricapi_scraper'] = test_cricapi_scraper()
    results['fallback_chain'] = test_fallback_chain()
    
    # Summary
    print("\n" + "="*60)
    info("TEST SUMMARY")
    print("="*60)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "PASS" if result else "FAIL"
        symbol = "✓" if result else "✗"
        print(f"{symbol} {test_name}: {status}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    return passed == total


def main():
    parser = argparse.ArgumentParser(description='Test scraper modules')
    parser.add_argument('--scraper', '-s', 
                       choices=['cricbuzz', 'google', 'cricapi', 'all'],
                       default='all',
                       help='Specific scraper to test')
    parser.add_argument('--verbose', '-v', action='store_true',
                       help='Enable verbose output')
    parser.add_argument('--list', '-l', action='store_true',
                       help='List available scrapers and exit')
    
    args = parser.parse_args()
    
    if args.verbose:
        import scraper.base as base
        base.VERBOSE = True
    
    if args.list:
        list_available_scrapers()
        return 0
    
    if args.scraper == 'all':
        success = run_all_tests()
    elif args.scraper == 'cricbuzz':
        success = test_cricbuzz_direct_url() and test_cricbuzz_team_search()
    elif args.scraper == 'google':
        success = test_google_scraper()
    elif args.scraper == 'cricapi':
        success = test_cricapi_scraper()
    else:
        print(f"Unknown scraper: {args.scraper}")
        return 1
    
    return 0 if success else 1


if __name__ == '__main__':
    sys.exit(main())
