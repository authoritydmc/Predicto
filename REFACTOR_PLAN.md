# Automation Refactoring Plan - OverlayChat

## Current Issues Identified

### 1. **Multiple Orchestrator Implementations** (HIGH PRIORITY)
- `automation/orchestrator/automation_orchestrator.py` (4000+ lines)
- `automation/orchestrator/windows_orchestrator.py`
- `automation/orchestrator/simple_windows_orchestrator.py`
- `automation/orchestrator/fixed_windows_orchestrator.py`
- `automation/orchestrator/working_windows_orchestrator.py`
- **Problem**: 4+ variants creating confusion about which one to use

### 2. **Competing Scheduler Systems**
- `automation/scheduler/scheduler.py` - Simple scheduler
- `automation/orchestrator/` - Enhanced orchestrator with scheduling
- **Problem**: Two different systems that may conflict

### 3. **Multiple Scoring Implementations**
- `backend/scoring.py` - Original (used by monitor.py)
- `automation/base/score_calculator.py` - Abstract base
- `automation/cricket/cricket_calculator.py` - Cricket-specific
- `automation/football/football_calculator.py` - Football-specific
- **Problem**: Overlapping functionality, inconsistent usage

### 4. **Monitor Script vs Orchestrator**
- `backend/monitor.py` - Standalone 300-line script (used by GitHub Actions)
- `backend/automation/orchestrator/` - Comprehensive system
- **Problem**: Both do similar things, unclear which is active

### 5. **No Centralized Cron Management**
- GitHub Actions workflows are scattered
- No CRUD interface for scheduled tasks
- Hard to manage/update schedules

---

## New Architecture Design

### Directory Structure (Clean)
```
backend/
├── automation/
│   ├── __init__.py
│   ├── main.py                    # SINGLE ENTRY POINT
│   │
│   ├── cron/                      # Cron job management
│   │   ├── __init__.py
│   │   ├── manager.py             # CRUD for cron jobs
│   │   ├── scheduler.py           # Scheduler engine
│   │   └── tasks.py               # Task registry
│   │
│   ├── matches/                   # Match handling
│   │   ├── __init__.py
│   │   ├── live_matches.py        # Get all live matches
│   │   ├── status_manager.py      # Match status rules & transitions
│   │   └── scheduler.py           # Auto-schedule next matches
│   │
│   ├── scraper/                   # Scraper integration
│   │   ├── __init__.py
│   │   └── runner.py              # Run scrapers for live matches
│   │
│   ├── scoring/                   # Score calculation
│   │   ├── __init__.py
│   │   ├── calculator.py          # Penalty & score calculation
│   │   └── leaderboard.py         # Update match & tournament leaderboard
│   │
│   └── config/
│       ├── __init__.py
│       └── settings.py            # Centralized configuration
│
├── scraper/                       # Keep existing (already well-structured)
│   └── ...                        # No changes needed
│
└── firebase/                      # Firebase operations
    ├── __init__.py
    └── client.py                  # Centralized Firebase operations
```

---

## Scripts to Create (Cron Jobs)

### 1. **Get Live Matches** (`matches/live_matches.py`)
```python
# Fetches all live matches from Firebase
# Returns: List of match objects with current status
# Cron: Every 1 minute during match hours
```

### 2. **Run Scraper for Live Matches** (`scraper/runner.py`)
```python
# For each live match, run appropriate scraper
# Updates Firebase with live scores
# Cron: Every 30 seconds during live matches
```

### 3. **Match Status Handler** (`matches/status_manager.py`)
```python
# Rules:
# - First innings: Close predictions after 3 overs
# - Second innings: Allow early predictions
# - Mark match as "done" when finished (based on scraper data)
# - Handle innings transitions
# Cron: Every 1 minute
```

### 4. **Auto-Schedule Next Matches** (`matches/scheduler.py`)
```python
# Detect upcoming matches from scrapers
# Create match entries in Firebase
# Schedule automation for those matches
# Cron: Every 6 hours
```

### 5. **Score Calculator & Leaderboard** (`scoring/calculator.py` + `scoring/leaderboard.py`)
```python
# Calculate penalty scores
# Update match leaderboard
# Update tournament leaderboard
# Cron: Every 5 minutes or after match completion
```

---

## Cron Job Configuration (CRUD Managed)

