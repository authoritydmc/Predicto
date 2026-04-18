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

export const roomRef = (roomId: string, child = "") => {
  const root = getDbRoot();
  const path = child ? `${root}/rooms/${roomId}/${child}` : `${root}/rooms/${roomId}`;
  return ref(db, path);
};

export const getOnce = async (r: ReturnType<typeof ref>) => await get(r);

// ── Room Meta ──────────────────────────────────────────────────────────────────
export const saveRoomMeta = async (roomId: string, payload: object) => {
  await update(roomRef(roomId, "meta"), { ...payload, updatedAt: serverTimestamp() });
};

// ── Clear Node ─────────────────────────────────────────────────────────────────
export const clearRoomNode = async (roomId: string, child: string) => {
  await remove(roomRef(roomId, child));
};

// ── Innings History ────────────────────────────────────────────────────────────
export const saveInningsHistory = async (roomId: string, innings: string, results: object) => {
  await set(roomRef(roomId, `innings_history/${innings}`), results);
};

export const getInningsHistory = async (roomId: string) => {
  const snapshot = await get(roomRef(roomId, "innings_history"));
  return snapshot.val() || {};
};

// ── Match History ──────────────────────────────────────────────────────────────
export const archiveToHistory = async (roomId: string, dateKey: string, data: object) => {
  await set(roomRef(roomId, `history/${dateKey}`), { ...data, archivedAt: serverTimestamp() });
};

export const getHistory = async (roomId: string) => {
  const snapshot = await get(roomRef(roomId, "history"));
  return snapshot.val() || {};
};

// ── Season Leaderboard ─────────────────────────────────────────────────────────
export const saveSeasonLeaderboard = async (roomId: string, data: object[]) => {
  await set(roomRef(roomId, "season_leaderboard"), { standings: data, updatedAt: serverTimestamp() });
};

// ── Wipe Match ─────────────────────────────────────────────────────────────────
export const wipeMatchData = async (roomId: string) => {
  await remove(roomRef(roomId, "predictions"));
  await remove(roomRef(roomId, "innings_history"));
  await update(roomRef(roomId, "meta"), {
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
  ref(db, `${getDbRoot()}/rooms/${roomId}/active_match`);
export const matchMetaRef = (matchId: string) =>
  ref(db, `${getDbRoot()}/meta/${matchId}`);
export const matchPredictionsRef = (matchId: string) =>
  ref(db, `${getDbRoot()}/predictions/${matchId}`);
export const matchChatRef = (matchId: string) =>
  ref(db, `${getDbRoot()}/chat/${matchId}`);
export const matchReactionRef = (matchId: string) =>
  ref(db, `${getDbRoot()}/reactions/${matchId}`);
