# Repository Architecture - Predicto

## Overview

Predicto is a full-stack sports prediction platform that provides live cricket and football scores with prediction capabilities. It features:

- **Real-time score scraping** from multiple sources (Cricbuzz, Google, CricAPI)
- **Prediction system** where users can predict match outcomes
- **Leaderboard** tracking user prediction accuracy
- **Overlay mode** for streaming/casting scenarios
- **Desktop host app** via Electron for easy deployment
- **Firebase integration** for auth, database, and hosting

---

## Directory Structure

```
Predicto/
├── backend/                    # Python FastAPI backend
│   ├── server.py              # FastAPI server (serves frontend static files)
│   ├── scraper/              # Score scraping modules
│   │   ├── base/            # Base classes for scrapers
│   │   ├── cricket/         # Cricket scrapers (Cricbuzz, etc.)
│   │   ├── football/        # Football scrapers
│   │   └── utils/          # Shared utilities
│   ├── automation/          # Automation & scheduling system
│   │   ├── config/         # Configuration files
│   │   ├── cron/           # Cron job management
│   │   ├── matches/        # Match scheduling & status
│   │   ├── scoring/        # Leaderboard & scoring
│   │   └── scraper/        # Scraper runner for automation
│   ├── tests/              # Backend test suite
│   └── logs/               # Runtime logs (gitignored)
│
├── frontend/                  # React + TypeScript + Vite frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   │   ├── Admin/     # Admin dashboard
│   │   │   ├── Auth/      # Authentication
│   │   │   ├── Chat/      # AI chat interface
│   │   │   ├── Leaderboard/ # Leaderboard display
│   │   │   ├── Prediction/ # Match prediction UI
│   │   │   └── ui/        # Reusable UI components
│   │   ├── contexts/       # React contexts (Firebase, Auth)
│   │   ├── hooks/          # Custom React hooks
│   │   ├── firebase/      # Firebase configuration
│   │   └── types/         # TypeScript type definitions
│   ├── public/             # Static assets
│   │   └── team-logos/    # Sports team logos
│   └── dist/              # Build output (gitignored)
│
├── host-app/                 # Electron desktop wrapper
│   ├── main.cjs           # Electron main process
│   ├── preload.cjs        # Preload script for security
│   ├── assets/            # App icons/assets
│   └── modules/          # Electron modules
│
├── .agents/                 # AI agent skills (opencode)
├── .github/                # GitHub workflows & CI/CD
│   └── workflows/         # Automation workflows
│
├── .firebase/              # Firebase deployment config
├── venv/                  # Python virtual env (gitignored)
└── .env                   # Environment variables (gitignored)
```

---

## Technology Stack

### Backend
- **Python 3.13+**
- **FastAPI** - Web server framework
- **BeautifulSoup4** - HTML parsing for scrapers
- **Firebase Admin SDK** - Backend Firebase integration

### Frontend
- **React 19** - UI framework
- **TypeScript** - Type-safe JavaScript
- **Vite** - Build tool & dev server
- **React Router DOM 7** - Client-side routing
- **Firebase JS SDK 12** - Auth, Firestore, Hosting

### Desktop App
- **Electron 28** - Desktop app framework
- **electron-builder** - Packaging & distribution

### External Services
- **Firebase** - Auth, Firestore, Hosting, Cloud Functions
- **Cricbuzz** - Primary cricket score source
- **Google** - Secondary cricket score source
- **CricAPI** - Tertiary cricket score source

---

## Key Components

### 1. Score Scraping System (`backend/scraper/`)

**Purpose**: Fetches live cricket/football scores from multiple sources.

**Architecture**:
```
ScraperManager
    ├── CricbuzzScraper (primary)
    ├── GoogleScraper (secondary)
    └── CricAPIScraper (tertiary)
```

**Key Files**:
- `backend/scraper/cricket/cricbuzz_scraper.py` - Main cricket scraper
- `backend/scraper/base/base_cricket.py` - Base class with common logic
- `backend/scraper/manager.py` - Manages multiple scraper sources

**Usage**:
```python
from scraper.manager import ScraperManager
manager = ScraperManager(['cricbuzz', 'google', 'cricapi'])
result = manager.get_score('cricket', match_url='https://cricbuzz.com/...')
```

### 2. Automation System (`backend/automation/`)

**Purpose**: Scheduled tasks for match monitoring, scoring, and notifications.

**Components**:
- `cron/manager.py` - Cron job scheduler
- `matches/scheduler.py` - Match scheduling & status updates
- `scoring/calculator.py` - Calculate user prediction scores
- `scoring/leaderboard.py` - Update leaderboard rankings

### 3. Frontend App (`frontend/`)

**Purpose**: User interface for predictions, leaderboard, and chat.

