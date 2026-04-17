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

if (isFirebaseConfigured) {
  const app = initializeApp(firebaseConfig);
  db = getDatabase(app);
}

export { db, isFirebaseConfigured, onValue, query, limitToLast, ref, get, set, remove, update };

// Room metadata only (teamA, teamB, matchTitle, flags)
export const roomRef = (roomId) => {
  if (!db) throw new Error("Firebase is not configured");
  return ref(db, `rooms/${roomId}`);
};

// Active predictions for a room
export const predictionsRef = (roomId, clientId = null) => {
  if (!db) throw new Error("Firebase is not configured");
  return ref(db, clientId ? `predictions/${roomId}/${clientId}` : `predictions/${roomId}`);
};

// Prediction history per user per match
export const predictionHistoryRef = (roomId, clientId, matchId = null) => {
  if (!db) throw new Error("Firebase is not configured");
  const basePath = `prediction_history/${roomId}/${clientId}`;
  return ref(db, matchId ? `${basePath}/${matchId}` : basePath);
};

// Match history (results and standings)
export const matchHistoryRef = (roomId, matchId = null) => {
  if (!db) throw new Error("Firebase is not configured");
  return ref(db, matchId ? `match_history/${roomId}/${matchId}` : `match_history/${roomId}`);
};

// Season leaderboard
export const seasonLeaderboardRef = (roomId) => {
  if (!db) throw new Error("Firebase is not configured");
  return ref(db, `season_leaderboard/${roomId}`);
};

// User profile data
export const userRef = (clientId) => {
  if (!db) throw new Error("Firebase is not configured");
  return ref(db, `users/${clientId}`);
};

// Chat messages
export const chatRef = (roomId, messageId = null) => {
  if (!db) throw new Error("Firebase is not configured");
  return ref(db, messageId ? `chat/${roomId}/${messageId}` : `chat/${roomId}`);
};

// Reactions
export const reactionRef = (roomId) => {
  if (!db) throw new Error("Firebase is not configured");
  return ref(db, `reactions/${roomId}`);
};

export const getOnce = async (ref) => {
  return await get(ref);
};

export const savePrediction = async (roomId, clientId, payload) => {
  const ts = serverTimestamp();

  // 1. Update the current active prediction
  await set(predictionsRef(roomId, clientId), {
    ...payload,
    updatedAt: ts,
  });

  // 2. Append to match-specific audit trail for this user
  // Firebase paths cannot contain . # $ [ or ]
  const matchId = (payload.matchId || "unknown_match").replace(/[.#$\[\]]/g, "_");
  await set(push(predictionHistoryRef(roomId, clientId, matchId)), {
    ...payload,
    loggedAt: ts
  });
};

export const sendChatMessage = async (roomId, payload) => {
  const cRef = chatRef(roomId);
  const nextRef = push(cRef);
  await set(nextRef, {
    ...payload,
    createdAt: serverTimestamp(),
  });
};

export const saveRoomMeta = async (roomId, payload) => {
  await update(roomRef(roomId), {
    ...payload,
    updatedAt: serverTimestamp(),
  });
};

export const clearPredictions = async (roomId) => {
  await remove(predictionsRef(roomId));
};

export const saveMatchResult = async (roomId, matchId, results) => {
  await set(matchHistoryRef(roomId, matchId), {
    ...results,
    savedAt: serverTimestamp()
  });
};

export const getMatchHistory = async (roomId) => {
  const snapshot = await get(matchHistoryRef(roomId));
  return snapshot.val() || {};
};

export const archiveMatch = async (roomId, matchId, data) => {
  await set(matchHistoryRef(roomId, matchId), {
    ...data,
    archivedAt: serverTimestamp()
  });
};

export const wipeMatchData = async (roomId) => {
  await remove(predictionsRef(roomId));
  await update(roomRef(roomId), {
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

export const saveSeasonLeaderboard = async (roomId, data) => {
  await set(seasonLeaderboardRef(roomId), {
    standings: data,
    updatedAt: serverTimestamp()
  });
};

export const removePrediction = async (roomId, clientId) => {
  await remove(predictionsRef(roomId, clientId));
};

export const removeChatMessage = async (roomId, messageId) => {
  await remove(chatRef(roomId, messageId));
};

export const updateActiveSession = async (roomId) => {
  if (!db) return;
  await set(ref(db, `active_sessions/${roomId}`), {
    lastActive: serverTimestamp()
  });
};

export const sendReaction = async (roomId, payload) => {
  const rRef = reactionRef(roomId);
  await set(rRef, {
    ...payload,
    timestamp: serverTimestamp()
  });
};

export const clearChat = async (roomId) => {
  await remove(chatRef(roomId));
};

export const clearReaction = async (roomId) => {
  await remove(reactionRef(roomId));
};

export const getUserProfile = async (clientId) => {
  const snapshot = await get(userRef(clientId));
  return snapshot.val() || {};
};

export const saveUserFavoriteTeam = async (clientId, teamName) => {
  const profile = await getUserProfile(clientId);
  const changeCount = (profile.favoriteTeamChangeCount || 0) + 1;

  await update(userRef(clientId), {
    favoriteTeam: teamName,
    favoriteTeamSetAt: serverTimestamp(),
    favoriteTeamChangeCount: changeCount
  });

  return changeCount;
};
