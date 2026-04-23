# Firebase Database Schema Documentation

## Overview

This document describes the Firebase Realtime Database schema used by OverlayChat, a sports prediction platform. The schema is designed to support multiple environments (local/production), multiple sports, multiple tournaments, and multiple matches per tournament with proper data isolation and security.

## Environment-Based Routing

The database is organized into two top-level environments:

- **`local`**: Development environment with open permissions for testing
- **`prod`**: Production environment with authentication and admin controls

### Environment Selection

The environment is determined by the `appMode` URL parameter:
- `?appMode=local` → Uses `local` environment
- `?appMode=prod` or no parameter → Uses `prod` environment (default)

### Implementation

```typescript
// backend/src/firebase/db.ts
export const getDbRoot = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get("appMode") || "prod";
  return mode === "local" ? "local" : "prod";
};
```

## Database Structure

```
/
├── local/                                    # Development Environment
│   ├── tournaments/
│   │   └── [sport]/                          # e.g., cricket, football
│   │       └── [tournamentId]/               # e.g., ipl-2024, epl-2024
│   │           ├── meta/                      # Tournament-level defaults
│   │           ├── matches/                   # Match-specific data
│   │           │   └── [matchId]/            # e.g., csk-vs-mi, rcb-vs-kkr-2024-04-23
│   │           │       ├── meta/              # Match-specific overrides
│   │           │       ├── predictions/       # Match predictions
│   │           │       ├── chat/              # Match chat
│   │           │       ├── reactions/         # Match reactions
│   │           │       ├── history/           # Match archived results
│   │           │       └── innings_history/   # Match innings data
│   │           ├── leaderboard/               # Tournament standings
│   │           ├── users/                     # Tournament user profiles
│   │           ├── predictions/               # Legacy (deprecated)
│   │           ├── chat/                      # Legacy (deprecated)
│   │           ├── reactions/                 # Legacy (deprecated)
│   │           ├── history/                   # Legacy (deprecated)
│   │           ├── innings_history/           # Legacy (deprecated)
│   │           └── season_leaderboard/       # Legacy (deprecated)
│   ├── discovery/
│   │   ├── matches/                          # Match code → match details
│   │   ├── tournaments/                      # Tournament code → tournament details
│   │   └── [roomId]/                         # Legacy discovery (deprecated)
│   ├── users/                                # Global user profiles
│   └── active_sessions/                      # Active broadcaster sessions
└── prod/                                     # Production Environment
    └── (same structure as local)
```

## Key Design Principles

### 1. Multi-Match Tournament Support
Each tournament (e.g., IPL 2024) can contain multiple matches (70+ matches). Each match has its own:
- Metadata (can override tournament defaults)
- Predictions
- Chat
- History
- Innings data

### 2. Meta Hierarchy
- **Tournament meta**: Default settings for all matches in the tournament
- **Match meta**: Per-match overrides (takes precedence)
- Frontend merges both for final configuration

### 3. Discovery Layer
- **Match discovery**: Room code → specific match (direct join)
- **Tournament discovery**: Tournament code → list of all matches (browse & select)

### 4. Match ID Format
Team-based, simple to input: `teamA-vs-teamB` or `teamA-vs-teamB-date`
- Examples: `csk-vs-mi`, `rcb-vs-kkr-2024-04-23`
- URL-friendly, easy to remember

## Schema Nodes

### 1. Discovery Layer (`/discovery`)

**Purpose**: Maps codes to tournament/match context for easy join URLs.

#### Match Discovery (`/discovery/matches`)
**Structure**:
```
/discovery/matches/{matchCode}
```

**Data Example**:
```json
{
  "sport": "cricket",
  "tournamentId": "ipl-2024",
  "matchId": "csk-vs-mi",
  "updatedAt": 1713868800000
}
```

**Usage**:
- Frontend: Resolves match code to specific match for direct join
- Backend: Sets match discovery when creating a match

