# Predicto

A premium sports prediction platform for live audience predictions and interactive scoring. 

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
- **Firebase Service Account Key**: For Python automation scripts (see setup below).

### 2. Initial Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   - Copy `.env.example` to `.env` in both `frontend/` and `backend/` directories
   - Fill in your Firebase configuration values
   ```bash
   cp frontend/.env.example frontend/.env
   cp backend/.env.example backend/.env
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

## Environment Variables

### Frontend (frontend/.env)
- `VITE_FIREBASE_API_KEY` - Firebase API key
- `VITE_FIREBASE_AUTH_DOMAIN` - Firebase auth domain
- `VITE_FIREBASE_DATABASE_URL` - Firebase database URL
- `VITE_FIREBASE_PROJECT_ID` - Firebase project ID
- `VITE_FIREBASE_STORAGE_BUCKET` - Firebase storage bucket
- `VITE_FIREBASE_MESSAGING_SENDER_ID` - Firebase messaging sender ID
- `VITE_FIREBASE_APP_ID` - Firebase app ID
- `VITE_FIREBASE_MEASUREMENT_ID` - Firebase measurement ID

### Backend (backend/.env)
- `FIREBASE_API_KEY` - Firebase API key
- `FIREBASE_AUTH_DOMAIN` - Firebase auth domain
- `FIREBASE_DATABASE_URL` - Firebase database URL
- `FIREBASE_PROJECT_ID` - Firebase project ID
- `FIREBASE_STORAGE_BUCKET` - Firebase storage bucket
- `FIREBASE_SERVICE_ACCOUNT_KEY` - Path to Firebase service account JSON file (for Python scripts)
- `APP_MODE` - Application mode (prod/local)
- `NODE_ENV` - Node environment (production/development)

### 4. Python Setup for Automation Scripts

The project includes Python automation scripts for automated match scoring. These scripts use the Firebase Admin SDK for secure database access.

#### Setting Up Firebase Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Navigate to **Project Settings** > **Service Accounts**
4. Click **Generate New Private Key**
5. Download the JSON file and rename it to `firebase-service-account.json`
6. Place it in the project root directory (same level as `.env`)
7. Add the path to your `.env` file:
   ```
   FIREBASE_SERVICE_ACCOUNT_KEY=firebase-service-account.json
   ```

**⚠️ IMPORTANT**: Never commit the service account key file to git. It's already in `.gitignore`.

#### Setting Up Python Virtual Environment

```bash
# Create virtual environment (from project root)
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install Python dependencies
pip install -r backend/requirements.txt
```

The virtual environment is pre-configured in `.gitignore` so it won't be committed.

### 3. Running the Apps
We recommend using the root **`run.bat`** (Windows) or **`run.sh`** (Mac/Linux) as it manages all cross-app dependencies.

*   **Option 1: Start Host App**
    *   Launches the Electron Broadcaster UI and the Vite dev server for its React components.
    *   *Note: Ensure your `backend/desktop/assets/firebase-config.js` is set up.*
*   **Option 2: Start Audience App**
    *   Launches the React web server at `localhost:5173`.
*   **Both**: You will usually want both running to test end-to-end.

---

## ⚙️ Configuration

### Environment Modes
The app supports two environment modes:
- **Local** (`appMode=local`): Development mode with open Firebase permissions
- **Production** (`appMode=prod`): Production mode with Firebase authentication

Set the mode via:
- URL parameter: `?appMode=local` or `?appMode=prod`
- Environment variable: `APP_MODE=local` or `APP_MODE=prod`

### URL Configuration
Both local and production URLs can be configured via the Electron preload script.

**Local URL** (for development):
- Default: `http://localhost:5173`
- Configure via: `window.PREDICTO_LOCAL_URL`

**Production URL** (for production):
- Default: `https://vrccim.com`
- Configure via: `window.PREDICTO_PROD_URL`

To set custom URLs, modify the preload script in `backend/desktop/preload.cjs`:
```javascript
contextBridge.exposeInMainWorld('predictoDesktop', {
  // ... other properties
  PREDICTO_LOCAL_URL: 'http://localhost:3000',  // if your frontend runs on port 3000
  PREDICTO_PROD_URL: 'https://yourdomain.com'
});
```

### Firebase Configuration
Update Firebase config in `backend/src/firebase/db.ts`:
```typescript
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};
```

### Firebase Database Schema
The database is organized by environment and sport:
```
/
├── local/              # Development environment
│   ├── tournaments/
│   │   └── [sport]/
│   │       └── [tournamentId]/
│   │           ├── meta
│   │           ├── predictions
│   │           ├── chat
│   │           ├── reactions
│   │           ├── history
│   │           ├── innings_history
│   │           └── season_leaderboard
│   ├── discovery/
│   ├── users/
│   └── active_sessions/
└── prod/               # Production environment
    └── (same structure)
```

### Firebase Security Rules
- **Local**: Open read/write for development
- **Production**: 
  - Public read for predictions, chat, reactions
  - Authenticated write for predictions, chat, reactions
  - Admin-only write for meta, history, innings_history, season_leaderboard, discovery
  - Users can only read/write their own user profiles

To deploy updated rules:
```bash
cd backend
npx firebase-tools deploy --only database:rules
```

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
3. Find your installer in `backend/dist/Predicto Setup 1.0.9.exe`.

---

## ⚙️ How it Works (Match-Centric Model)
- **Room ID**: A unique string (e.g., `ipl2026`) that defines a broadcaster's channel.
- **Match ID**: Generated when you click "Start New Match" in the Control Panel. 
- **Data Isolation**: Once a match starts, all chat and predictions are stored under that specific Match ID. This allows you to resolve results and save history without clearing the entire room's database.

## ⌨️ Hotkeys
- `Ctrl+Shift+X`: Toggle Overlay Click-Through (Interact vs. View mode).
- `Ctrl+Shift+O`: Force Show/Focus Overlay window.
