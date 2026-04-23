import { ref, push, set, update, serverTimestamp, get } from 'firebase/database';
import { rtdb } from './config';
import type { UserProfile } from '../types';

// Get Firebase mode from localStorage, default based on URL
const getDbRoot = () => {
  if (typeof window !== 'undefined') {
    // Check if localStorage has a value set
    const storedMode = localStorage.getItem('firebase_mode');
    if (storedMode) {
      return storedMode;
    }
    
    // Default based on URL: localhost/127.0.0.1 = local, else = prod
    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    const defaultMode = isLocal ? 'local' : 'prod';
    
    // Set the default in localStorage for future use
    localStorage.setItem('firebase_mode', defaultMode);
    return defaultMode;
  }
  return 'local';
};

export const setFirebaseMode = (mode: 'local' | 'prod') => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('firebase_mode', mode);
  }
};

export const getFirebaseMode = () => getDbRoot();

// ── Tournament-Level Refs ───────────────────────────────────────────────────────
export const tournamentMetaRef = (sport: string, tournamentId: string) =>
  ref(rtdb, `${getDbRoot()}/tournaments/${sport}/${tournamentId}/meta`);

export const tournamentLeaderboardRef = (sport: string, tournamentId: string) =>
  ref(rtdb, `${getDbRoot()}/tournaments/${sport}/${tournamentId}/leaderboard`);

// ── Match-Level Refs ───────────────────────────────────────────────────────────
export const matchRef = (sport: string, tournamentId: string, matchId: string, schema: string, child = "") => {
  const path = child 
    ? `${getDbRoot()}/tournaments/${sport}/${tournamentId}/matches/${matchId}/${schema}/${child}`
    : `${getDbRoot()}/tournaments/${sport}/${tournamentId}/matches/${matchId}/${schema}`;
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
  ref(rtdb, `${getDbRoot()}/discovery/${roomId.toLowerCase()}`);

export const metaRef = (sport: string, id: string) => 
  ref(rtdb, `${getDbRoot()}/tournaments/${sport}/${id}/meta`);

export const chatRef = (sport: string, id: string) => 
  ref(rtdb, `${getDbRoot()}/tournaments/${sport}/${id}/chat`);

export const predictionsRef = (sport: string, id: string, clientId: string) => 
  ref(rtdb, `${getDbRoot()}/tournaments/${sport}/${id}/predictions/${clientId}`);

export const allPredictionsRef = (sport: string, id: string) => 
  ref(rtdb, `${getDbRoot()}/tournaments/${sport}/${id}/predictions`);

export const seasonLeaderboardRef = (sport: string, id: string) => 
  ref(rtdb, `${getDbRoot()}/tournaments/${sport}/${id}/season_leaderboard`);

// ── Discovery Layer ─────────────────────────────────────────────────────────────
export const matchDiscoveryRef = (matchCode: string) =>
  ref(rtdb, `${getDbRoot()}/discovery/matches/${matchCode.toLowerCase()}`);

export const tournamentDiscoveryRef = (tournamentCode: string) =>
  ref(rtdb, `${getDbRoot()}/discovery/tournaments/${tournamentCode.toLowerCase()}`);

// ── Global User Profiles ───────────────────────────────────────────────────────
export const userRef = (clientId: string) => 
  ref(rtdb, `${getDbRoot()}/users/${clientId}`);

// ── User Authentication (Username/Passkey) ─────────────────────────────────────
export const usernameRef = (username: string) =>
  ref(rtdb, `${getDbRoot()}/usernames/${username.toLowerCase()}`);

export const usernameIndexRef = () =>
  ref(rtdb, `${getDbRoot()}/usernames`);

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
    console.log('[Firebase] Sending chat message:', { sport, id, matchId, payload });
    const cRef = matchId ? matchChatRef(sport, id, matchId) : chatRef(sport, id);
    const nextRef = push(cRef);
    await set(nextRef, {
      ...payload,
      timestamp: serverTimestamp(),
    });
    console.log('[Firebase] Chat message sent successfully');
  } catch (error) {
    console.error('[Firebase] Error sending chat message:', error);
    throw error;
  }
};