**Security**:
- Local: Read/Write open
- Production: Read open, Write requires admin

#### Tournament Discovery (`/discovery/tournaments`)
**Structure**:
```
/discovery/tournaments/{tournamentCode}
```

**Data Example**:
```json
{
  "sport": "cricket",
  "tournamentId": "ipl-2024",
  "updatedAt": 1713868800000
}
```

**Usage**:
- Frontend: Resolves tournament code to show all matches in tournament
- Backend: Sets tournament discovery when creating a tournament

**Security**:
- Local: Read/Write open
- Production: Read open, Write requires admin

#### Legacy Discovery (`/discovery/{roomId}`)
**Deprecated**: Kept for backward compatibility during migration.

---

### 2. Tournament Meta (`/tournaments/{sport}/{tournamentId}/meta`)

**Purpose**: Stores tournament-level default settings.

**Structure**:
```
/tournaments/{sport}/{tournamentId}/meta
```

**Data Example**:
```json
{
  "tournamentName": "IPL 2024",
  "defaultPredictionSort": "newest",
  "defaultHideChat": false,
  "defaultHideJoin": false,
  "updatedAt": 1713868800000
}
```

**Fields**:
- `tournamentName`: Display name of the tournament
- `defaultPredictionSort`: Default sort order for matches
- `defaultHideChat`: Default chat visibility
- `defaultHideJoin`: Default join visibility
- `updatedAt`: Last update timestamp

**Security**:
- Local: Read/Write open
- Production: Read open, Write requires admin

---

### 3. Match Meta (`/tournaments/{sport}/{tournamentId}/matches/{matchId}/meta`)

**Purpose**: Stores match-specific configuration (can override tournament defaults).

**Structure**:
```
/tournaments/{sport}/{tournamentId}/matches/{matchId}/meta
```

**Data Example**:
```json
{
  "matchTitle": "CSK vs MI - Match 15",
  "teamA": "Chennai Super Kings",
  "teamB": "Mumbai Indians",
  "secondInnings": false,
  "disableScoreA": false,
  "disableScoreB": true,
  "predictionsPaused": false,
  "allowReprediction": true,
  "predictionSort": "newest",
  "hideChat": false,
  "hideJoin": false,
  "automationPaused": false,
  "showWinProb": false,
  "googleMatchUrl": "",
  "updatedAt": 1713868800000
}
```

**Fields**:
- `matchTitle`: Display name of the match
- `teamA`, `teamB`: Team names
- `secondInnings`: Boolean, indicates if in 2nd innings
- `disableScoreA`, `disableScoreB`: Disable score input for respective teams
- `predictionsPaused`: Stop accepting new predictions
- `allowReprediction`: Allow users to update predictions
- `predictionSort`: Sort order for predictions (`newest` or `score`)
- `hideChat`, `hideJoin`: UI visibility controls
- `automationPaused`: Stop automated scoring
- `showWinProb`: Display win probability overlay
- `googleMatchUrl`: URL for win probability fetching

**Security**:
- Local: Read/Write open
- Production: Read open, Write requires admin

---

### 3.1. Match Live Score (`/tournaments/{sport}/{tournamentId}/matches/{matchId}/live_score`)

**Purpose**: Stores live match score data for real-time display.

**Structure**:
```
/tournaments/{sport}/{tournamentId}/matches/{matchId}/live_score
```

**Data Example (Cricket)**:
```json
{
  "teamA": {
    "runs": 145,
    "wickets": 2,
    "overs": 18.3,
    " battingTeam": true
  },
  "teamB": {
    "runs": 0,
    "wickets": 0,
    "overs": 0,
    "battingTeam": false
  },
  "currentInnings": 1,
  "matchStatus": "live",
  "lastUpdated": 1713868800000,
  "source": "manual"
}
```

