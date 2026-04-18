import { ref, onValue, push, set, serverTimestamp, limitToLast, query } from 'firebase/database';
import { rtdb } from './config';

const dbRoot = import.meta.env.DEV ? 'local' : 'prod';

export const metaRef = (roomId: string) => ref(rtdb, `${dbRoot}/meta/${roomId}`);
export const chatRef = (roomId: string) => ref(rtdb, `${dbRoot}/chat/${roomId}`);
export const predictionsRef = (roomId: string, clientId: string) => 
  ref(rtdb, `${dbRoot}/predictions/${roomId}/${clientId}`);
export const activeMatchRef = (roomId: string) => ref(rtdb, `${dbRoot}/rooms/${roomId}/active_match`); // Keep legacy discovery if needed
export const seasonLeaderboardRef = (roomId: string) => ref(rtdb, `${dbRoot}/season_leaderboard/${roomId}`);
export const userRef = (clientId: string) => ref(rtdb, `${dbRoot}/users/${clientId}`);

export const sendChatMessage = async (matchId: string, payload: any) => {
  const cRef = chatRef(matchId);
  const nextRef = push(cRef);
  await set(nextRef, {
    ...payload,
    createdAt: serverTimestamp(),
  });
};

export const savePrediction = async (matchId: string, clientId: string, payload: any) => {
  await set(predictionsRef(matchId, clientId), {
    ...payload,
    updatedAt: serverTimestamp(),
  });
};

export const saveUserFavoriteTeam = async (clientId: string, teamName: string) => {
  await set(userRef(clientId), {
    favoriteTeam: teamName,
    favoriteTeamSetAt: serverTimestamp(),
  });
};
