# OverlayChat

Browser-based audience predictions and live chat for sports streams. Viewers open a public URL, submit their score prediction and winner pick, and chat in real time. The overlay page can be used directly as a browser source, and the repo now also includes a Windows desktop overlay app.

The project is thoughtfully structured into a `frontend/` containing the UI components and a `backend/` containing a Python-based automation scraper and static file server.

## Project Structure

- `frontend/`: Contains the pre-built web assets (HTML/JS/CSS).
  - `index.html`: Audience page for predictions and chat.
  - `overlay.html`: Browser-based stream overlay.
  - `host.html`: Host controls for match setup and room reset.
  - `desktop/`: Windows Desktop App wrapper (Electron).
- `backend/`: Contains the Python automation logic and API/Static server.
  - `monitor.py`: The live scraper and Match monitoring logic for automation.
  - `scoring.py`: The calculation engine for points allocation.
  - `server.py`: A FastAPI endpoint for serving the frontend static files.
  - `requirements.txt`: Python package requirements.

## Frontend Setup & Run (Desktop App)

The desktop app is an Electron wrapper around the hosted overlay. Run these commands from the root directory:

```bash
# Install dependencies for the Electron app
npm install

# Run the desktop app locally
npm run start
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
