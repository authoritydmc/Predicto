# Enhanced Automation Orchestrator

A comprehensive Python-based automation system for cricket match management, live score scraping, and automated scoring calculations.

## Overview

The Enhanced Automation Orchestrator provides a unified system for:
- **Match Creation**: Automatically fetches and creates matches from various sources
- **Live Score Scraping**: Intelligent multi-source scraping with fallback mechanisms
- **Score Processing**: Automated execution of scoring algorithms
- **Real-time Monitoring**: WebSocket-based monitoring and control
- **Configuration Management**: Centralized configuration with validation

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Host Control App                          │
│  (Status Monitor, Debug Window, Manual Controls)            │
└─────────────────────┬───────────────────────────────────────┘
                      │ WebSocket (9222)
┌─────────────────────▼───────────────────────────────────────┐
│                  Automation Orchestrator                     │
│  (Task Manager, Status Monitor, WebSocket Bridge)           │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│              Core Automation Services                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │ Match       │ │ Scraper    │ │ Scoring     │            │
│  │ Manager     │ │ Manager     │ │ Engine      │            │
│  └─────────────┘ └─────────────┘ └─────────────┘            │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                Base Infrastructure                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │ Firebase    │ │ WebSocket   │ │ Config      │            │
│  │ Client      │ │ Logger      │ │ Manager     │            │
│  └─────────────┘ └─────────────┘ └─────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. Automation Orchestrator (`automation_orchestrator.py`)
Central coordinator that manages all automation tasks and provides WebSocket interface for monitoring.

**Features:**
- Task scheduling and execution
- Real-time status broadcasting
- Component lifecycle management
- Error handling and recovery

### 2. Match Manager (`match_manager.py`)
Handles match creation, updates, and lifecycle management.

**Features:**
- Multi-source match fetching (CricAPI, Cricbuzz, Manual)
- Automatic match creation in Firebase
- Live score updates
- Match status tracking

**Supported Sources:**
- **CricAPI**: API-based match fetching
- **Cricbuzz**: Web scraping for match schedules
- **Manual**: Manually configured matches

### 3. Scraper Manager (`scraper_manager.py`)
Enhanced scraping system with intelligent fallback and health monitoring.

**Features:**
- Multi-source scraping with priority-based fallback
- Performance tracking and automatic adjustment
- Health monitoring with cooldown mechanisms
- Caching to reduce API calls

**Supported Scrapers:**
- **Cricbuzz**: Primary cricket scraper
- **CricAPI**: Secondary cricket scraper (requires API key)
- **Google**: Fallback web scraper
- **API-Football**: Football scraper (requires API key)

### 4. Scoring Engine (`scoring_engine.py`)
Manages score calculation and processing for completed matches.

**Features:**
- Automatic detection of completed matches
- Queue-based processing with concurrency limits
- Integration with existing scoring calculators
- Retry mechanism for failed jobs
- Progress tracking and status reporting

### 5. Status Monitor (`status_monitor.py`)
Real-time monitoring and alerting system.

**Features:**
- Component health monitoring
- Performance metrics collection
- Alert generation for threshold breaches
- Historical data tracking
- WebSocket status broadcasting

### 6. Configuration Manager (`config_manager.py`)
Centralized configuration management with validation.

**Features:**
- Structured configuration objects
- Firebase and local file storage
- Configuration validation
- Import/export functionality
- Runtime configuration updates

### 7. Enhanced WebSocket Logger (`enhanced_websocket_logger.py`)
Structured logging system with debug window integration.

**Features:**
- Multiple log levels (DEBUG, INFO, WARNING, ERROR, CRITICAL)
- Component-based log filtering
- Real-time log streaming to debug window
- Log buffering and replay
- Performance metrics

## Installation and Setup

### Prerequisites
```bash
# Python dependencies
pip install firebase-admin requests websocket-client

# Optional for enhanced features
pip install beautifulsoup4 selenium
```

