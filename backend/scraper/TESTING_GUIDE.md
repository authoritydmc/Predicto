# Scraper Testing Guide

This guide provides commands to manually test each scraper module.

## Quick Reference

```bash
# Test all cricket scrapers
python backend/scraper/cli.py cricket DC CSK --sources cricbuzz
python backend/scraper/cli.py cricket DC CSK --sources google
python backend/scraper/cli.py cricket DC CSK --sources cricapi  # needs API key

# Test with direct URL (most reliable)
python backend/scraper/cli.py cricket --match-url https://www.cricbuzz.com/live-cricket-scores/152031/dc-vs-csk-48th-match-indian-premier-league-2026 --sources cricbuzz

# List available sources
python backend/scraper/cli.py cricket --list-sources
```

---

## Individual Scraper Tests

### 1. Cricbuzz Scraper

**Test with direct match URL (Recommended):**
```bash
python backend/scraper/cli.py cricket --match-url https://www.cricbuzz.com/live-cricket-scores/152031/dc-vs-csk-48th-match-indian-premier-league-2026 --sources cricbuzz --output pretty
```

**Test by team names (searches live scores page):**
```bash
python backend/scraper/cli.py cricket DC CSK --sources cricbuzz
python backend/scraper/cli.py cricket MI RCB --sources cricbuzz
python backend/scraper/cli.py cricket KKR SRH --sources cricbuzz
```

**Expected output:**
```json
{
  "teamA": {"name": "Delhi Capitals", "runs": 155, "wickets": 7, ...},
  "teamB": {"name": "Chennai Super Kings", "runs": 159, "wickets": 2, ...},
  "matchStatus": "completed",
  "source": "cricbuzz"
}
```

**Test programmatically (Python):**
```python
from backend.scraper import ScraperFactory

scraper = ScraperFactory.create('cricket', 'cricbuzz')
result = scraper.get_score(
    team_a='DC',
    team_b='CSK',
    match_url='https://www.cricbuzz.com/live-cricket-scores/152031/...'
)
print(result)
```

---

### 2. Google Cricket Scraper

**Test by team names:**
```bash
python backend/scraper/cli.py cricket DC CSK --sources google --output pretty
python backend/scraper/cli.py cricket "India" "Australia" --sources google
```

**Note:** Google scraper is experimental and may break if Google changes their layout.

**Expected behavior:**
- Searches Google for "Team A vs Team B live score"
- Extracts score patterns from search results
- Returns score data if found

---

### 3. CricAPI Scraper

**Prerequisites:**
1. Get free API key from: https://www.cricapi.com/
2. No credit card required for free tier (100,000 requests/hour)

**Test with API key:**
```bash
# Set API key via environment variable
set CRICAPI_KEY=your_api_key_here
python backend/scraper/cli.py cricket DC CSK --sources cricapi
```

**Test programmatically with API key:**
```python
from backend.scraper import ScraperFactory

scraper = ScraperFactory.create('cricket', 'cricapi', api_key='YOUR_API_KEY')
result = scraper.get_score(team_a='DC', team_b='CSK')
print(result)
```

**Without API key (should skip):**
```bash
python backend/scraper/cli.py cricket DC CSK --sources cricapi
# Expected: "[CricAPI] Cannot fetch - no API key"
```

---

### 4. API-Football Scraper

**Prerequisites:**
1. Get API key from: https://rapidapi.com/api-sports/api/api-football
2. Subscribe to free tier (100 requests/day)

**Test football scores:**
```bash
# Set API key
set APIFOOTBALL_KEY=your_rapidapi_key_here
python backend/scraper/cli.py football "Manchester United" "Liverpool" --sources apifootball
```

**Test programmatically:**
```python
from backend.scraper import ScraperFactory

scraper = ScraperFactory.create('football', 'apifootball', api_key='YOUR_KEY')
result = scraper.get_score(team_a='Manchester United', team_b='Liverpool')
print(result)
```

---

## Scraper Manager Tests

### Test with Fallback Chain

```bash
# Try cricbuzz first, then google, then cricapi
python backend/scraper/cli.py cricket DC CSK --sources cricbuzz,google,cricapi --output pretty
```

### Test All Available Cricket Sources

```bash
# Get list first
python backend/scraper/cli.py cricket --list-sources

# Test each one
python backend/scraper/cli.py cricket DC CSK --sources cricbuzz
python backend/scraper/cli.py cricket DC CSK --sources google
python backend/scraper/cli.py cricket DC CSK --sources cricapi
```

---

## Python Module Tests

### Test Base Classes

```python
# Test base scraper functionality
from backend.scraper.base import BaseScraper

scraper = BaseScraper(timeout=15)
soup = scraper.fetch_page("https://www.cricbuzz.com/cricket-match/live-scores")
print(f"Page fetched: {soup is not None}")
```