export const savePrediction = async (sport: string, id: string, clientId: string, payload: any, matchId?: string) => {
  try {
    console.log('[Firebase] Saving prediction:', { sport, id, clientId, matchId, payload });
    const pRef = matchId 
      ? matchRef(sport, id, matchId, "predictions", clientId)
      : predictionsRef(sport, id, clientId);
    await set(pRef, {
      ...payload,
      updatedAt: serverTimestamp(),
    });
    console.log('[Firebase] Prediction saved successfully');
  } catch (error) {
    console.error('[Firebase] Error saving prediction:', error);
    throw error;
  }
};

export const saveUserGlobalProfile = async (clientId: string, data: Partial<UserProfile>) => {
  try {
    console.log('[Firebase] Saving user profile:', { clientId, data });
    await update(userRef(clientId), {
      ...data,
      updatedAt: serverTimestamp(),
    });
    console.log('[Firebase] User profile saved successfully');
  } catch (error) {
    console.error('[Firebase] Error saving user profile:', error);
    throw error;
  }
};

// ── Auth Operations ─────────────────────────────────────────────────────────────
export const checkUsernameAvailability = async (username: string): Promise<boolean> => {
  try {
    console.log('[Firebase] Checking username availability:', username);
    const snap = await get(usernameRef(username));
    const exists = snap.exists();
    console.log('[Firebase] Username exists in usernames node:', exists);

    // Fallback: check if username exists in users node (for legacy users without username mapping)
    if (!exists) {
      const usersIndexRef = ref(rtdb, `${getDbRoot()}/users`);
      const usersSnap = await get(usersIndexRef);
      const usersData = usersSnap.val();
      if (usersData) {
        const found = Object.values(usersData).some((user: any) =>
          user.username?.toLowerCase() === username.toLowerCase()
        );
        console.log('[Firebase] Username exists in users node (fallback):', found);
        return !found;
      }
    }

    return !exists;
  } catch (error) {
    console.error('[Firebase] Error checking username availability:', error);
    throw error;
  }
};

export const generatePasskey = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let passkey = '';
  for (let i = 0; i < 8; i++) {
    passkey += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return passkey;
};

export const createUserWithPasskey = async (username: string, clientId: string): Promise<string> => {
  try {
    console.log('[Firebase] Creating user with passkey:', { username, clientId });
    // Generate a random 8-character alphanumeric passkey
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let passkey = '';
    for (let i = 0; i < 8; i++) {
      passkey += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Save username -> clientId mapping
    await set(usernameRef(username), {
      clientId,
      passkey,
      createdAt: serverTimestamp(),
    });
    
    // Save username in user profile
    await update(userRef(clientId), {
      username,
      passkey,
    });
    
    console.log('[Firebase] User created with passkey:', passkey);
    return passkey;
  } catch (error) {
    console.error('[Firebase] Error creating user with passkey:', error);
    throw error;
  }
};

export const verifyUserPasskey = async (username: string, passkey: string): Promise<{ clientId: string, valid: boolean }> => {
  try {
    console.log('[Firebase] Verifying user passkey:', { username, passkey });
    const snap = await get(usernameRef(username));
    const data = snap.val();
    
    if (!data) {
      console.log('[Firebase] Username not found');
      return { clientId: '', valid: false };
    }
    
    const isValid = data.passkey === passkey;
    console.log('[Firebase] Passkey valid:', isValid);
    
    return {
      clientId: data.clientId,
      valid: isValid,
    };
  } catch (error) {
    console.error('[Firebase] Error verifying user passkey:', error);
    throw error;
  }
};

export const rotatePasskey = async (username: string, clientId: string): Promise<string> => {
  try {
    console.log('[Firebase] Rotating passkey for user:', { username, clientId });
    // Generate new 8-character alphanumeric passkey
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let newPasskey = '';
    for (let i = 0; i < 8; i++) {
      newPasskey += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    console.log('[Firebase] Generated new passkey:', newPasskey);
    
    // Update username mapping with new passkey
    await update(usernameRef(username), {
      passkey: newPasskey,
      updatedAt: serverTimestamp(),
    });
    
    // Update user profile with new passkey
    await update(userRef(clientId), {
      passkey: newPasskey,
    });
    
    console.log('[Firebase] Passkey rotated successfully');
    return newPasskey;
  } catch (error) {
    console.error('[Firebase] Error rotating passkey:', error);
    throw error;
  }
};
