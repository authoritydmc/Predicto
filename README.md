# OverlayChat 

A premium sports broadcasting tool for live audience predictions and interactive chat overlays. 

## 🏗️ Architecture
The project is split into two specialized applications:
1.  **Audience App (`/frontend`)**: A React web application for users to join via QR/link and submit predictions.
2.  **Broadcaster App (`/backend`)**: An Electron + React application for the streamer to control the match state, manage overlays, and automate scoring.

---

## 💻 Local Development Guide

### 1. Prerequisites
- **Node.js**: v18+ recommended.
- **Python 3.10+**: For automated scoring scripts.
- **Firebase Project**: You need a Realtime Database instance.

### 2. Initial Setup
Run the following at the repository root to initialize both environments:
```bash
./run.bat  # Select option 4 to clean old artifacts, then follow setups
```
*Note: The management script will automatically prompt you to install dependencies if they are missing.*

### 3. Running the Apps
We recommend using the root **`run.bat`** (Windows) or **`run.sh`** (Mac/Linux) as it manages all cross-app dependencies.

*   **Option 1: Start Host App**
    *   Launches the Electron Broadcaster UI and the Vite dev server for its React components.
    *   *Note: Ensure your `backend/desktop/assets/firebase-config.js` is set up.*
*   **Option 2: Start Audience App**
    *   Launches the React web server at `localhost:5173`.
*   **Both**: You will usually want both running to test end-to-end.

---

## 🚀 Deployment Guide

### 1. Deploying the Audience Web App
The Audience App must be hosted on Firebase to be accessible via the internet.
1. Ensure `frontend/src/firebase/config.ts` has your production keys.
2. Run `./run.bat` and select **Option 3 (Deploy Production)**.
3. This process builds the frontend, moves the bundle to the backend's deployment folder, and triggers `firebase deploy`.

### 2. Distributing the Broadcaster App
To create a standalone `.exe` for yourself or other broadcasters:
1. Navigate to `backend/`.
2. Run `npm run dist:win`.
3. Find your installer in `backend/dist/OverlayChat Setup 1.0.9.exe`.

---

## ⚙️ How it Works (Match-Centric Model)
- **Room ID**: A unique string (e.g., `ipl2026`) that defines a broadcaster's channel.
- **Match ID**: Generated when you click "Start New Match" in the Control Panel. 
- **Data Isolation**: Once a match starts, all chat and predictions are stored under that specific Match ID. This allows you to resolve results and save history without clearing the entire room's database.

## ⌨️ Hotkeys
- `Ctrl+Shift+X`: Toggle Overlay Click-Through (Interact vs. View mode).
- `Ctrl+Shift+O`: Force Show/Focus Overlay window.