**Data Example (Football)**:
```json
{
  "teamA": {
    "goals": 2,
    "battingTeam": false
  },
  "teamB": {
    "goals": 1,
    "battingTeam": true
  },
  "matchTime": "67",
  "matchStatus": "live",
  "lastUpdated": 1713868800000,
  "source": "scraper"
}
```

**Fields**:
- `teamA`, `teamB`: Team-specific score data
  - Cricket: `runs`, `wickets`, `overs`, `battingTeam`
  - Football: `goals`, `battingTeam`
- `currentInnings`: Current innings number (cricket)
- `matchTime`: Current match time in minutes (football)
- `matchStatus`: `live`, `completed`, `scheduled`, `abandoned`
- `lastUpdated`: Timestamp of last score update
- `source`: `manual`, `scraper`, `api`

**Security**:
- Local: Read/Write open
- Production: Read open, Write requires admin

### 4. Match Predictions (`/tournaments/{sport}/{tournamentId}/matches/{matchId}/predictions`)

**Purpose**: Stores user predictions for a specific match.

**Structure**:
```
/tournaments/{sport}/{tournamentId}/matches/{matchId}/predictions/{clientId}
```

**Data Example**:
```json
{
  "userId": "c-abc123",
  "name": "John Doe",
  "predictedWinner": "chennai super kings",
  "scoreA": "185",
  "scoreB": "180",
  "sportType": "cricket",
  "updatedAt": 1713868800000
}
```

**Fields**:
- `userId`: Unique client identifier
- `name`: Display name
- `predictedWinner`: Team user thinks will win
- `scoreA`, `scoreB`: Predicted scores
- `sportType`: Sport category
- `updatedAt`: Last update timestamp

**Security**:
- Local: Read/Write open
- Production: Read open, Write requires authentication

---

### 5. Match Chat (`/tournaments/{sport}/{tournamentId}/matches/{matchId}/chat`)

**Purpose**: Real-time chat messages for a specific match.

**Structure**:
```
/tournaments/{sport}/{tournamentId}/matches/{matchId}/chat/{messageId}
```

**Data Example**:
```json
{
  "name": "John Doe",
  "message": "Great match!",
  "clientId": "c-abc123",
  "createdAt": 1713868800000
}
```

**Fields**:
- `name`: Display name of sender
- `message`: Chat content
- `clientId`: Sender's client ID
- `createdAt`: Message timestamp

**Security**:
- Local: Read/Write open
- Production: Read open, Write requires authentication

---

### 6. Match Reactions (`/tournaments/{sport}/{tournamentId}/matches/{matchId}/reactions`)

**Purpose**: User emoji reactions for a specific match (future feature).

**Structure**:
```
/tournaments/{sport}/{tournamentId}/matches/{matchId}/reactions/{reactionId}
```

**Security**:
- Local: Read/Write open
- Production: Read open, Write requires authentication

---

### 7. Match History (`/tournaments/{sport}/{tournamentId}/matches/{matchId}/history`)

**Purpose**: Archived match results for historical reference.

**Structure**:
```
/tournaments/{sport}/{tournamentId}/matches/{matchId}/history/{dateKey}
```

**Data Example**:
```json
{
  "matchTitle": "CSK vs MI - Match 15",
  "teamA": "Chennai Super Kings",
  "teamB": "Mumbai Indians",
  "innings1": {
    "john": { "name": "John", "points": 150, "guess": "185", "isExact": false },
    "jane": { "name": "Jane", "points": 200, "guess": "185", "isExact": true }
  },
  "innings2": {
    "john": { "name": "John", "points": 120, "guess": "18.2", "isExact": false },
    "jane": { "name": "Jane", "points": 180, "guess": "18.1", "isExact": false }
  },
  "finalStandings": [
    { "name": "Jane", "p1Score": 200, "p2Score": 180, "penalty": 0, "total": 380 },
    { "name": "John", "p1Score": 150, "p2Score": 120, "penalty": 0, "total": 270 }
  ],
  "matchResults": {
    "actual1st": 185,
    "actual2nd": "18.1",
    "actualWinner": "chennai super kings"
  },
  "archivedAt": 1713868800000
}
```

