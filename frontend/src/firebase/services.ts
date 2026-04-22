import { ref, push, set, serverTimestamp, get } from 'firebase/database';
import { rtdb } from './config';

const dbRoot = import.meta.env.DEV ? 'local' : 'prod';

// ── Tournament-Level Refs ───────────────────────────────────────────────────────
export const tournamentMetaRef = (sport: string, tournamentId: string) =>
  ref(rtdb, `${dbRoot}/tournaments/${sport}/${tournamentId}/meta`);

export const tournamentLeaderboardRef = (sport: string, tournamentId: string) =>
  ref(rtdb, `${dbRoot}/tournaments/${sport}/${tournamentId}/leaderboard`);

// ── Match-Level Refs ───────────────────────────────────────────────────────────
export const matchRef = (sport: string, tournamentId: string, matchId: string, schema: string, child = "") => {
  const path = child 
    ? `${dbRoot}/tournaments/${sport}/${tournamentId}/matches/${matchId}/${schema}/${child}`
    : `${dbRoot}/tournaments/${sport}/${tournamentId}/matches/${matchId}/${schema}`;
  return ref(rtdb, path);
};

export const matchMetaRef = (sport: string, tournamentId: string, matchId: string) =>
  matchRef(sport, tournamentId, matchId, "meta");

export const matchPredictionsRef = (sport: string, tournamentId: string, matchId: string) =>
  matchRef(sport, tournamentId, matchId, "predictions");

export const matchChatRef = (sport: string, tournamentId: string, matchId: string) =>
  matchRef(sport, tournamentId, matchId, "chat");

export const matchHistoryRef = (sport: string, tournamentId: string, matchId: string) =>
  matchRef(sport, tournamentId, matchId, "history");

// ── Legacy Refs (for backward compatibility) ───────────────────────────────────
export const discoveryRef = (roomId: string) => 
  ref(rtdb, `${dbRoot}/discovery/${roomId.toLowerCase()}`);

export const metaRef = (sport: string, id: string) => 
  ref(rtdb, `${dbRoot}/tournaments/${sport}/${id}/meta`);

export const chatRef = (sport: string, id: string) => 
  ref(rtdb, `${dbRoot}/tournaments/${sport}/${id}/chat`);

export const predictionsRef = (sport: string, id: string, clientId: string) => 
  ref(rtdb, `${dbRoot}/tournaments/${sport}/${id}/predictions/${clientId}`);

export const allPredictionsRef = (sport: string, id: string) => 
  ref(rtdb, `${dbRoot}/tournaments/${sport}/${id}/predictions`);

export const seasonLeaderboardRef = (sport: string, id: string) => 
  ref(rtdb, `${dbRoot}/tournaments/${sport}/${id}/season_leaderboard`);

// ── Discovery Layer ─────────────────────────────────────────────────────────────
export const matchDiscoveryRef = (matchCode: string) =>
  ref(rtdb, `${dbRoot}/discovery/matches/${matchCode.toLowerCase()}`);

export const tournamentDiscoveryRef = (tournamentCode: string) =>
  ref(rtdb, `${dbRoot}/discovery/tournaments/${tournamentCode.toLowerCase()}`);

// ── Global User Profiles ───────────────────────────────────────────────────────
export const userRef = (clientId: string) => 
  ref(rtdb, `${dbRoot}/users/${clientId}`);

// ── Meta Merge Helper ───────────────────────────────────────────────────────────
export const getMergedMeta = async (sport: string, tournamentId: string, matchId: string) => {
  const [tourneyMetaSnap, matchMetaSnap] = await Promise.all([
    get(tournamentMetaRef(sport, tournamentId)),
    get(matchMetaRef(sport, tournamentId, matchId))
  ]);
  return { ...(tourneyMetaSnap.val() || {}), ...(matchMetaSnap.val() || {}) };
};

// ── Operations ─────────────────────────────────────────────────────────────────
export const sendChatMessage = async (sport: string, id: string, payload: any, matchId?: string) => {
  try {
    const cRef = matchId ? matchChatRef(sport, id, matchId) : chatRef(sport, id);
    const nextRef = push(cRef);
    await set(nextRef, {
      ...payload,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('[Firebase] Error sending chat message:', error);
    throw error;
  }
};

export const savePrediction = async (sport: string, id: string, clientId: string, payload: any, matchId?: string) => {
  try {
    const pRef = matchId 
      ? matchRef(sport, id, matchId, "predictions", clientId)
      : predictionsRef(sport, id, clientId);
    await set(pRef, {
      ...payload,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('[Firebase] Error saving prediction:', error);
    throw error;
  }
};

export const saveUserGlobalProfile = async (clientId: string, data: any) => {
  try {
    await set(userRef(clientId), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('[Firebase] Error saving user profile:', error);
    throw error;
  }
};
