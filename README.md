# OverlayChat

Browser-based audience predictions and live chat for sports streams. The architecture is cleanly split between an audience-facing Web App (React) and a Broadcaster Desktop App (Electron/Python).

## Project Structure

1. **Frontend (Audience Web App)**
   - Located in the `frontend/` directory.
   - Built with **Vite + React (TypeScript)**.
   - Handles the audience-facing views where users join rooms, submit predictions, and use live chat dynamically.
2. **Backend (Electron Broadcaster App & Python Automation)**
   - Located in the `backend/` directory.
   - Electron UI (Control Panel, Overlays) wraps around local HTML files.
   - Python logic (`monitor.py`) handles automated scoring pipelines, data scraping, and analytics syncing.

The data layer uses Firebase Realtime Database with a strict match-centric data model. All live keys are isolated under a `matchId` per room per environment.

## Environment Architecture

OverlayChat heavily isolates local testing from production:
- **Local Environment**: `APP_MODE=local` writes exclusively to the `/local/...` node of your Firebase database. Prevents breaking live deployment matches while developing.
- **Production Environment**: `APP_MODE=prod` writes directly to standard nodes (`/prod/...`).

---

## 💻 Local Development & Testing

You will want to run both the Frontend (Vite) and Backend (Electron) simultaneously to test full-stack features.

### 1. Setup

```bash
# Root dependencies (Electron tools)
npm install

# Frontend dependencies (React project)
cd frontend
npm install
cd ..

# Backend dependencies (Python)
python -m venv venv
venv\Scripts\activate   # (On Windows)
pip install -r backend/requirements.txt
```

### 2. Start the Backend / Broadcaster App

From the root directory, launch the Electron wrapper locally. This runs in Development Mode (`APP_MODE=local`):
```bash
npm start
```
*Tip: To just run the python web server: `npm run start:server`.*

### 3. Start the Audience Frontend
Open a separate terminal, navigate to `frontend/`, and boot the Vite server:
```bash
cd frontend
npm run dev
```
Navigate to `http://localhost:5173`. Make sure the Electron App is open so you can hit "Start New Match" generated to the local DB before attempting to submit predictions.

---

## 🚀 Production Deployment

### 1. Deploy the Audience Web App (Frontend)
We configure a root-level convenience script that packages the Vite build natively and pushes your public directory to Firebase Hosting.

```bash
# From the root directory:
npm run deploy
```
*(This automatically runs `npm run build` inside `/frontend` and triggers `firebase deploy`)*

**Note:** GitHub Actions via `.github/workflows` also automatically trigger this exact deployment sequence on PR merges into main.

### 2. Build the Windows Desktop Execution (Backend)
To create the `.exe` that the actual stream broadcaster will launch locally from their desktop:

```bash
# From the root directory:
npm run dist:win
```

### 3. Running Background Python Automators in Production
If you require running the scraping/calculation engine in production manually from a server:
```bash
# From the root directory:
npm run monitor
```
*(This guarantees `APP_MODE=prod` is injected during startup).*

---

## Keyboard Shortcuts (Desktop App)
- `Ctrl+Shift+X`: toggle interaction click-through for transparent overlays
- `Ctrl+Shift+O`: manually force-open the overlay window