**Security**:
- Local: Read/Write open
- Production: Read open, Write requires admin

---

### 8. Match Innings History (`/tournaments/{sport}/{tournamentId}/matches/{matchId}/innings_history`)

**Purpose**: Temporary storage for innings-wise results during match.

**Structure**:
```
/tournaments/{sport}/{tournamentId}/matches/{matchId}/innings_history/{inningsKey}
```

**Data Example**:
```json
{
  "john": { "name": "John", "points": 150, "guess": "185", "isExact": false },
  "jane": { "name": "Jane", "points": 200, "guess": "185", "isExact": true }
}
```

**Security**:
- Local: Read/Write open
- Production: Read open, Write requires admin

---

### 9. Tournament Leaderboard (`/tournaments/{sport}/{tournamentId}/leaderboard`)

**Purpose**: Aggregated standings across all matches in a tournament.

**Structure**:
```
/tournaments/{sport}/{tournamentId}/leaderboard
```

**Data Example**:
```json
{
  "standings": [
    { "name": "Jane", "totalPoints": 380, "matchesPlayed": 5 },
    { "name": "John", "totalPoints": 270, "matchesPlayed": 5 }
  ],
  "updatedAt": 1713868800000
}
```

**Security**:
- Local: Read/Write open
- Production: Read open, Write requires admin

---

### 10. Tournament Users (`/tournaments/{sport}/{tournamentId}/users`)

**Purpose**: Tournament-specific user profiles and stats.

**Structure**:
```
/tournaments/{sport}/{tournamentId}/users/{clientId}
```

**Data Example**:
```json
{
  "name": "John Doe",
  "totalPoints": 270,
  "matchesPlayed": 5,
  "favoriteTeam": "chennai super kings",
  "updatedAt": 1713868800000
}
```

**Security**:
- Local: Read/Write open
- Production: Users can read/write their own data, admins can access all

---

### 11. Global Users (`/users`)

**Purpose**: Global user profiles shared across all tournaments.

**Structure**:
```
/users/{clientId}
```

**Data Example**:
```json
{
  "name": "John Doe",
  "favoriteTeam": "chennai super kings",
  "lastSeen": 1713868800000,
  "updatedAt": 1713868800000
}
```

**Security**:
- Local: Read/Write open
- Production: Users can read/write their own data, admins can access all

---

### 12. Active Sessions (`/active_sessions`)

**Purpose**: Tracks active broadcaster sessions for monitoring.

**Structure**:
```
/active_sessions/{roomId}
```

**Data Example**:
```json
{
  "lastActive": 1713868800000
}
```

**Security**:
- Local: Read/Write open
- Production: Read open, Write requires admin

---

## Schema Helper Functions

### Tournament-Level Refs

```typescript
export const tournamentMetaRef = (sport: string, tournamentId: string) =>
  ref(db, `${getDbRoot()}/tournaments/${sport}/${tournamentId}/meta`);

export const tournamentLeaderboardRef = (sport: string, tournamentId: string) =>
  ref(db, `${getDbRoot()}/tournaments/${sport}/${tournamentId}/leaderboard`);

export const tournamentUsersRef = (sport: string, tournamentId: string) =>
  ref(db, `${getDbRoot()}/tournaments/${sport}/${tournamentId}/users`);
```

### Match-Level Refs

