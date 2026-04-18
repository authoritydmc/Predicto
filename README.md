# OverlayChat

Browser-based audience predictions and live chat for sports streams. The architecture is cleanly split between an audience-facing Web App (React) and a Broadcaster Desktop App (Electron/Python).

## Project Structure

1. **Frontend (Audience Web App)**
   - Located in the `frontend/` directory.
   - Built with **Vite + React (TypeScript)**.
   - Handles the audience-facing views where users join rooms, submit predictions, and use live chat dynamically.
2. **Backend (Electron Broadcaster App & Python Automation)**
   - Located in the `backend/` directory.
   - Contains the core logic, Electron UI, and automated scoring pipelines.

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
# Frontend dependencies (React project)
cd frontend
npm install

# Backend dependencies (Electron tools & Python)
cd ../backend
npm install
python -m venv venv
venv\Scripts\activate   # (On Windows)
pip install -r requirements.txt
```

### 2. Start the Backend / Broadcaster App

From the `backend/` directory, launch the Electron wrapper locally. This runs in Development Mode (`APP_MODE=local`):
```bash
cd backend
npm start
```

### 3. Start the Audience Frontend
Open a separate terminal, navigate to `frontend/`, and boot the Vite server:
```bash
cd frontend
npm run dev
```

---

## 🚀 Production Deployment

### 1. Deploy the Audience Web App (Frontend)
Use the convenience script inside the `backend/` directory to build and deploy everything.

```bash
cd backend
npm run deploy
```
*(This automatically builds the React frontend and triggers Firebase Host deployment)*

### 2. Build the Windows Desktop Execution (Backend)
To create the `.exe` for the broadcaster:

```bash
cd backend
npm run dist:win
```

### 3. Running Background Python Automators in Production
```bash
cd backend
npm run monitor
```

---

## Keyboard Shortcuts (Desktop App)
- `Ctrl+Shift+X`: toggle interaction click-through for transparent overlays
- `Ctrl+Shift+O`: manually force-open the overlay window
