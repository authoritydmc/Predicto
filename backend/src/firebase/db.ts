import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, update, remove, onValue, query, limitToLast, serverTimestamp, push, DatabaseReference, DataSnapshot } from 'firebase/database';

export const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyCHzMhjOePcNBkvCpJE0H-S2jZ7q9cgaaE",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "scorepredictor-9dd45.firebaseapp.com",
  databaseURL: process.env.FIREBASE_DATABASE_URL || "https://scorepredictor-9dd45-default-rtdb.firebaseio.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "scorepredictor-9dd45",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "scorepredictor-9dd45.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "555373343943",
  appId: process.env.FIREBASE_APP_ID || "1:555373343943:web:64e8233090daa9a7043ae2",
  measurementId: process.env.FIREBASE_MEASUREMENT_ID || "G-N10HQR1382"
};

export const isFirebaseConfigured = true;

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

export { ref, onValue, query, limitToLast, set, update, push, serverTimestamp };

// ── DB Root ────────────────────────────────────────────────────────────────────
export const getDbRoot = () => {
  // First check localStorage (for dynamic mode switching)
  // @ts-ignore
  const storedMode = localStorage.getItem('firebase_mode');
  if (storedMode) {
    return storedMode === 'prod' ? 'prod' : 'local';
  }
  
  // Fall back to window global (set by cross-env in package.json via preload script)
  // @ts-ignore
  const envMode = window.APP_MODE;
  if (envMode) {
    return envMode === "local" ? "local" : "prod";
  }
  
  // Fallback to URL params (for backwards compatibility)
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get("appMode") || "local";
  return mode === "prod" ? "prod" : "local";
};

/**
 * POLYMORPHIC SCHEMA HELPER
 * Structure: /[env]/tournaments/[sport]/[tournamentId]/[schema]
 * Legacy: Kept for backward compatibility
 */
export const schemaRef = (schema: string, sport: string, tournamentId: string, child = "") => {
  const root = getDbRoot();
  const s = sport || "generic";
  const tId = tournamentId || "default";
  const path = child 
    ? `${root}/tournaments/${s}/${tId}/${schema}/${child}` 
    : `${root}/tournaments/${s}/${tId}/${schema}`;
  return ref(db, path);
};

export const getOnce = async (r: ReturnType<typeof ref>) => await get(r);

// ── Tournament-Level Refs ───────────────────────────────────────────────────────
export const tournamentMetaRef = (sport: string, tournamentId: string) =>
  ref(db, `${getDbRoot()}/tournaments/${sport}/${tournamentId}/meta`);

export const tournamentLeaderboardRef = (sport: string, tournamentId: string) =>
  ref(db, `${getDbRoot()}/tournaments/${sport}/${tournamentId}/leaderboard`);

export const tournamentUsersRef = (sport: string, tournamentId: string) =>
  ref(db, `${getDbRoot()}/tournaments/${sport}/${tournamentId}/users`);

export const tournamentScheduleRef = (sport: string, tournamentId: string) =>
  ref(db, `${getDbRoot()}/tournaments/${sport}/${tournamentId}/schedule`);

// ── Schedule Management ─────────────────────────────────────────────────────────────
export const saveTournamentSchedule = async (sport: string, tournamentId: string, schedule: any[]) => {
  const scheduleRef = tournamentScheduleRef(sport, tournamentId);
  await set(scheduleRef, schedule);
};

export const getTournamentSchedule = async (sport: string, tournamentId: string) => {
  const scheduleRef = tournamentScheduleRef(sport, tournamentId);
  const snapshot = await get(scheduleRef);
  return snapshot.val() || [];
};

export const addMatchToSchedule = async (sport: string, tournamentId: string, matchData: any) => {
  const scheduleRef = tournamentScheduleRef(sport, tournamentId);
  const snapshot = await get(scheduleRef);
  const schedule = snapshot.val() || [];
  schedule.push(matchData);
  await set(scheduleRef, schedule);
};