```typescript
export const matchRef = (sport: string, tournamentId: string, matchId: string, schema: string, child = "") => {
  const root = getDbRoot();
  const path = child 
    ? `${root}/tournaments/${sport}/${tournamentId}/matches/${matchId}/${schema}/${child}`
    : `${root}/tournaments/${sport}/${tournamentId}/matches/${matchId}/${schema}`;
  return ref(db, path);
};

export const matchMetaRef = (sport: string, tournamentId: string, matchId: string) =>
  matchRef(sport, tournamentId, matchId, "meta");

export const matchPredictionsRef = (sport: string, tournamentId: string, matchId: string) =>
  matchRef(sport, tournamentId, matchId, "predictions");

export const matchChatRef = (sport: string, tournamentId: string, matchId: string) =>
  matchRef(sport, tournamentId, matchId, "chat");
```

### Discovery Refs

```typescript
export const matchDiscoveryRef = (matchCode: string) =>
  ref(db, `${getDbRoot()}/discovery/matches/${matchCode.toLowerCase()}`);

export const tournamentDiscoveryRef = (tournamentCode: string) =>
  ref(db, `${getDbRoot()}/discovery/tournaments/${tournamentCode.toLowerCase()}`);
```

### Meta Merge Helper

```typescript
export const getMergedMeta = async (sport: string, tournamentId: string, matchId: string) => {
  const [tourneyMetaSnap, matchMetaSnap] = await Promise.all([
    get(tournamentMetaRef(sport, tournamentId)),
    get(matchMetaRef(sport, tournamentId, matchId))
  ]);
  return { ...(tourneyMetaSnap.val() || {}), ...(matchMetaSnap.val() || {}) };
};
```

### Match ID Generation

```typescript
export const generateMatchId = (teamA: string, teamB: string, date?: Date) => {
  const normalize = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
  const a = normalize(teamA);
  const b = normalize(teamB);
  if (date) {
    const dateStr = date.toISOString().split('T')[0];
    return `${a}-vs-${b}-${dateStr}`;
  }
  return `${a}-vs-${b}`;
};
```

---

## Data Flow Examples

### 1. Creating a Tournament (Backend)

```typescript
// 1. Set tournament discovery
await setTournamentDiscovery("ipl-2024", "cricket", "ipl-2024");

// 2. Save tournament meta (defaults)
await update(tournamentMetaRef("cricket", "ipl-2024"), {
  tournamentName: "IPL 2024",
  defaultPredictionSort: "newest"
});
```

**Database writes**:
```
/prod/discovery/tournaments/ipl-2024 → { sport: "cricket", tournamentId: "ipl-2024", ... }
/prod/tournaments/cricket/ipl-2024/meta → { tournamentName: "IPL 2024", ... }
```

---

### 2. Creating a Match (Backend)

```typescript
// 1. Generate match ID
const matchId = generateMatchId("Chennai Super Kings", "Mumbai Indians");

// 2. Set match discovery
await setMatchDiscovery("csk-vs-mi", "cricket", "ipl-2024", matchId);

// 3. Save match meta
await update(matchMetaRef("cricket", "ipl-2024", matchId), {
  matchTitle: "CSK vs MI - Match 15",
  teamA: "Chennai Super Kings",
  teamB: "Mumbai Indians",
  secondInnings: false
});
```

**Database writes**:
```
/prod/discovery/matches/csk-vs-mi → { sport: "cricket", tournamentId: "ipl-2024", matchId: "csk-vs-mi", ... }
/prod/tournaments/cricket/ipl-2024/matches/csk-vs-mi/meta → { matchTitle: "CSK vs MI", ... }
```

---

### 3. User Joining via Match Code (Frontend)

```typescript
// 1. Resolve match code to match details
const discovery = await get(matchDiscoveryRef("csk-vs-mi"));
const { sport, tournamentId, matchId } = discovery.val();

// 2. Get merged meta (tournament defaults + match overrides)
const meta = await getMergedMeta(sport, tournamentId, matchId);

// 3. Subscribe to match predictions
onValue(matchPredictionsRef(sport, tournamentId, matchId), (snap) => {
  setPredictions(snap.val());
});
```