### Store in Firebase: `automation_config/cron_jobs`
```json
{
  "get_live_matches": {
    "name": "Get Live Matches",
    "script": "automation.matches.live_matches",
    "schedule": "*/1 * * * *",
    "enabled": true,
    "description": "Fetch all live matches"
  },
  "run_scraper": {
    "name": "Run Scraper",
    "script": "automation.scraper.runner",
    "schedule": "*/30 * * * * *",
    "enabled": true,
    "description": "Scrape live scores for active matches"
  },
  "match_status": {
    "name": "Match Status Handler",
    "script": "automation.matches.status_manager",
    "schedule": "*/1 * * * *",
    "enabled": true,
    "description": "Handle match status transitions"
  },
  "auto_schedule": {
    "name": "Auto Schedule Matches",
    "script": "automation.matches.scheduler",
    "schedule": "0 */6 * * *",
    "enabled": true,
    "description": "Auto-schedule upcoming matches"
  },
  "score_calculator": {
    "name": "Score Calculator",
    "script": "automation.scoring.calculator",
    "schedule": "*/5 * * * *",
    "enabled": true,
    "description": "Calculate scores and penalties"
  },
  "leaderboard_update": {
    "name": "Update Leaderboard",
    "script": "automation.scoring.leaderboard",
    "schedule": "*/5 * * * *",
    "enabled": true,
    "description": "Update match and tournament leaderboards"
  }
}
```

---

## Implementation Steps

### Phase 1: Clean Up & Consolidate (Day 1)
1. **Delete duplicate orchestrator files**
   - Remove: `windows_orchestrator.py`, `simple_windows_orchestrator.py`, `fixed_windows_orchestrator.py`, `working_windows_orchestrator.py`
   - Keep only: `automation_orchestrator.py` (refactor to be cleaner)

2. **Consolidate scoring logic**
   - Move all scoring to `automation/scoring/calculator.py`
   - Remove `backend/scoring.py` after migration
   - Update all references

3. **Create centralized configuration**
   - Move hardcoded values to `automation/config/settings.py`
   - Firebase paths, team mappings, scoring constants

### Phase 2: Create New Modules (Day 2)
1. **Create `automation/cron/` module**
   - `manager.py`: CRUD operations for cron jobs
   - `scheduler.py`: Scheduler engine using `croniter`
   - `tasks.py`: Task registry

2. **Create `automation/matches/` module**
   - `live_matches.py`: Get live matches from Firebase
   - `status_manager.py`: Status rules implementation
   - `scheduler.py`: Auto-schedule next matches

3. **Create `automation/scraper/runner.py`**
   - Integrate with existing scraper module
   - Run scrapers for live matches only

4. **Create `automation/scoring/` module**
   - `calculator.py`: Score + penalty calculation
   - `leaderboard.py`: Update leaderboards

### Phase 3: Single Entry Point (Day 3)
1. **Create `automation/main.py`**
   - CLI interface for all operations
   - Support for running individual scripts
   - Support for starting the scheduler
   - Support for managing cron jobs (CRUD)

2. **Update GitHub Actions**
   - Point to new `automation/main.py`
   - Pass appropriate arguments

### Phase 4: Testing & Migration (Day 4)
1. Test each script independently
2. Test scheduler with all cron jobs
3. Migrate from old system
4. Verify leaderboard calculations

---

## Match Status Rules (To Implement)

### First Innings
- **Predictions open**: When match is "live" and toss completed
- **Predictions close**: After 3 overs (18 balls) completed
- **Status**: `first_innings_live` → `first_innings_done` (after 19.6 overs or 10 wickets)

### Second Innings
- **Early predictions**: Allowed as soon as second innings starts
- **Predictions close**: After 3 overs (if chasing) or based on first innings rules
- **Status**: `second_innings_live` → `second_innings_done` (target reached or all out)

### Match Completion
- **Status**: `completed` when:
  - Second innings target reached
  - Second innings all out
  - Scraper indicates "won", "complete", "result", "draw", "tie"

---

## CLI Usage (Single Entry Point)

```bash
# Start the scheduler (runs all cron jobs)
python -m automation.main scheduler start

# Run a specific script manually
python -m automation.main run get_live_matches
python -m automation.main run run_scraper
python -m automation.main run match_status
python -m automation.main run score_calculator

# CRUD for cron jobs
python -m automation.main cron list
python -m automation.main cron add <job_name> <schedule> <script>
python -m automation.main cron remove <job_name>
python -m automation.main cron enable <job_name>
python -m automation.main cron disable <job_name>

# For GitHub Actions / Host app
python -m automation.main run <script_name>
```

---

## Benefits of New Architecture

1. **Single Entry Point**: One command to rule them all
2. **No Duplication**: Each function exists in exactly one place
3. **Cron CRUD**: Easy to manage scheduled tasks
4. **Modular**: Each script has a single responsibility
5. **Testable**: Each module can be tested independently
6. **Scalable**: Easy to add new sports or new automation tasks
7. **GitHub Actions Compatible**: Can run any script via CLI
8. **Backend Only**: All logic in Python, no frontend dependency