// ── Tournament Discovery ─────────────────────────────────────────────────────────────
export const getTournamentsBySport = async (sport: string) => {
  const tournamentsRef = ref(db, `${getDbRoot()}/tournaments/${sport}`);
  const snapshot = await get(tournamentsRef);
  const tournaments = snapshot.val() || {};
  
  return Object.entries(tournaments).map(([tournamentId, data]: [string, any]) => ({
    tournamentId,
    ...data.meta,
    status: data.meta?.status || 'active'
  }));
};

export const updateTournamentStatus = async (sport: string, tournamentId: string, status: 'active' | 'paused' | 'ended') => {
  await update(tournamentMetaRef(sport, tournamentId), { status, updatedAt: Date.now() });
};

export const deleteTournament = async (sport: string, tournamentId: string) => {
  const tournamentRef = ref(db, `${getDbRoot()}/tournaments/${sport}/${tournamentId}`);
  await set(tournamentRef, null);
  // Also remove from discovery
  const discoveryRef = ref(db, `${getDbRoot()}/discovery/tournaments/${tournamentId}`);
  await set(discoveryRef, null);
};

export const deleteMatch = async (sport: string, tournamentId: string, matchId: string) => {
  const matchRef = ref(db, `${getDbRoot()}/tournaments/${sport}/${tournamentId}/matches/${matchId}`);
  await set(matchRef, null);
  // Also remove from match discovery
  const discoveryRef = ref(db, `${getDbRoot()}/discovery/matches/${matchId}`);
  await set(discoveryRef, null);
};

export const getMatchesByTournament = async (sport: string, tournamentId: string) => {
  const matchesRef = ref(db, `${getDbRoot()}/tournaments/${sport}/${tournamentId}/matches`);
  const snapshot = await get(matchesRef);
  const matches = snapshot.val() || {};
  
  return Object.entries(matches).map(([matchId, data]: [string, any]) => ({
    matchId,
    ...data.meta,
    status: data.meta?.status || 'scheduled'
  }));
};

// ── Match-Level Refs ───────────────────────────────────────────────────────────
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

export const matchLiveScoreRef = (sport: string, tournamentId: string, matchId: string) =>
  matchRef(sport, tournamentId, matchId, "live_score");

export const matchHistoryRef = (sport: string, tournamentId: string, matchId: string) =>
  matchRef(sport, tournamentId, matchId, "history");

export const matchInningsHistoryRef = (sport: string, tournamentId: string, matchId: string) =>
  matchRef(sport, tournamentId, matchId, "innings_history");

// ── Discovery Layer ─────────────────────────────────────────────────────────────
export const matchDiscoveryRef = (matchCode: string) =>
  ref(db, `${getDbRoot()}/discovery/matches/${matchCode.toLowerCase()}`);

export const tournamentDiscoveryRef = (tournamentCode: string) =>
  ref(db, `${getDbRoot()}/discovery/tournaments/${tournamentCode.toLowerCase()}`);

// Legacy discovery for backward compatibility
export const discoveryRef = (roomId: string) =>
  ref(db, `${getDbRoot()}/discovery/${roomId.toLowerCase()}`);

export const setMatchDiscovery = async (matchCode: string, sport: string, tournamentId: string, matchId: string) => {
  await set(matchDiscoveryRef(matchCode), { sport, tournamentId, matchId, updatedAt: serverTimestamp() });
};

export const setTournamentDiscovery = async (tournamentCode: string, sport: string, tournamentId: string) => {
  await set(tournamentDiscoveryRef(tournamentCode), { sport, tournamentId, updatedAt: serverTimestamp() });
};

// Legacy setDiscovery for backward compatibility
export const setDiscovery = async (roomId: string, sport: string, tournamentId: string) => {
  await set(discoveryRef(roomId), { sport, tournamentId, updatedAt: serverTimestamp() });
};

// ── Meta Merge Helper ───────────────────────────────────────────────────────────
export const getMergedMeta = async (sport: string, tournamentId: string, matchId: string) => {
  const [tourneyMetaSnap, matchMetaSnap] = await Promise.all([
    get(tournamentMetaRef(sport, tournamentId)),
    get(matchMetaRef(sport, tournamentId, matchId))
  ]);
  return { ...(tourneyMetaSnap.val() || {}), ...(matchMetaSnap.val() || {}) };
};