### Environment Variables
```bash
# Firebase Configuration
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
FIREBASE_PROJECT_ID=your-project-id

# Optional API Keys
CRICAPI_API_KEY=your_cricapi_key
API_FOOTBALL_KEY=your_api_football_key

# Application Settings
APP_MODE=prod  # or 'dev' for development
```

### Firebase Service Account
Place `firebase.cert.json` in the project root with your Firebase service account credentials.

## Usage

### Starting the Enhanced Orchestrator

#### Method 1: Direct Execution
```bash
cd backend
python automation/orchestrator/main.py
```

#### Method 2: Via Host Control App
The orchestrator starts automatically when the host control app runs in production mode.

### Configuration

#### Basic Configuration
```python
# Update automation intervals
automation_config = {
    'match_creation_interval': 300,  # 5 minutes
    'scraping_interval': 60,         # 1 minute  
    'scoring_interval': 30,          # 30 seconds
    'max_concurrent_tasks': 3
}

# Update via host control app or Firebase
```

#### Scraper Configuration
```python
# Configure scraper priorities and settings
scraper_configs = {
    'cricbuzz': {
        'enabled': True,
        'priority': 1,
        'timeout': 30,
        'success_rate_threshold': 0.7
    },
    'cricapi': {
        'enabled': True,
        'priority': 2,
        'api_key': 'your_key_here'
    }
}
```

### Monitoring and Control

#### WebSocket Messages
The orchestrator broadcasts real-time status updates via WebSocket on port 9222:

**Status Updates:**
```json
{
    "type": "status_update",
    "data": {
        "automation_status": {
            "running": true,
            "total_tasks": 3,
            "running_tasks": 1,
            "error_tasks": 0
        },
        "component_health": {...}
    },
    "timestamp": 1640995200000
}
```

**Task Updates:**
```json
{
    "type": "task_update", 
    "task": {
        "task_id": "live_scraping",
        "name": "Live Score Scraping",
        "status": "running",
        "progress": 45.0
    }
}
```

**Alerts:**
```json
{
    "type": "alert",
    "data": {
        "type": "high_error_rate",
        "severity": "high",
        "data": {"error_rate": 0.25}
    }
}
```

#### Host Control App Integration
The host control app provides IPC handlers for:

- `automation:get-status` - Get current system status
- `automation:trigger-task` - Manually trigger a task
- `automation:update-config` - Update configuration
- `automation:test-scraper` - Test a specific scraper
- `automation:get-logs` - Get recent logs

## API Reference

### Automation Orchestrator

```python
from automation.orchestrator import AutomationOrchestrator

orchestrator = AutomationOrchestrator(firebase_client, logger)
orchestrator.start()

# Get status
status = orchestrator.get_status()

# Trigger task
result = orchestrator.trigger_task('live_scraping')

# Update configuration  
result = orchestrator.update_config({'scraping_interval': 30})
```

### Match Manager

```python
from automation.orchestrator import MatchManager

match_manager = MatchManager(firebase_client, logger)

# Fetch upcoming matches
matches = match_manager.fetch_upcoming_matches()

# Create match
success = match_manager.create_match_if_not_exists(match)

# Update live score
success = match_manager.update_match_score(match_id, score_data)
```

### Scraper Manager

```python
from automation.orchestrator import ScraperManager

scraper_manager = ScraperManager(firebase_client, logger)

# Scrape match score
score_data = scraper_manager.scrape_match_score(match)

# Test scraper
result = scraper_manager.test_scraper('cricbuzz', test_match)

# Update scraper config
result = scraper_manager.update_scraper_config('cricbuzz', {'enabled': False})
```

### Scoring Engine

```python
from automation.orchestrator import ScoringEngine

scoring_engine = ScoringEngine(firebase_client, logger)

# Process match scores
result = scoring_engine.process_match_scores(match)

# Get matches needing processing
matches = scoring_engine.get_matches_needing_processing()
```

## Troubleshooting

### Common Issues