### Test Score Parsing

```python
from backend.scraper.base import BaseScraper

scraper = BaseScraper()

# Test score pattern parsing
tests = [
    "155/7 (20)",
    "159-2 (17.3)",
    "200/5 (20.0)",
    "145 (19.2)"
]

for test in tests:
    result = scraper.parse_score_pattern(test)
    print(f"{test} -> {result}")
```

### Test Team Name Matching

```python
from backend.scraper.cricket import CricbuzzScraper

scraper = CricbuzzScraper()

# Test abbreviation matching
print(scraper.team_matches('DC', 'Delhi Capitals'))  # True
print(scraper.team_matches('CSK', 'Chennai Super Kings'))  # True
print(scraper.team_matches('MI', 'Mumbai Indians'))  # True
print(scraper.team_matches('RCB', 'Royal Challengers Bangalore'))  # True
```

---

## Error Testing

### Test Invalid Team Names

```bash
python backend/scraper/cli.py cricket INVALID TEAM --sources cricbuzz
# Expected: Match not found
```

### Test Invalid URL

```bash
python backend/scraper/cli.py cricket --match-url https://invalid-url.com --sources cricbuzz
# Expected: Request failed
```

### Test Timeout

```bash
# The scraper has 15s timeout by default
# To test timeout, you can temporarily modify the scraper init
```

---

## Debug Mode

Enable verbose logging to see detailed debug output:

```python
# In your test script
import backend.scraper.base as base
base.VERBOSE = True

# Then run scraper
from backend.scraper import ScraperFactory
scraper = ScraperFactory.create('cricket', 'cricbuzz')
result = scraper.get_score(team_a='DC', team_b='CSK', match_url='...')
```

---

## Automated Test Script

Create a test script `test_scrapers.py`:

```python
#!/usr/bin/env python3
"""Automated scraper tests"""

import json
from backend.scraper import ScraperManager, ScraperFactory

def test_cricbuzz():
    """Test Cricbuzz scraper"""
    print("\n=== Testing Cricbuzz Scraper ===")
    
    manager = ScraperManager(['cricbuzz'])
    result = manager.get_score(
        'cricket',
        team_a='DC',
        team_b='CSK',
        match_url='https://www.cricbuzz.com/live-cricket-scores/152031/dc-vs-csk-48th-match-indian-premier-league-2026'
    )
    
    if result:
        print("✓ Cricbuzz scraper working!")
        print(json.dumps(result, indent=2))
        return True
    else:
        print("✗ Cricbuzz scraper failed")
        return False

def test_google():
    """Test Google scraper"""
    print("\n=== Testing Google Scraper ===")
    
    manager = ScraperManager(['google'])
    result = manager.get_score('cricket', team_a='DC', team_b='CSK')
    
    if result:
        print("✓ Google scraper working!")
        return True
    else:
        print("✗ Google scraper failed (expected - experimental)")
        return False

def test_all_sources():
    """Test all available sources"""
    print("\n=== Testing All Available Sources ===")
    
    sources = ScraperFactory.get_available_sources('cricket')
    print(f"Available sources: {sources}")
    
    for source in sources:
        print(f"\nTesting {source}...")
        try:
            scraper = ScraperFactory.create('cricket', source)
            print(f"  ✓ {source} created successfully")
        except Exception as e:
            print(f"  ✗ {source} failed: {e}")

if __name__ == '__main__':
    test_cricbuzz()
    test_google()
    test_all_sources()
```

Run the test script:
```bash
python test_scrapers.py
```

---

## Expected Test Results

| Scraper | Direct URL | Team Names | API Key Required | Status |
|---------|-------------|------------|-------------------|---------|
| Cricbuzz | ✓ Works | ✓ Works | No | Production Ready |
| Google | N/A | ✓ Works (fragile) | No | Experimental |
| CricAPI | N/A | ✓ Works | Yes | Needs API Key |
| API-Football | N/A | ✓ Works | Yes | Needs API Key |

---

## Troubleshooting

### Import Errors

```bash
# If you get import errors, run from the backend directory:
cd backend
python -c "from scraper import ScraperFactory; print('OK')"
```

### BeautifulSoup Not Found

```bash
pip install beautifulsoup4 lxml
```

### SSL Certificate Errors

If you get SSL errors on Windows:
```bash
pip install certifi
# Or disable SSL verification (not recommended for production)
```

---

## Adding New Scrapers

To test a new scraper after adding it:

1. Register in `cricket/__init__.py` or `football/__init__.py`
2. Test creation: `ScraperFactory.create('cricket', 'newsource')`
3. Test with CLI: `python cli.py cricket DC CSK --sources newsource`
4. Add test cases to this guide