**Database reads**:
```
/prod/discovery/matches/csk-vs-mi
/prod/tournaments/cricket/ipl-2024/meta
/prod/tournaments/cricket/ipl-2024/matches/csk-vs-mi/meta
/prod/tournaments/cricket/ipl-2024/matches/csk-vs-mi/predictions
```

---

### 4. User Browsing Tournament (Frontend)

```typescript
// 1. Resolve tournament code
const discovery = await get(tournamentDiscoveryRef("ipl-2024"));
const { sport, tournamentId } = discovery.val();

// 2. Fetch all matches in tournament
const matchesRef = ref(db, `${dbRoot}/tournaments/${sport}/${tournamentId}/matches`);
const matchesSnap = await get(matchesRef);
const matches = Object.entries(matchesSnap.val()).map(([matchId, data]) => ({
  matchId,
  meta: data.meta
}));
```

**Database reads**:
```
/prod/discovery/tournaments/ipl-2024
/prod/tournaments/cricket/ipl-2024/matches
```

---

### 5. User Submitting Prediction (Frontend)

```typescript
await savePrediction("cricket", "ipl-2024", "c-abc123", {
  userId: "c-abc123",
  name: "John Doe",
  predictedWinner: "chennai super kings",
  scoreA: "185",
  scoreB: "180",
  sportType: "cricket"
}, "csk-vs-mi"); // matchId parameter
```

**Database write**:
```
/prod/tournaments/cricket/ipl-2024/matches/csk-vs-mi/predictions/c-abc123 → { ...prediction data }
```

---

### 6. Archiving Match Results (Backend)

```typescript
// 1. Save innings results
await set(matchInningsHistoryRef("cricket", "ipl-2024", "csk-vs-mi", "innings1"), innings1Results);
await set(matchInningsHistoryRef("cricket", "ipl-2024", "csk-vs-mi", "innings2"), innings2Results);

// 2. Archive to match history
await set(matchHistoryRef("cricket", "ipl-2024", "csk-vs-mi", "2024-04-23_MATCH_15"), {
  matchTitle: "CSK vs MI",
  innings1: innings1Results,
  innings2: innings2Results,
  finalStandings: calculatedStandings,
  matchResults: { actual1st: 185, actual2nd: "18.1", actualWinner: "csk" }
});

// 3. Update tournament leaderboard
await set(tournamentLeaderboardRef("cricket", "ipl-2024"), {
  standings: updatedStandings,
  updatedAt: serverTimestamp()
});

// 4. Clear match predictions
await remove(matchPredictionsRef("cricket", "ipl-2024", "csk-vs-mi"));
```

**Database writes**:
```
/prod/tournaments/cricket/ipl-2024/matches/csk-vs-mi/innings_history/innings1 → { ... }
/prod/tournaments/cricket/ipl-2024/matches/csk-vs-mi/innings_history/innings2 → { ... }
/prod/tournaments/cricket/ipl-2024/matches/csk-vs-mi/history/2024-04-23_MATCH_15 → { ... }
/prod/tournaments/cricket/ipl-2024/leaderboard → { ... }
/prod/tournaments/cricket/ipl-2024/matches/csk-vs-mi/predictions → (cleared)
```

---

## Security Rules

### Local Environment
- **Read/Write**: Open for all nodes
- **Purpose**: Development and testing without authentication

### Production Environment
- **Public Read**: Predictions, chat, reactions, meta, discovery, active_sessions
- **Authenticated Write**: Predictions, chat, reactions (requires signed-in user)
- **Admin Write**: 
  - Tournament meta, match meta, history, innings_history, leaderboard
  - Discovery (matches, tournaments)
  - Requires `auth.token.admin === true`
- **User Isolation**: 
  - Global users: Users can read/write their own `/users/{clientId}` node
  - Tournament users: Users can read/write their own `/tournaments/{sport}/{tournamentId}/users/{clientId}` node

### Admin Token
To perform admin operations in production, the Firebase auth token must include:
```json
{
  "admin": true
}
```

