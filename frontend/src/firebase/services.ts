import { ref, onValue, push, set, serverTimestamp, limitToLast, query, get } from 'firebase/database';
import { rtdb } from './config';

const dbRoot = import.meta.env.DEV ? 'local' : 'prod';

// ── Discovery (Resolve roomId to sport/tournamentId) ───────────────────────────
export const discoveryRef = (roomId: string) => 
  ref(rtdb, `${dbRoot}/discovery/${roomId.toLowerCase()}`);

// ── Polymorphic Refs (Tournament Specific) ─────────────────────────────────────
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

// ── Global User Profiles ───────────────────────────────────────────────────────
export const userRef = (clientId: string) => 
  ref(rtdb, `${dbRoot}/users/${clientId}`);

export const sendChatMessage = async (sport: string, id: string, payload: any) => {
  const cRef = chatRef(sport, id);
  const nextRef = push(cRef);
  await set(nextRef, {
    ...payload,
    createdAt: serverTimestamp(),
  });
};

export const savePrediction = async (sport: string, id: string, clientId: string, payload: any) => {
  await set(predictionsRef(sport, id, clientId), {
    ...payload,
    updatedAt: serverTimestamp(),
  });
};

export const saveUserGlobalProfile = async (clientId: string, data: any) => {
  await set(userRef(clientId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};