#### 1. WebSocket Connection Failed
**Symptoms:** Error messages about WebSocket connection failures
**Solutions:**
- Ensure port 9222 is not blocked by firewall
- Check if host control app is running
- Verify WebSocket server is started

#### 2. Firebase Connection Issues
**Symptoms:** Errors reading/writing to Firebase
**Solutions:**
- Check `firebase.cert.json` exists and is valid
- Verify environment variables are set
- Test Firebase connectivity

#### 3. Scraper Failures
**Symptoms:** High error rates in scraping
**Solutions:**
- Check API keys are valid
- Verify internet connectivity
- Monitor scraper health in status dashboard
- Adjust scraper priorities or timeouts

#### 4. Match Processing Backlog
**Symptoms:** Matches not being processed promptly
**Solutions:**
- Increase `max_concurrent_score_jobs`
- Check scoring engine status
- Verify scoring calculators are working
- Monitor processing queue length

### Debug Mode

Enable debug mode for detailed logging:

```python
# Via configuration
config_manager.update_automation_config({'debug_mode': True})

# Via environment variable
export DEBUG_MODE=true
```

### Log Analysis

Access logs via:
1. **Debug Window**: Real-time log streaming in host control app
2. **Firebase**: Stored in `automation_logs` collection
3. **Local Files**: Optional file logging

## Performance Optimization

### Recommended Settings

#### High-Performance Setup
```python
config = {
    'max_concurrent_tasks': 5,
    'scraping_interval': 30,      # 30 seconds
    'scoring_interval': 15,       # 15 seconds
    'cache_ttl': 600,             # 10 minutes
    'request_timeout': 15         # 15 seconds
}
```

#### Resource-Constrained Setup
```python
config = {
    'max_concurrent_tasks': 2,
    'scraping_interval': 120,     # 2 minutes
    'scoring_interval': 60,       # 1 minute
    'cache_ttl': 300,             # 5 minutes
    'request_timeout': 30         # 30 seconds
}
```

### Monitoring Metrics

Key metrics to monitor:
- **Task Success Rate**: Should be > 80%
- **Average Response Time**: Should be < 30 seconds
- **Error Rate**: Should be < 20%
- **Queue Length**: Should not grow indefinitely
- **Memory Usage**: Monitor for leaks

## Security Considerations

### API Keys
- Store API keys in environment variables, not in code
- Use Firebase security rules to restrict access
- Rotate keys regularly

### Network Security
- Use HTTPS for all external API calls
- Validate all external data
- Implement rate limiting for API calls

### Data Privacy
- Log sensitive data sparingly
- Encrypt sensitive configuration
- Follow data retention policies

## Development

### Adding New Components

1. Create component class inheriting from base patterns
2. Register with orchestrator
3. Add configuration options
4. Implement status monitoring
5. Add logging and error handling

### Testing

```bash
# Run tests
python -m pytest tests/

# Test specific component
python -m pytest tests/test_scraper_manager.py

# Integration tests
python -m pytest tests/integration/
```

### Contributing

1. Follow existing code patterns
2. Add comprehensive logging
3. Include error handling
4. Update documentation
5. Add tests for new features

## Migration from Basic Scheduler

### Steps to Migrate

1. **Backup Configuration**: Export existing scheduler settings
2. **Install Dependencies**: Install required packages
3. **Update Configuration**: Convert to new configuration format
4. **Test Components**: Verify each component works independently
5. **Switch Over**: Update host control app to use enhanced orchestrator
6. **Monitor**: Watch for issues during transition

### Compatibility

The enhanced orchestrator maintains backward compatibility with existing:
- Firebase data structure
- Scoring calculators
- Host control app IPC handlers
- WebSocket message format

## Support

For issues and questions:
1. Check debug logs and status dashboard
2. Review this documentation
3. Check GitHub issues
4. Contact development team

---

**Version**: 2.0.0  
**Last Updated**: 2026-05-05  
**Author**: Automation Team
