# OverlayChat


## Frontend Setup & Run (Desktop App)

The desktop app is an Electron wrapper around the hosted overlay and the backend server. Run these commands from the root directory:

```bash
# Install dependencies for the Electron app and local startup tooling
npm install

# Run the local backend server and desktop host together in development/local mode
npm start
```

The Electron app decides mode from environment variables:
- `APP_MODE=local` or `NODE_ENV=development` => app mode is `local`/`dev`
- otherwise => app mode is `prod`

For a production Electron build without the local startup server:

```bash
npm run start:prod
```

### Build a Windows `.exe`

```bash
npm run dist:win
```

Keyboard shortcuts inside the desktop app:
- `Ctrl+Shift+X`: toggle click-through
- `Ctrl+Shift+O`: show overlay window

## Backend Setup & Run (Python Automation)

The backend handles scraping real-time matches from Cricbuzz, scoring the predictions, and pushing updates to Firebase. 

**Note:** The backend monitor requires a `.env` file containing secrets (`FIREBASE_SERVICE_ACCOUNT`, `DISCORD_WEBHOOK_URL`, `FIREBASE_ROOM`).

```bash
# Navigate to the backend directory
cd backend

# Create a virtual environment and load it (Windows format shown)
python -m venv venv
venv\Scripts\activate

# Install the Python dependencies (FastAPI, Firebase, Requests)
pip install -r requirements.txt

# --- RUNNING THE SERVICES ---

# 1. Run the local static server (to test the HTML UI locally at http://localhost:4173)
python server.py

# 2. Run the live match monitor for prediction automation
python monitor.py
```

## Firebase

The current Firebase project is `indusind-5529e`. Realtime Database rules are currently configured for testing prototypes in `database.rules.json`.

## Hosted Web URLs

If building and deploying standard web routes:
- Host: `https://indusind-5529e.web.app/host.html?room=ipl-main`
- Audience: `https://indusind-5529e.web.app/index.html?room=ipl-main`
- Overlay: `https://indusind-5529e.web.app/overlay.html?room=ipl-main`

## Recommended Next Steps

Before you put this in front of a real audience, verify:
- Firebase Anonymous Auth write limits
- Chat moderation layers
- Appropriate logging outputs in `monitor.py`