// ── Match ID Generation ─────────────────────────────────────────────────────────
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

// ── Legacy roomRef for backward compatibility ───────────────────────────────────
export const roomRef = (roomId: string, child: string) =>
  ref(db, `${getDbRoot()}/rooms/${roomId}/${child}`);

// ── Global User Profiles ───────────────────────────────────────────────────────
export const globalUserRef = (clientId: string) => 
  ref(db, `${getDbRoot()}/users/${clientId}`);

export const saveGlobalUser = async (clientId: string, data: object) => {
  await update(globalUserRef(clientId), { ...data, lastSeen: serverTimestamp() });
};

// ── Room Meta ──────────────────────────────────────────────────────────────────
export const saveRoomMeta = async (sport: string, tournamentId: string, payload: object) => {
  await update(schemaRef("meta", sport, tournamentId), { ...payload, updatedAt: serverTimestamp() });
};

// ── Clear Node ─────────────────────────────────────────────────────────────────
export const clearRoomNode = async (sport: string, tournamentId: string, child: string) => {
  const parts = child.split('/');
  const schema = parts[0];
  const rest = parts.slice(1).join('/');
  await remove(schemaRef(schema, sport, tournamentId, rest));
};

// ── Innings History ────────────────────────────────────────────────────────────
export const saveInningsHistory = async (sport: string, tournamentId: string, innings: string, results: object) => {
  await set(schemaRef("innings_history", sport, tournamentId, innings), results);
};

export const getInningsHistory = async (sport: string, tournamentId: string) => {
  const snapshot = await get(schemaRef("innings_history", sport, tournamentId));
  return snapshot.val() || {};
};

// ── Match History ──────────────────────────────────────────────────────────────
export const archiveToHistory = async (sport: string, tournamentId: string, dateKey: string, data: object) => {
  await set(schemaRef("history", sport, tournamentId, dateKey), { ...data, archivedAt: serverTimestamp() });
};

export const getHistory = async (sport: string, tournamentId: string) => {
  const snapshot = await get(schemaRef("history", sport, tournamentId));
  return snapshot.val() || {};
};

// ── Season Leaderboard ─────────────────────────────────────────────────────────
export const saveSeasonLeaderboard = async (sport: string, tournamentId: string, data: object[]) => {
  await set(schemaRef("season_leaderboard", sport, tournamentId), { standings: data, updatedAt: serverTimestamp() });
};

// ── Wipe Match ─────────────────────────────────────────────────────────────────
export const wipeMatchData = async (sport: string, tournamentId: string) => {
  await remove(schemaRef("predictions", sport, tournamentId));
  await remove(schemaRef("innings_history", sport, tournamentId));
  await update(schemaRef("meta", sport, tournamentId), {
    matchTitle: "", teamA: "", teamB: "",
    predictionsPaused: false, secondInnings: false,
    disableScoreA: false, disableScoreB: false,
    updatedAt: serverTimestamp()
  });
};

// ── Session Heartbeat ──────────────────────────────────────────────────────────
export const updateActiveSession = async (roomId: string) => {
  const root = getDbRoot();
  await set(ref(db, `${root}/active_sessions/${roomId}`), { lastActive: serverTimestamp() });
};

// ── Audience-facing refs (used by overlay/frontend) ───────────────────────────
// Legacy refs for backward compatibility (no matchId)
export const legacyMatchMetaRef = (sport: string, tournamentId: string) =>
  schemaRef("meta", sport, tournamentId);

export const legacyMatchPredictionsRef = (sport: string, tournamentId: string) =>
  schemaRef("predictions", sport, tournamentId);

export const legacyMatchChatRef = (sport: string, tournamentId: string) =>
  schemaRef("chat", sport, tournamentId);

export const matchReactionRef = (sport: string, tournamentId: string, matchId?: string) => {
  if (matchId) return matchRef(sport, tournamentId, matchId, "reactions");
  return schemaRef("reactions", sport, tournamentId);
};
