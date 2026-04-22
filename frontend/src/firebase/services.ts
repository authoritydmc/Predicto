import { ref, push, set, serverTimestamp } from 'firebase/database';
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
  try {
    const cRef = chatRef(sport, id);
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

export const savePrediction = async (sport: string, id: string, clientId: string, payload: any) => {
  try {
    await set(predictionsRef(sport, id, clientId), {
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
