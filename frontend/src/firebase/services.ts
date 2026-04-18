import { ref, onValue, push, set, serverTimestamp, limitToLast, query } from 'firebase/database';
import { rtdb } from './config';

const dbRoot = import.meta.env.DEV ? 'local' : 'prod';

export const activeMatchRef = (roomId: string) => ref(rtdb, `${dbRoot}/rooms/${roomId}/active_match`);
export const roomConfigRef = (roomId: string) => ref(rtdb, `${dbRoot}/rooms/${roomId}/config`);
export const metaRef = (matchId: string) => ref(rtdb, `${dbRoot}/meta/${matchId}`);
export const chatRef = (matchId: string) => ref(rtdb, `${dbRoot}/chat/${matchId}`);
export const predictionsRef = (matchId: string, clientId: string) => ref(rtdb, `${dbRoot}/predictions/${matchId}/${clientId}`);
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
