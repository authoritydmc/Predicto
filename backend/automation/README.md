# Automation Scripts

This directory contains Python automation scripts for processing match results, calculating scores, and updating leaderboards.

## Overview

The automation system consists of:
- **Base modules**: Shared functionality for Firebase client, prediction fetching, result processing, and leaderboard updates
- **Sport-specific modules**: Cricket and football calculators with sport-specific scoring logic
- **Scheduler**: Automated task scheduling for periodic processing

## Cricket Calculator

### Location
`backend/automation/cricket/run_calculator.py`

### Arguments

| Argument | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `--tournament` | string | No | - | Specific tournament ID to process (e.g., `ipl26`) |
| `--match` | string | No | - | Specific match ID to process (e.g., `mi-vs-csk-2026-04-23`) |
| `--innings` | string | No | `both` | Which innings to process: `1`, `2`, or `both` |
| `--force` | flag | No | `false` | Force reprocessing even if match is already reconciled |
| `--env` | string | No | `prod` | Environment mode: `local` or `prod` |

### Usage Examples

```bash
# Process all matches in all tournaments (prod mode)
python backend/automation/cricket/run_calculator.py

# Process specific tournament (prod mode)
python backend/automation/cricket/run_calculator.py --tournament ipl26

# Process specific match (prod mode)
python backend/automation/cricket/run_calculator.py --tournament ipl26 --match mi-vs-csk-2026-04-23

# Process 2nd innings only (prod mode)
python backend/automation/cricket/run_calculator.py --tournament ipl26 --match mi-vs-csk-2026-04-23 --innings 2

# Force reprocess already reconciled match (prod mode)
python backend/automation/cricket/run_calculator.py --tournament ipl26 --match mi-vs-csk-2026-04-23 --force

# Process in local environment
python backend/automation/cricket/run_calculator.py --tournament ipl26 --match mi-vs-csk-2026-04-23 --env local
```

### Environment Modes

- **prod**: Uses production Firebase database (default)
- **local**: Uses local Firebase database for testing

The `--env` argument overrides the `APP_MODE` environment variable.

## Football Calculator

### Location
`backend/automation/football/run_calculator.py`

### Arguments

Same as cricket calculator (see above).

### Usage Examples

```bash
# Process all football matches
python backend/automation/football/run_calculator.py

# Process specific tournament
python backend/automation/football/run_calculator.py --tournament premier23

# Process specific match in local mode
python backend/automation/football/run_calculator.py --tournament premier23 --match man-vs-liv-2026-04-23 --env local
```

## Integration with Control Panel

The Electron control panel automatically calls these scripts via IPC when resolving matches. The environment mode is passed from the control panel's Firebase mode setting.

## GitHub Actions Setup

### Prerequisites

1. Set up Firebase credentials as GitHub Secrets:
   - `FIREBASE_API_KEY`
   - `FIREBASE_AUTH_DOMAIN`
   - `FIREBASE_DATABASE_URL`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_STORAGE_BUCKET`
   - `FIREBASE_MESSAGING_SENDER_ID`
   - `FIREBASE_APP_ID`
   - `FIREBASE_MEASUREMENT_ID`

2. Set environment mode:
   - `APP_MODE` (default: `prod`)

### Example Workflow

Create `.github/workflows/process-matches.yml`:

```yaml
name: Process Match Results

on:
  workflow_dispatch:
    inputs:
      tournament:
        description: 'Tournament ID'
        required: true
        type: string
      match:
        description: 'Match ID (optional, leave blank for all matches)'
        required: false
        type: string
      innings:
        description: 'Innings to process'
        required: false
        type: choice
        options:
          - both
          - 1
          - 2
        default: both
      force:
        description: 'Force reprocessing'
        required: false
        type: boolean
        default: false
      env_mode:
        description: 'Environment mode'
        required: false
        type: choice
        options:
          - prod
          - local
        default: prod
      sport:
        description: 'Sport type'
        required: true
        type: choice
        options:
          - cricket
          - football

jobs:
  process:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          cd backend
          pip install firebase-admin requests
      
      - name: Process match results
        env:
          FIREBASE_API_KEY: ${{ secrets.FIREBASE_API_KEY }}
          FIREBASE_AUTH_DOMAIN: ${{ secrets.FIREBASE_AUTH_DOMAIN }}
          FIREBASE_DATABASE_URL: ${{ secrets.FIREBASE_DATABASE_URL }}
          FIREBASE_PROJECT_ID: ${{ secrets.FIREBASE_PROJECT_ID }}
          FIREBASE_STORAGE_BUCKET: ${{ secrets.FIREBASE_STORAGE_BUCKET }}
          FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.FIREBASE_MESSAGING_SENDER_ID }}
          FIREBASE_APP_ID: ${{ secrets.FIREBASE_APP_ID }}
          FIREBASE_MEASUREMENT_ID: ${{ secrets.FIREBASE_MEASUREMENT_ID }}
          APP_MODE: ${{ github.event.inputs.env_mode }}
        run: |
          SCRIPT_PATH="backend/automation/${{ github.event.inputs.sport }}/run_calculator.py"
          ARGS="--tournament ${{ github.event.inputs.tournament }}"
          
          if [ -n "${{ github.event.inputs.match }}" ]; then
            ARGS="$ARGS --match ${{ github.event.inputs.match }}"
          fi
          
          ARGS="$ARGS --innings ${{ github.event.inputs.innings }}"
          ARGS="$ARGS --env ${{ github.event.inputs.env_mode }}"
          
          if [ "${{ github.event.inputs.force }}" = "true" ]; then
            ARGS="$ARGS --force"
          fi
          
          python $SCRIPT_PATH $ARGS
