# Host App Integration Plan - Automation System

## Overview
Admin panel (host app) needs to manage cron-based automation jobs with:
- View all jobs and their status
- Enable/disable jobs (no delete)
- Update cron frequency
- Manually run jobs
- See real-time logs/output in debug window

## Architecture

### 1. API Endpoints (FastAPI)
Add endpoints to `backend/server.py` for job management:

```
GET    /api/automation/jobs           # List all jobs
GET    /api/automation/jobs/{id}     # Get job details
PUT    /api/automation/jobs/{id}      # Update job (enable/disable/schedule)
POST   /api/automation/jobs/{id}/run # Manually run a job
GET    /api/automation/logs           # Get recent logs
WS     /api/automation/ws             # WebSocket for real-time logs
```

### 2. Logging System
- Console logging (existing)
- File logging (`logs/automation.log`)
- WebSocket logging (real-time to host app)

### 3. Job Testing Order
1. **Match Creation Job** - Schedules next matches
2. **Scraper Job** - Runs scraper, triggers match status changes
3. **Match Status Job** - Processes status transitions
4. **Score Calculator Job** - Calculates scores
5. **Leaderboard Update Job** - Updates leaderboards
6. **Reconciliation Job** - Migrates predictions

## Implementation Steps

### Step 1: Enhanced Logging (30 mins)
- [x] Create centralized logging config
- [ ] Add file logging
- [ ] Add WebSocket logging handler
- [ ] Log to both console and file

### Step 2: API Endpoints (1 hour)
- [ ] Add GET /api/automation/jobs
- [ ] Add PUT /api/automation/jobs/{id}
- [ ] Add POST /api/automation/jobs/{id}/run
- [ ] Add WebSocket endpoint for real-time logs

### Step 3: Test Match Creation (30 mins)
- [ ] Create test script
- [ ] Run match creation job
- [ ] Verify matches are scheduled in Firebase

### Step 4: Test Scraper (30 mins)
- [ ] Run scraper job
- [ ] Verify live scores updated
- [ ] Check match status changes

### Step 5: Test Reconciliation (30 mins)
- [ ] Run reconciliation job
- [ ] Verify prediction migrations

## Log Output Format
```
[2026-05-07 23:10:15] [INFO] [automation.matches.scheduler] Scheduling matches for cricket
[2026-05-07 23:10:16] [INFO] [automation.matches.scheduler] Scheduled 3 new matches
[2026-05-07 23:10:16] [DEBUG] [automation.matches.scheduler] Created match: india_vs_australia_20260508
```

## File Structure
```
backend/
├── server.py                    # FastAPI server (add automation endpoints)
├── automation/
│   ├── main.py                 # Single entry point (updated with logging)
│   ├── cron/
│   │   ├── manager.py          # CRUD for jobs (no delete, only enable/disable)
│   │   └── scheduler.py       # Scheduler with logging
│   └── ...
└── logs/
    └── automation.log          # Log file for host app to read
```