**Key Pages** (in `frontend/src/components/`):
- **Prediction/** - Users predict match outcomes
- **Leaderboard/** - View prediction rankings
- **Admin/** - Admin dashboard for managing matches
- **Chat/** - AI-powered chat with match context
- **Auth/** - Login/registration via Firebase Auth

**Routing**: Handled by React Router in `frontend/src/App.tsx`

### 4. Desktop Host App (`host-app/`)

**Purpose**: Electron wrapper to run the app as a desktop application.

**Entry Points**:
- `main.cjs` - Electron main process (creates browser window)
- `preload.cjs` - Secure bridge between Electron and web content

---

## Data Flow

### Live Score Updates
```
1. Cron job triggers (every X minutes)
   ↓
2. ScraperManager fetches scores from Cricbuzz
   ↓
3. If Cricbuzz fails → try Google → then CricAPI
   ↓
4. Parse match data (teams, scores, status)
   ↓
5. Update Firebase Firestore with new scores
   ↓
6. Frontend receives real-time update via Firebase listener
```

### User Prediction Flow
```
1. User logs in (Firebase Auth)
   ↓
2. User selects match & prediction (Prediction component)
   ↓
3. Prediction saved to Firestore
   ↓
4. Match completes → Automation scores predictions
   ↓
5. Leaderboard updated (scoring/calculator.py)
   ↓
6. User sees updated rank on Leaderboard page
```

---

## How to Run

### Backend (Python FastAPI)
```bash
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1  # Windows
pip install -r requirements.txt
python server.py
# Server runs at http://localhost:4173
```

### Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
# Dev server at http://localhost:5173
```

### Desktop App (Electron)
```bash
cd host-app
npm install
npm start
```

---

## Common Tasks for LLMs

### Fix a Scraper Issue (e.g., Cricbuzz status detection)
1. Read `backend/scraper/cricket/cricbuzz_scraper.py`
2. Understand `_extract_match_data()` method (lines ~220-355)
3. Look for status detection logic (search for "match_status")
4. Test changes:
   ```bash
   cd backend
   python -c "from scraper.cricket.cricbuzz_scraper import CricbuzzScraper; ..."
   ```

### Add a New Sports Scraper
1. Create new file in `backend/scraper/cricket/` or `football/`
2. Inherit from `BaseCricketScraper` or `BaseFootballScraper`
3. Implement `get_score()` method
4. Register in `backend/scraper/manager.py`

### Update Frontend Component
1. Find component in `frontend/src/components/`
2. Edit `.tsx` file
3. Test with `npm run dev` in `frontend/`
4. Build with `npm run build`

### Modify Automation Cron Jobs
1. Edit `backend/automation/cron/manager.py`
2. Update schedule in `backend/automation/config/settings.py`
3. Test with `python -m automation.cron.manager`

---

## Important Files Reference

| File | Purpose |
|------|---------|
| `backend/server.py` | FastAPI server entry point |
| `backend/scraper/cricket/cricbuzz_scraper.py` | Primary cricket scraper |
| `backend/scraper/base/base_cricket.py` | Base class with `CricketScoreData` dataclass |
| `backend/automation/config/settings.py` | Automation configuration |
| `backend/automation/cron/manager.py` | Cron job scheduler |
| `frontend/src/App.tsx` | React router & main app component |
| `frontend/src/firebase/config.ts` | Firebase initialization |
| `host-app/main.cjs` | Electron main process |
| `.github/workflows/*.yml` | CI/CD automation workflows |

---

## Environment Variables (.env)

```bash
# Firebase
FIREBASE_API_KEY=...
FIREBASE_AUTH_DOMAIN=...
FIREBASE_PROJECT_ID=...

# Backend
APP_MODE=dev|prod|local
PORT=4173

# Scraper API Keys (if using CricAPI)
CRICAPI_KEY=...
```

---

## Testing

### Backend Tests
```bash
cd backend
python -m pytest tests/
python run_tests.py
```

### Frontend Tests
```bash
cd frontend
npm run lint
npm run test  # if configured
```

---

## Deployment

### Firebase Hosting (Frontend + Backend)
```bash
firebase login
firebase init hosting
firebase deploy
```

### Desktop App (Electron)
```bash
cd host-app
npm run build-win    # Windows
npm run build-mac    # macOS
npm run build-linux  # Linux
```

---

## Common Issues & Fixes

### Scraper returns wrong match status
- Check `backend/scraper/cricket/cricbuzz_scraper.py`
- Look for `match_status` assignment logic
- Ensure completion indicators are checked before live indicators
- See commit `e1c3ec0` for example fix

### Frontend can't connect to backend
- Verify CORS settings in `backend/server.py`
- Check `APP_MODE` environment variable
- Ensure Firebase config matches project

### Python dependencies issues
- Delete `venv/` and recreate: `python -m venv venv`
- Update `requirements.txt`: `pip freeze > requirements.txt`

---

## Contributing

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes & test
3. Commit with descriptive message
4. Push & create PR

**Commit Message Format**:
```
<type>: <subject>

<body>

- Detail 1
- Detail 2
```

**Types**: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`
