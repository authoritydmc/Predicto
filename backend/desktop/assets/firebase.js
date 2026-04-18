import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  get,
  limitToLast,
  onValue,
  push,
  query,
  ref,
  remove,
  serverTimestamp,
  set,
  update,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";

let db = null;
const urlParams = new URLSearchParams(window.location.search);
const appMode = urlParams.get('appMode') || 'prod';
const dbRoot = appMode === 'local' ? 'local' : 'prod';

if (isFirebaseConfigured) {
  const app = initializeApp(firebaseConfig);
  db = getDatabase(app);
}

export { 
  db, isFirebaseConfigured, onValue, query, limitToLast, ref, get, set, remove, update,
  serverTimestamp, push
};

// --- SCHEMA HELPERS ---

// 1. Room Level (Config and Discovery)
export const roomActiveMatchRef = (roomId) => {
  return ref(db, `${dbRoot}/rooms/${roomId}/active_match`);
};

export const roomConfigRef = (roomId) => {
  return ref(db, `${dbRoot}/rooms/${roomId}/config`);
};

// 2. Match Level (Live Data)
export const matchMetaRef = (matchId) => {
  return ref(db, `${dbRoot}/meta/${matchId}`);
};

export const matchPredictionsRef = (matchId, clientId = null) => {
  const path = clientId ? `${dbRoot}/predictions/${matchId}/${clientId}` : `${dbRoot}/predictions/${matchId}`;
  return ref(db, path);
};

export const matchChatRef = (matchId, messageId = null) => {
  const path = messageId ? `${dbRoot}/chat/${matchId}/${messageId}` : `${dbRoot}/chat/${matchId}`;
  return ref(db, path);
};

export const matchReactionRef = (matchId) => {
  return ref(db, `${dbRoot}/reactions/${matchId}`);
};

export const matchInningsHistoryRef = (matchId) => {
  return ref(db, `${dbRoot}/innings_history/${matchId}`);
};

// 3. User & History
export const userRef = (clientId) => {
  return ref(db, `${dbRoot}/users/${clientId}`);
};

export const matchHistoryRef = (roomId, matchId = null) => {
  const path = matchId ? `${dbRoot}/history/${roomId}/${matchId}` : `${dbRoot}/history/${roomId}`;
  return ref(db, path);
};

export const seasonLeaderboardRef = (roomId) => {
  return ref(db, `${dbRoot}/season_leaderboard/${roomId}`);
};

// --- DATA ACTIONS ---

export const getOnce = async (r) => {
  return await get(r);
};

export const saveRoomMeta = async (matchId, payload) => {
  await update(matchMetaRef(matchId), {
    ...payload,
    updatedAt: serverTimestamp(),
  });
};

export const clearRoomNode = async (matchId, node) => {
  if (!db) return;
  await remove(ref(db, `${dbRoot}/${node}/${matchId}`));
};

export const updateActiveSession = async (roomId) => {
  if (!db) return;
  await set(ref(db, `${dbRoot}/active_sessions/${roomId}`), {
    lastActive: serverTimestamp()
  });
};

export const removePrediction = async (matchId, clientId) => {
  await remove(matchPredictionsRef(matchId, clientId));
};

export const removeChatMessage = async (matchId, messageId) => {
  await remove(matchChatRef(matchId, messageId));
};

export const wipeMatchData = async (matchId) => {
  await remove(matchPredictionsRef(matchId));
  await update(matchMetaRef(matchId), {
    matchTitle: "",
    teamA: "",
    teamB: "",
    predictionsPaused: false,
    secondInnings: false,
    disableScoreA: false,
    disableScoreB: false,
    updatedAt: serverTimestamp()
  });
};
