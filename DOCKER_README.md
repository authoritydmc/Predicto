# Docker Setup Guide - Predicto Backend

## Overview
This guide explains how to build and run the Predicto backend using Docker, including Firebase credentials setup.

## Prerequisites
- Docker installed
- Firebase service account JSON key

## Quick Start

### 1. Prepare Firebase Credentials

**Option A: Environment Variable (Recommended for CI/CD)**
```bash
# Encode your Firebase service account JSON as base64
# Windows PowerShell:
$json = Get-Content "path\to\service-account.json" -Raw
[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json))

# Linux/Mac:
base64 service-account.json | tr -d '\n' > firebase_base64.txt
```

**Option B: File Mount (Recommended for local dev)**
```bash
# Place your service-account.json in backend/ folder
cp path/to/service-account.json backend/firebase-service-account.json
```

### 2. Build Docker Image

```bash
cd backend
docker build -t predicto-backend .
```

### 3. Run Docker Container

**With Environment Variable:**
```bash
docker run -d \
  --name predicto-backend \
  -p 4173:4173 \
  -e FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"..."}' \
  -e APP_MODE=prod \
  predicto-backend
```

**With File Mount:**
```bash
docker run -d \
  --name predicto-backend \
  -p 4173:4173 \
  -v $(pwd)/firebase-service-account.json:/app/firebase-service-account.json \
  -e GOOGLE_APPLICATION_CREDENTIALS=/app/firebase-service-account.json \
  -e APP_MODE=prod \
  predicto-backend
```

### 4. Verify Container is Running

```bash
# Check container status
docker ps

# View logs
docker logs -f predicto-backend

# Test API endpoint
curl http://localhost:4173/api/automation/jobs
```

## Firebase Credentials in Different Environments

### Local Development
```bash
# Copy service account to backend folder
cp ~/Downloads/project-name-firebase-adminsdk.json backend/firebase-key.json

# Run with mounted volume
docker run -d \
  -p 4173:4173 \
  -v $(pwd)/firebase-key.json:/app/firebase-key.json \
  -e GOOGLE_APPLICATION_CREDENTIALS=/app/firebase-key.json \
  predicto-backend
```

### GitHub Actions (CI/CD)
Store the Firebase service account JSON as a GitHub Secret:

1. Go to your GitHub repo → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `FIREBASE_SERVICE_ACCOUNT`
4. Value: Paste the entire JSON content of your service account key

Then in your workflow file (see `.github/workflows/docker-deploy.yml`):
```yaml
- name: Run Docker Container
  run: |
    echo $FIREBASE_SERVICE_ACCOUNT > firebase_temp.json
    docker run -d \
      -p 4173:4173 \
      -e FIREBASE_SERVICE_ACCOUNT="$(cat firebase_temp.json)" \
      predicto-backend
```

### Production Server
```bash
# Create a secure directory for credentials
mkdir -p /opt/predicto/secrets
cp service-account.json /opt/predicto/secrets/firebase.json

# Run with secrets mounted
docker run -d \
  --name predicto-backend \
  -p 4173:4173 \
  -v /opt/predicto/secrets:/secrets:ro \
  -e GOOGLE_APPLICATION_CREDENTIALS=/secrets/firebase.json \
  -e APP_MODE=prod \
  --restart unless-stopped \
  predicto-backend
```

## Docker Compose (Optional)

Create `docker-compose.yml` in the backend folder:

```yaml
version: '3.8'

services:
  backend:
    build: .
    ports:
      - "4173:4173"
    environment:
      - APP_MODE=prod
      - FIREBASE_SERVICE_ACCOUNT=${FIREBASE_SERVICE_ACCOUNT}
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
```

Run with:
```bash
# Set environment variable
export FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'

# Start services
docker-compose up -d

# View logs
docker-compose logs -f
```

## Testing Docker Container

### Run Test Script Inside Container
```bash
# Run automation tests
docker exec overlaychat-backend python test_with_mocks.py

# Run a specific automation script
docker exec overlaychat-backend python -m automation.main live-matches

# Check logs
docker exec overlaychat-backend cat logs/automation.log
```

### Health Check
```bash
# Test if API is responding
curl -f http://localhost:4173/api/automation/jobs || echo "API is down"

# Check container health
docker inspect --format='{{.State.Health.Status}}' overlaychat-backend
```

## Troubleshooting

### Container Exits Immediately
```bash
# Check logs for errors
docker logs overlaychat-backend

# Common issues:
# 1. Firebase credentials not valid
# 2. Port 4173 already in use
# 3. Missing environment variables
```

### Cannot Connect to Firebase
```bash
# Verify credentials are passed correctly
docker exec overlaychat-backend env | grep FIREBASE

# Test Firebase connection
docker exec overlaychat-backend python -c "from firebase_manager import FirebaseManager; fm = FirebaseManager(); print('Firebase OK')"
```

### Port Already in Use
```bash
# Change port mapping
docker run -p 5000:4173 overlaychat-backend

# Or stop existing container
docker stop overlaychat-backend
docker rm overlaychat-backend
```

## Building EXE Instead of Docker

If you want to distribute as EXE instead of Docker:

```bash
cd backend

# Install PyInstaller
pip install pyinstaller

# Build automation.exe
pyinstaller --onefile --name automation \
  --add-data "automation;automation" \
  --add-data "scraper;scraper" \
  --hidden-import firebase_admin \
  --hidden-import croniter \
  automation/main.py

# Build server.exe  
pyinstaller --onefile --name server \
  --add-data "automation;automation" \
  --add-data "scraper;scraper" \
  --hidden-import firebase_admin \
  --hidden-import uvicorn \
  server.py

# Output in dist/ folder
ls dist/
# automation.exe
# server.exe
```

## Files Overview

```
backend/
├── Dockerfile              # Docker image definition
├── server.py              # FastAPI server
├── automation/            # Automation scripts
├── scraper/              # Scraper modules
├── requirements.txt      # Python dependencies
└── logs/                 # Log files (mount as volume)
```

## Next Steps

1. Build the Docker image: `docker build -t predicto-backend .`
2. Run tests: `docker run --rm predicto-backend python test_with_mocks.py`
3. Start production: `docker run -d -p 4173:4173 --name backend predicto-backend`
4. Monitor: `docker logs -f backend`
