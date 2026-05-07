# Automation System

Single entry point for all automation tasks. Clean, modular, and cron-based.

## Quick Start

```bash
# Start the scheduler (runs all cron jobs automatically)
cd backend
python -m automation.main scheduler start

# Run individual scripts
python -m automation.main live-matches --sport cricket
python -m automation.main run-scraper
python -m automation.main match-status
python -m automation.main calculate-scores --tournament-id XXX --match-id YYY
python -m automation.main update-leaderboard --tournament-id XXX

# Manage cron jobs (CRUD)
python -m automation.main cron list
python -m automation.main cron add my_job "*/5 * * * *" "automation.scoring.calculator"
python -m automation.main cron remove my_job
python -m automation.main cron enable my_job
python -m automation.main cron disable my_job
```

## Architecture

```
backend/automation/
├── main.py                    # SINGLE ENTRY POINT
├── cron/                      # Cron job management
│   ├── manager.py             # CRUD for cron jobs in Firebase
│   ├── scheduler.py           # Scheduler engine
│   └── tasks.py               # Task registry
├── matches/                   # Match handling
│   ├── live_matches.py        # Get all live matches
│   ├── status_manager.py      # Match status rules & transitions
│   └── scheduler.py           # Auto-schedule next matches
├── scraper/                   # Scraper integration
│   └── runner.py              # Run scrapers for live matches
├── scoring/                   # Score calculation
│   ├── calculator.py          # Penalty & score calculation
│   └── leaderboard.py         # Update leaderboards
└── config/
    └── settings.py            # Centralized configuration
```

## Available Scripts

| Script | Description | Cron Schedule |
|--------|-------------|---------------|
| `live-matches` | Get all live matches from Firebase | Every 1 min |
| `run-scraper` | Run scrapers for live matches | Every 30 sec |
| `match-status` | Process match status transitions | Every 1 min |
| `auto-schedule` | Auto-schedule upcoming matches | Every 6 hours |
| `calculate-scores` | Calculate scores and penalties | Every 5 min |
| `update-leaderboard` | Update match & tournament leaderboards | Every 5 min |

## Match Status Rules

### First Innings
- Predictions open: When match is "live" and toss completed
- Predictions close: After 3 overs (18 balls)
- Status: `first_innings_live` → `first_innings_done`

### Second Innings
- Early predictions: Allowed as soon as second innings starts
- Predictions close: After 3 overs
- Status: `second_innings_live` → `completed`

### Match Completion
- Status: `completed` when target reached or all out
- Scraper indicates: "won", "complete", "result", "draw", "tie"

## GitHub Actions

Workflows updated to use new entry point:
- `.github/workflows/automation.yml` - General automation pipeline
- `.github/workflows/live-monitor-weekdays.yml` - Weekday matches
- `.github/workflows/live-monitor-weekends.yml` - Weekend matches

## Configuration

Edit `backend/automation/config/settings.py` for:
- Firebase collections
- Match status constants
- Prediction rules
- Scoring constants
- Cron job defaults
- Scraper settings