---

## Firebase Configuration

Firebase configuration is loaded from environment variables. See `.env.example` files in both `frontend/` and `backend/` directories for required variables.

### Backend (`backend/src/firebase/db.ts`)
```typescript
export const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.FIREBASE_DATABASE_URL,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};
```

### Frontend (`frontend/src/firebase/config.ts`)
```typescript
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};
```

### Python Automation (`backend/automation/base/firebase_client.py`)
```python
self.config = {
    'databaseURL': os.environ.get('FIREBASE_DATABASE_URL'),
    'apiKey': os.environ.get('FIREBASE_API_KEY'),
    'authDomain': os.environ.get('FIREBASE_AUTH_DOMAIN'),
    'projectId': os.environ.get('FIREBASE_PROJECT_ID'),
    'storageBucket': os.environ.get('FIREBASE_STORAGE_BUCKET')
}
```
```

**Note**: Both backend and frontend use the same Firebase project (`scorepredictor-9dd45`) for consistency.

---

## Deployment

### Deploy Database Rules
```bash
cd backend
npx firebase-tools deploy --only database:rules
```

### Deploy Frontend
```bash
cd backend
npx firebase-tools deploy --only hosting
```

---

## Best Practices

1. **Always use schema helper functions**: Never hardcode paths. Use `matchRef()`, `tournamentMetaRef()`, etc.

2. **Environment awareness**: Test in `local` environment before deploying to `prod`.

3. **Data validation**: Validate data structure before writing to Firebase.

4. **Error handling**: Always wrap Firebase operations in try-catch blocks.

5. **Unsubscribe listeners**: Always cleanup Firebase listeners in React `useEffect` cleanup functions.

6. **Timestamps**: Use `serverTimestamp()` for all timestamp fields to ensure consistency.

7. **Security**: Never expose admin credentials in client-side code. Admin operations should only happen in the backend (Electron app).

8. **Match ID format**: Use `generateMatchId()` helper to ensure consistent match IDs.

9. **Meta merging**: Always use `getMergedMeta()` to get final configuration with tournament defaults and match overrides.

---

## Troubleshooting

### Permission Denied Errors
- Check if using correct environment (`appMode` parameter)
- Verify Firebase rules are deployed
- Ensure auth token has required claims for admin operations
- Check if using correct ref (match-level vs tournament-level)

### Data Not Syncing
- Verify Firebase config matches between backend and frontend
- Check network connectivity
- Ensure using correct sport/tournamentId/matchId
- Verify discovery layer is properly set

### Schema Mismatch
- Always use helper functions instead of hardcoded paths
- Verify sport, tournamentId, and matchId are lowercase
- Check that discovery layer points to correct paths
- Ensure match ID format is consistent

### Meta Not Merging
- Verify both tournament meta and match meta exist
- Check that `getMergedMeta()` is being called correctly
- Ensure match meta has the fields you expect to override

---

## Migration from Legacy Schema

The legacy schema (single match per tournament) is still supported via legacy ref functions:
- `legacyMatchMetaRef()`, `legacyMatchPredictionsRef()`, `legacyMatchChatRef()`
- These map to the old structure for backward compatibility

To migrate existing data:
1. Create tournament structure
2. Move existing tournament data to tournament meta
3. Create match entries for each historical match
4. Move predictions, chat, history to match-level paths
5. Update discovery to use new structure

---

## Future Enhancements

1. **Authentication**: Implement Firebase Auth for production
2. **Indexing**: Add Firebase database indexes for better query performance
3. **Backup**: Implement automated backup strategy for production data
4. **Analytics**: Add Firebase Analytics for user behavior tracking
5. **Cloud Functions**: Move complex operations to Cloud Functions for better security
6. **Tournament Chat**: Add tournament-wide chat in addition to match chat
7. **Match Scheduling**: Add match scheduling and automatic activation
