# Building EXE for Python Automation Scripts

## Using PyInstaller

### 1. Install PyInstaller
```bash
cd backend
pip install pyinstaller
```

### 2. Build EXE for Automation Main
```bash
# Build single EXE file
pyinstaller --onefile --name automation ^
  --add-data "automation;automation" ^
  --add-data "scraper;scraper" ^
  --hidden-import firebase_admin ^
  --hidden-import croniter ^
  --hidden-import bs4 ^
  automation/main.py
```

### 3. Build EXE for Server (Host App will spawn this)
```bash
pyinstaller --onefile --name server ^
  --add-data "automation;automation" ^
  --add-data "scraper;scraper" ^
  --hidden-import firebase_admin ^
  --hidden-import uvicorn ^
  server.py
```

### 4. Output
- EXE files will be in `backend/dist/`
- `automation.exe` - Single entry point for all automation scripts
- `server.exe` - FastAPI server for host app to manage jobs

## How Automation Works in EXE Mode

### Option 1: Host App spawns Python EXE
```javascript
// In Electron main process
const { spawn } = require('child_process');

// Start automation scheduler
const automation = spawn('path/to/automation.exe', ['scheduler', 'start']);

// Run a specific script
const runJob = (jobName) => {
  spawn('path/to/automation.exe', ['run', jobName]);
};
```

### Option 2: Host App calls API (Server EXE)
```javascript
// Start server EXE
const server = spawn('path/to/server.exe');

// Server starts API at http://localhost:4173
// Host app uses API endpoints:
// - GET /api/automation/jobs
// - PUT /api/automation/jobs/{id}
// - POST /api/automation/jobs/{id}/run
```

## Docker Deployment

### Build Docker Image
```bash
cd backend
docker build -t overlaychat-backend .
```

### Run Docker Container
```bash
docker run -d \
  --name overlaychat-backend \
  -p 4173:4173 \
  -e FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}' \
  -e APP_MODE=prod \
  overlaychat-backend
```

## Architecture in Production

```
┌─────────────────────┐
│                        Host Machine                          │
│  ┌──────────────┐      ┌──────────────────┐              │
│  │  Host App   │      │  Backend Docker  │              │
│  │  (Electron)  │─────>│  (FastAPI +      │              │
│  │              │      │   Automation)     │              │
│  └──────────────┘      └──────────────────┘              │
│       │                      │                              │
│       │ API calls          │ Python scripts                 │
│       v                      v                              │
│  (Manage jobs, view logs)  (Run automation tasks)       │
└─────────────────────┘
```

## Files to Distribute

### For Host App (Admin):
- `host-app/` - Electron app (TSX)
- `backend/dist/server.exe` - FastAPI server (optional, can use Docker)
- `backend/dist/automation.exe` - Automation scripts

### For Audience (Frontend):
- `frontend/dist/` - Static files (deploy to Firebase Hosting)