```

### Scheduled Workflow

For automatic processing at specific times:

```yaml
name: Scheduled Match Processing

on:
  schedule:
    # Run every hour
    - cron: '0 * * * *'
  workflow_dispatch:

jobs:
  process:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          cd backend
          pip install firebase-admin requests
      
      - name: Process cricket matches
        env:
          FIREBASE_API_KEY: ${{ secrets.FIREBASE_API_KEY }}
          FIREBASE_AUTH_DOMAIN: ${{ secrets.FIREBASE_AUTH_DOMAIN }}
          FIREBASE_DATABASE_URL: ${{ secrets.FIREBASE_DATABASE_URL }}
          FIREBASE_PROJECT_ID: ${{ secrets.FIREBASE_PROJECT_ID }}
          FIREBASE_STORAGE_BUCKET: ${{ secrets.FIREBASE_STORAGE_BUCKET }}
          FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.FIREBASE_MESSAGING_SENDER_ID }}
          FIREBASE_APP_ID: ${{ secrets.FIREBASE_APP_ID }}
          FIREBASE_MEASUREMENT_ID: ${{ secrets.FIREBASE_MEASUREMENT_ID }}
          APP_MODE: prod
        run: |
          python backend/automation/cricket/run_calculator.py --env prod
      
      - name: Process football matches
        env:
          FIREBASE_API_KEY: ${{ secrets.FIREBASE_API_KEY }}
          FIREBASE_AUTH_DOMAIN: ${{ secrets.FIREBASE_AUTH_DOMAIN }}
          FIREBASE_DATABASE_URL: ${{ secrets.FIREBASE_DATABASE_URL }}
          FIREBASE_PROJECT_ID: ${{ secrets.FIREBASE_PROJECT_ID }}
          FIREBASE_STORAGE_BUCKET: ${{ secrets.FIREBASE_STORAGE_BUCKET }}
          FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.FIREBASE_MESSAGING_SENDER_ID }}
          FIREBASE_APP_ID: ${{ secrets.FIREBASE_APP_ID }}
          FIREBASE_MEASUREMENT_ID: ${{ secrets.FIREBASE_MEASUREMENT_ID }}
          APP_MODE: prod
        run: |
          python backend/automation/football/run_calculator.py --env prod
```

## Common Use Cases

### 1. Resolve a completed match

```bash
python backend/automation/cricket/run_calculator.py --tournament ipl26 --match mi-vs-csk-2026-04-23 --innings 2 --env prod
```

### 2. Reprocess a match after fixing scoring logic

```bash
python backend/automation/cricket/run_calculator.py --tournament ipl26 --match mi-vs-csk-2026-04-23 --innings both --force --env prod
```

### 3. Update tournament leaderboard after all matches completed

```bash
python backend/automation/cricket/run_calculator.py --tournament ipl26 --env prod
```

### 4. Test with local database

```bash
python backend/automation/cricket/run_calculator.py --tournament ipl26 --match mi-vs-csk-2026-04-23 --env local
```

## Troubleshooting

### Script shows "No cricket tournaments found"
- Check Firebase database connection
- Verify `APP_MODE` or `--env` is set correctly
- Ensure tournament exists in the database

### Predictions not being processed
- Check if match has `actual1stInningsScore` or `actual2ndInningsResult` in meta
- Verify match status is `done` or `completed`
- Use `--force` flag to reprocess already reconciled matches

### Leaderboard not updating
- Leaderboard only updates on `--innings both` or `--innings 2`
- Verify predictions have `reconciled: true` flag
- Check leaderboard updater logs for errors

## Output

The scripts provide detailed console output including:
- Environment mode being used
- Tournaments and matches being processed
- Number of predictions processed
- Leaderboard update status
- Any errors encountered

Example output:
```
================================================================================
[Cricket Calculator] Starting...
[Cricket Calculator] Arguments: tournament=ipl26, match=mi-vs-csk-2026-04-23, innings=2, force=False, env=prod
================================================================================
[Cricket Calculator] Environment mode: prod (from --env arg)
[Cricket Calculator] Using database environment: prod
[Cricket Calculator] Processing tournament: ipl26 (1 matches)
[Cricket Calculator] Processing match: mi-vs-csk-2026-04-23
[Cricket Calculator] SUCCESS: Match mi-vs-csk-2026-04-23 processed
[Cricket Calculator] - Predictions processed: 5/5
[Cricket Calculator] SUCCESS: Leaderboard updated for tournament ipl26
[Cricket Calculator] - Participants updated: 5
================================================================================
```
