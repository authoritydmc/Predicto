import { ref, push, set, update, serverTimestamp, get } from 'firebase/database';
import { rtdb } from './config';
import type { UserProfile, UsernameData } from '../types';

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

export const matchLiveScoreRef = (sport: string, tournamentId: string, matchId: string) =>
  matchRef(sport, tournamentId, matchId, "live_score");

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
export const usernameDataRef = (username: string) =>
  ref(rtdb, `${getDbRoot()}/username/${username.toLowerCase()}`);

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
    // Use username as the key instead of clientId
    const username = payload.name || clientId;
    const pRef = matchId 
      ? matchRef(sport, id, matchId, "predictions", username)
      : predictionsRef(sport, id, username);
    
    // Get existing predictions array
    const snap = await get(pRef);
    const existingData = snap.val();
    
    const newPrediction = {
      ...payload,
      userId: clientId, // Keep clientId for reference
      predictionId: Date.now(), // Unique ID for this prediction
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      // Reconciliation metadata
      reconciled: false,
      reconciledAt: null,
      penaltyScore: null,
      score: null
    };
    
    if (existingData && Array.isArray(existingData.predictions)) {
      // Append to existing array
      existingData.predictions.push(newPrediction);
      existingData.latestPrediction = newPrediction;
      existingData.predictionCount = existingData.predictions.length;
      await update(pRef, {
        predictions: existingData.predictions,
        latestPrediction: newPrediction,
        predictionCount: existingData.predictions.length,
        updatedAt: serverTimestamp()
      });
    } else {
      // Create new array structure
      await set(pRef, {
        username: username,
        userId: clientId,
        predictions: [newPrediction],
        latestPrediction: newPrediction,
        predictionCount: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
    
    console.log('[Firebase] Prediction saved successfully');
  } catch (error) {
    console.error('[Firebase] Error saving prediction:', error);
    throw error;
  }
};

export const saveUserGlobalProfile = async (username: string, data: Partial<UserProfile>) => {
  try {
    console.log('[Firebase] Saving user profile:', { username, data });
    await update(usernameDataRef(username), {
      ...data,
      updatedAt: serverTimestamp(),
    });
    console.log('[Firebase] User profile saved successfully');
  } catch (error) {
    console.error('[Firebase] Error saving user profile:', error);
    throw error;
  }
};

export const reconcilePrediction = async (sport: string, id: string, username: string, matchId: string, predictionId: number, score: number, penaltyScore?: number) => {
  try {
    console.log('[Firebase] Reconciling prediction:', { sport, id, username, matchId, predictionId, score, penaltyScore });
    const pRef = matchRef(sport, id, matchId, "predictions", username);
    const snap = await get(pRef);
    const userData = snap.val();
    
    if (userData && Array.isArray(userData.predictions)) {
      // Find and update the specific prediction
      const predictionIndex = userData.predictions.findIndex((p: any) => p.predictionId === predictionId);
      
      if (predictionIndex !== -1) {
        userData.predictions[predictionIndex].reconciled = true;
        userData.predictions[predictionIndex].reconciledAt = serverTimestamp();
        userData.predictions[predictionIndex].score = score;
        if (penaltyScore !== undefined) {
          userData.predictions[predictionIndex].penaltyScore = penaltyScore;
        }
        
        await update(pRef, {
          predictions: userData.predictions,
          updatedAt: serverTimestamp()
        });
        
        console.log('[Firebase] Prediction reconciled successfully');
      } else {
        console.warn('[Firebase] Prediction not found for reconciliation:', predictionId);
      }
    }
  } catch (error) {
    console.error('[Firebase] Error reconciling prediction:', error);
    throw error;
  }
};

export const getPredictionsForReconciliation = async (sport: string, id: string, matchId: string) => {
  try {
    const predictionsRef = matchRef(sport, id, matchId, "predictions");
    const snap = await get(predictionsRef);
    const predictionsData = snap.val();
    
    if (!predictionsData) return [];
    
    // Return all unreconciled predictions from all users
    const unreconciledPredictions: any[] = [];
    
    if (typeof predictionsData === 'object') {
      Object.values(predictionsData).forEach((userData: any) => {
        if (userData && Array.isArray(userData.predictions)) {
          userData.predictions.forEach((prediction: any) => {
            if (!prediction.reconciled) {
              unreconciledPredictions.push({
                username: userData.username,
                userId: userData.userId,
                ...prediction
              });
            }
          });
        }
      });
    }
    
    return unreconciledPredictions;
  } catch (error) {
    console.error('[Firebase] Error getting predictions for reconciliation:', error);
    throw error;
  }
};

export const ensureUsernameDataExists = async (username: string, clientId: string): Promise<void> => {
  try {
    console.log('[Firebase] Checking if username data exists:', username);
    const snap = await get(usernameDataRef(username));

    if (!snap.exists()) {
      console.log('[Firebase] Username data missing, creating with defaults:', username);
      const passkey = generatePasskey();

      const usernameData: UsernameData = {
        clientId,
        passkey,
        favoriteTeam: null,
        teamChangeCount: 0,
        failedLoginAttempts: 0,
        role: 'user',
        enabled: true,
        bannedTournaments: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await set(usernameDataRef(username), usernameData);
      console.log('[Firebase] Username data created successfully');
    }
  } catch (error) {
    console.error('[Firebase] Error ensuring username data exists:', error);
    throw error;
  }
};

// ── Auth Operations ─────────────────────────────────────────────────────────────
export const checkUsernameAvailability = async (username: string): Promise<boolean> => {
  try {
    console.log('[Firebase] Checking username availability:', username);
    const snap = await get(usernameDataRef(username));
    const exists = snap.exists();
    console.log('[Firebase] Username exists:', exists);
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
    const passkey = generatePasskey();

    // Save all user data under username/{username} (including clientId)
    await set(usernameDataRef(username), {
      clientId,
      passkey,
      favoriteTeam: null,
      teamChangeCount: 0,
      failedLoginAttempts: 0,
      role: 'user',
      enabled: true,
      bannedTournaments: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Save username reference in users/{clientId}
    await set(userRef(clientId), {
      username,
    });

    console.log('[Firebase] User created with passkey:', passkey);
    return passkey;
  } catch (error) {
    console.error('[Firebase] Error creating user with passkey:', error);
    throw error;
  }
};

export const verifyUserPasskey = async (username: string, passkey: string): Promise<{ clientId: string, valid: boolean, reason?: string }> => {
  try {
    console.log('[Firebase] Verifying user passkey:', { username, passkey });

    // Get user data from username/{username}
    const userDataSnap = await get(usernameDataRef(username));
    const userData = userDataSnap.val();

    if (!userData) {
      console.log('[Firebase] Username not found');
      return { clientId: '', valid: false, reason: 'Username not found' };
    }

    // Check if account is enabled
    if (userData.enabled === false) {
      console.log('[Firebase] Account is disabled');
      return { clientId: '', valid: false, reason: 'Account is disabled' };
    }

    const isValid = userData.passkey === passkey;
    console.log('[Firebase] Passkey valid:', isValid);

    if (isValid) {
      // Reset failed attempts on successful login
      if (userData.failedLoginAttempts > 0) {
        await update(usernameDataRef(username), {
          failedLoginAttempts: 0,
          updatedAt: Date.now(),
        });
      }
      return {
        clientId: userData.clientId,
        valid: true,
      };
    } else {
      // Increment failed attempts
      const newAttempts = (userData.failedLoginAttempts || 0) + 1;
      console.log('[Firebase] Failed login attempts:', newAttempts);

      if (newAttempts >= 3) {
        // Reset passkey after 3 failed attempts
        const newPasskey = generatePasskey();
        console.log('[Firebase] Resetting passkey after 3 failed attempts');
        await update(usernameDataRef(username), {
          passkey: newPasskey,
          failedLoginAttempts: 0,
          updatedAt: Date.now(),
        });
        return { clientId: '', valid: false, reason: 'Too many failed attempts. Passkey has been reset.' };
      } else {
        await update(usernameDataRef(username), {
          failedLoginAttempts: newAttempts,
          updatedAt: Date.now(),
        });
        return { clientId: '', valid: false, reason: 'Invalid passkey' };
      }
    }
  } catch (error) {
    console.error('[Firebase] Error verifying user passkey:', error);
    throw error;
  }
};

export const rotatePasskey = async (username: string, clientId: string): Promise<string> => {
  try {
    console.log('[Firebase] Rotating passkey for user:', { username, clientId });
    const newPasskey = generatePasskey();
    console.log('[Firebase] Generated new passkey:', newPasskey);

    // Update username/{username} with new passkey
    await update(usernameDataRef(username), {
      passkey: newPasskey,
      updatedAt: serverTimestamp(),
    });

    console.log('[Firebase] Passkey rotated successfully');
    return newPasskey;
  } catch (error) {
    console.error('[Firebase] Error rotating passkey:', error);
    throw error;
  }
};
