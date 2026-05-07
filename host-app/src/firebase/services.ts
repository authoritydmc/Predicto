// Re-export Firebase functions from db.ts for easier imports
export { 
  update, 
  matchMetaRef, 
  matchPredictionsRef, 
  matchLiveScoreRef, 
  matchChatRef, 
  matchHistoryRef, 
  matchInningsHistoryRef,
  get,
  set,
  onValue,
  ref,
  push,
  serverTimestamp,
  remove,
  DataSnapshot,
  DatabaseReference
} from './db';
