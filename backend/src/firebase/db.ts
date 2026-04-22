import { initializeApp } from "firebase/app";
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  push,
  remove,
  onValue,
  query,
  limitToLast,
  serverTimestamp
} from "firebase/database";

export const firebaseConfig = {
  apiKey: "AIzaSyB9bXec79HW7l2Ow812gLTEvLvoiAJRtPY",
  authDomain: "overlaychat-6f3c1.firebaseapp.com",
  databaseURL: "https://overlaychat-6f3c1-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "overlaychat-6f3c1",
  storageBucket: "overlaychat-6f3c1.firebasestorage.app",
  messagingSenderId: "935528132270",
  appId: "1:935528132270:web:7dd72409fa1fe9bf10873f",
};

export const isFirebaseConfigured = true;

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

export { ref, onValue, query, limitToLast, set, update, push, serverTimestamp };

// ── DB Root ────────────────────────────────────────────────────────────────────
export const getDbRoot = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get("appMode") || "prod";
  return mode === "local" ? "local" : "prod";
};

/**
 * POLYMORPHIC SCHEMA HELPER
 * Structure: /[env]/tournaments/[sport]/[tournamentId]/[schema]
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

// ── Discovery Layer (Room Code -> Sport Context) ───────────────────────────────
export const discoveryRef = (roomId: string) => 
  ref(db, `${getDbRoot()}/discovery/${roomId.toLowerCase()}`);

export const setDiscovery = async (roomId: string, sport: string, tournamentId: string) => {
  await set(discoveryRef(roomId), { sport, tournamentId, updatedAt: serverTimestamp() });
};

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
export const matchMetaRef = (sport: string, tournamentId: string) =>
  schemaRef("meta", sport, tournamentId);

export const matchPredictionsRef = (sport: string, tournamentId: string) =>
  schemaRef("predictions", sport, tournamentId);

export const matchChatRef = (sport: string, tournamentId: string) =>
  schemaRef("chat", sport, tournamentId);

export const matchReactionRef = (sport: string, tournamentId: string) =>
  schemaRef("reactions", sport, tournamentId);
