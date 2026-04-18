import { initializeApp } from "firebase/app";
import { 
  getDatabase, 
  ref, 
  onValue, 
  set, 
  update, 
  push, 
  serverTimestamp 
} from "firebase/database";

// This will be populated from firebase-config.js or env
const firebaseConfig = {
  // Config should be injected here
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

export const getDbRoot = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get("appMode") || "prod";
  return mode === "local" ? "local" : "prod";
};

export const roomRef = (roomId: string) => ref(db, `${getDbRoot()}/rooms/${roomId}`);
export const activeMatchRef = (roomId: string) => ref(db, `${getDbRoot()}/rooms/${roomId}/active_match`);
export const matchMetaRef = (matchId: string) => ref(db, `${getDbRoot()}/meta/${matchId}`);
export const matchChatRef = (matchId: string) => ref(db, `${getDbRoot()}/chat/${matchId}`);

export { set, update, push, serverTimestamp, onValue };
