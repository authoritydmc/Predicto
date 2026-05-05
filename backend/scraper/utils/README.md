# Team Matcher Module

Intelligent team name matching for sports scrapers. Handles abbreviations, nicknames, and fuzzy matching across different sites.

## Quick Start

```python
from scraper.utils import TeamMatcher, quick_match

# Create matcher
matcher = TeamMatcher('cricket')

# Check if names match
if matcher.matches('CSK', 'Chennai Super Kings'):
    print("Same team!")

# Get canonical name
canonical = matcher.get_canonical_name('DC')  # "Delhi Capitals"

# Quick one-off check
if quick_match('MI', 'Mumbai Indians'):
    print("Match!")
```

## Features

- ✅ **Abbreviation matching**: CSK → Chennai Super Kings
- ✅ **Nickname support**: Super Kings, Men in Blue, Yellow Army
- ✅ **Fuzzy matching**: Handles typos like "Chenai" → "Chennai"
- ✅ **Multi-site compatibility**: Works with Cricbuzz, ESPN, etc.
- ✅ **Cricket & Football**: IPL, International, EPL support
- ✅ **Text extraction**: Find teams in unstructured text

## Supported Teams

### Cricket - IPL (10 Teams)
| Abbrev | Canonical Name | Nicknames |
|--------|------------------|-----------|
| CSK | Chennai Super Kings | Super Kings, Chennai, Yellow Army |
| DC | Delhi Capitals | Capitals, Delhi, Dilli |
| MI | Mumbai Indians | Indians, Mumbai, Paltan |
| RCB | Royal Challengers Bangalore | Challengers, Bangalore |
| KKR | Kolkata Knight Riders | Knight Riders, Knights |
| RR | Rajasthan Royals | Royals, Rajasthan, Pink Army |
| PBKS | Punjab Kings | Kings, Punjab, Sher-e-Punjab |
| SRH | Sunrisers Hyderabad | Sunrisers, Hyderabad, Orange Army |
| GT | Gujarat Titans | Titans, Gujarat, Aava De |
| LSG | Lucknow Super Giants | Super Giants, Lucknow |

### Cricket - International (12 Teams)
| Abbrev | Canonical Name | Nicknames |
|--------|------------------|-----------|
| IND | India | Team India, Men in Blue, Blues |
| AUS | Australia | Aussies, Baggy Greens |
| ENG | England | Three Lions, Poms |
| PAK | Pakistan | Men in Green, Shaheens |
| SA | South Africa | Proteas, Springboks |
| NZ | New Zealand | Black Caps, Kiwis |
| SL | Sri Lanka | Lions, Lankan Lions |
| WI | West Indies | Windies, Caribbeans |
| BAN | Bangladesh | Tigers, Bangla Tigers |
| AFG | Afghanistan | Afghan Atalan |
| IRE | Ireland | Irish |
| ZIM | Zimbabwe | Chevrons |

### Football - Premier League (6 Teams)
| Abbrev | Canonical Name | Nicknames |
|--------|------------------|-----------|
| MUFC | Manchester United | Red Devils, Man U, United |
| MCFC | Manchester City | City, Citizens, Sky Blues |
| LFC | Liverpool | Reds |
| CFC | Chelsea | Blues, The Blues |
| AFC | Arsenal | Gunners |
| THFC | Tottenham | Spurs, Lilywhites |

## Usage Examples

### Basic Matching

```python
from scraper.utils import TeamMatcher

matcher = TeamMatcher('cricket')

# All of these match CSK:
matcher.matches('CSK', 'Chennai Super Kings')  # True
matcher.matches('CSK', 'Chennai')              # True
matcher.matches('CSK', 'Super Kings')          # True
matcher.matches('CSK', 'Yellow Army')          # True
matcher.matches('CSK', 'CSKS')                 # True
```

### Get Canonical Name

```python
# Normalize any variation to canonical name
matcher.get_canonical_name('CSK')              # "Chennai Super Kings"
matcher.get_canonical_name('Delhi')            # "Delhi Capitals"
matcher.get_canonical_name('Men in Blue')      # "India"
matcher.get_canonical_name('Aussies')          # "Australia"
```

### Get All Variations

```python
variations = matcher.get_variations('DC')
# Returns: ['Delhi Capitals', 'DC', 'DEL', 'Delhi', 'Capitals', 'Dilli']
```

### Extract Teams from Text

```python
from scraper.utils import find_in_text

text = "RCB will face CSK in today's match"
teams = find_in_text(text)
# Returns: ['Royal Challengers Bangalore', 'Chennai Super Kings']
```

### Fuzzy Matching

```python
# Handles typos and variations
matcher.get_canonical_name('Chenai Super Kings')   # "Chennai Super Kings"
matcher.get_canonical_name('Delhi Capital')        # "Delhi Capitals"
matcher.get_canonical_name('RC Bangalore')         # "Royal Challengers Bangalore"
```

### Find Best Match from Candidates

```python
candidates = ['Mumbai Indians', 'Chennai Super Kings', 'Delhi Capitals']
best_match, score = matcher.find_best_match('CSK', candidates)
# Returns: ('Chennai Super Kings', 1.0)
```

## API Reference

### TeamMatcher Class

```python
class TeamMatcher(sport='cricket', similarity_threshold=0.6)
```

**Methods:**

- `matches(name1, name2)` - Check if two names refer to same team
- `get_canonical_name(name)` - Get canonical name for any variation
- `get_variations(name)` - Get all known variations
- `find_best_match(query, candidates)` - Find best match from list
- `extract_teams_from_text(text)` - Extract teams from text

### Utility Functions

```python
# Quick one-off matching
quick_match('CSK', 'Chennai Super Kings', sport='cricket')  # True

# Get all variations
get_all_variations('DC', sport='cricket')
# ['Delhi Capitals', 'DC', 'DEL', 'Delhi', 'Capitals']

# Find teams in text
find_in_text('RCB vs CSK today', sport='cricket')
# ['Royal Challengers Bangalore', 'Chennai Super Kings']
```

## Testing

Run the test suite:

```bash
python backend/scraper/utils/test_team_matcher.py
```

Run specific tests:

```bash
# Basic matching
python -c "from scraper.utils import TeamMatcher; m = TeamMatcher('cricket'); print(m.matches('CSK', 'Chennai'))"

# Get variations
python -c "from scraper.utils import get_all_variations; print(get_all_variations('DC'))"

# Extract from text
python -c "from scraper.utils import find_in_text; print(find_in_text('RCB vs CSK today'))"
```

## Adding New Teams

Edit `team_matcher.py` and add to the appropriate dictionary:

```python
'new_team_id': {
    'canonical': 'Full Team Name',
    'abbreviations': ['ABC', 'ABBR'],
    'nicknames': ['Nickname1', 'Nickname2'],
    'location': 'City',
    'colors': ['color1', 'color2'],
}
```

## How It Works

1. **Normalization**: Converts input to lowercase, removes extra spaces
2. **Index Lookup**: Checks abbreviations, nicknames, canonical names
3. **Fuzzy Matching**: Uses sequence matching for typos (60%+ similarity)
4. **Token Matching**: Matches partial names ("Delhi" matches "Delhi Capitals")

## Use in Scrapers

```python
from scraper.utils import TeamMatcher

class MyScraper(BaseCricketScraper):
    def __init__(self):
        super().__init__()
        self.team_matcher = TeamMatcher('cricket')
    
    def find_match(self, team_a, team_b, candidates):
        # Find matching teams from scraped data
        for candidate in candidates:
            if self.team_matcher.matches(team_a, candidate):
                return candidate
        return None
```
