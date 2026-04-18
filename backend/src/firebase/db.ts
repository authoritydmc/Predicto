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
 * NEW FLAT SCHEMA HELPER
 * Structure: /[env]/[schema]/[roomId]
 */
export const schemaRef = (schema: string, roomId: string, child = "") => {
  const root = getDbRoot();
  const path = child ? `${root}/${schema}/${roomId}/${child}` : `${root}/${schema}/${roomId}`;
  return ref(db, path);
};

export const getOnce = async (r: ReturnType<typeof ref>) => await get(r);

// ── Room Meta ──────────────────────────────────────────────────────────────────
export const saveRoomMeta = async (roomId: string, payload: object) => {
  await update(schemaRef("meta", roomId), { ...payload, updatedAt: serverTimestamp() });
};

// ── Clear Node ─────────────────────────────────────────────────────────────────
export const clearRoomNode = async (roomId: string, child: string) => {
  // child might be "predictions/CID" or just "chat"
  const parts = child.split('/');
  const schema = parts[0];
  const rest = parts.slice(1).join('/');
  await remove(schemaRef(schema, roomId, rest));
};

// ── Room-specific helpers ──────────────────────────────────────────────────────
export const roomRef = (roomId: string, child: string) => {
  // Legacy compatibility / catch-all
  return schemaRef(child, roomId);
};

// ── Innings History ────────────────────────────────────────────────────────────
export const saveInningsHistory = async (roomId: string, innings: string, results: object) => {
  await set(schemaRef("innings_history", roomId, innings), results);
};

export const getInningsHistory = async (roomId: string) => {
  const snapshot = await get(schemaRef("innings_history", roomId));
  return snapshot.val() || {};
};

// ── Match History ──────────────────────────────────────────────────────────────
export const archiveToHistory = async (roomId: string, dateKey: string, data: object) => {
  await set(schemaRef("history", roomId, dateKey), { ...data, archivedAt: serverTimestamp() });
};

export const getHistory = async (roomId: string) => {
  const snapshot = await get(schemaRef("history", roomId));
  return snapshot.val() || {};
};

// ── Season Leaderboard ─────────────────────────────────────────────────────────
export const saveSeasonLeaderboard = async (roomId: string, data: object[]) => {
  await set(schemaRef("season_leaderboard", roomId), { standings: data, updatedAt: serverTimestamp() });
};

// ── Wipe Match ─────────────────────────────────────────────────────────────────
export const wipeMatchData = async (roomId: string) => {
  await remove(schemaRef("predictions", roomId));
  await remove(schemaRef("innings_history", roomId));
  await update(schemaRef("meta", roomId), {
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
export const roomActiveMatchRef = (roomId: string) =>
  ref(db, `${getDbRoot()}/rooms/${roomId}/active_match`); // Keep rooms for this specific discovery node if needed

export const matchMetaRef = (roomId: string) =>
  schemaRef("meta", roomId);

export const matchPredictionsRef = (roomId: string) =>
  schemaRef("predictions", roomId);

export const matchChatRef = (roomId: string) =>
  schemaRef("chat", roomId);

export const matchReactionRef = (roomId: string) =>
  schemaRef("reactions", roomId);
