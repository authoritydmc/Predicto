import { useState, useCallback, useEffect } from 'react';

import { 
  update, 
  set, 
  get, 
  onValue, 
  matchMetaRef, 
  matchLiveScoreRef, 
  matchPredictionsRef 
} from '../firebase/services';
import { isFirebaseConfigured, db } from '../firebase/db';

export const useFirebaseOperations = (matchId: string, tournamentId: string, sport: string) => {
  const [meta, setMeta] = useState<any>(null);
  const [liveScore, setLiveScore] = useState<any>(null);
  const [predictions, setPredictions] = useState<any>(null);

  const updateMeta = useCallback(async (updates: any) => {
    if (!isFirebaseConfigured || !db || !matchId || !tournamentId) return;
    try {
      await update(matchMetaRef(sport, tournamentId, matchId), updates);
      console.log(`[useFirebaseOperations] Updated meta:`, updates);
    } catch (error) {
      console.error('[useFirebaseOperations] Error updating meta:', error);
    }
  }, [matchId, tournamentId, sport, isFirebaseConfigured, db]);

  const updateLiveScore = useCallback(async (field: string, value: any) => {
    if (!isFirebaseConfigured || !db || !matchId || !tournamentId) return;
    try {
      await update(matchLiveScoreRef(sport, tournamentId, matchId), { [field]: value });
      console.log(`[useFirebaseOperations] Updated live score ${field}:`, value);
    } catch (error) {
      console.error(`[useFirebaseOperations] Error updating live score ${field}:`, error);
    }
  }, [matchId, tournamentId, sport, isFirebaseConfigured, db]);

  const updatePredictions = useCallback(async (updates: any) => {
    if (!isFirebaseConfigured || !db || !matchId || !tournamentId) return;
    try {
      await update(matchPredictionsRef(sport, tournamentId, matchId), updates);
      console.log(`[useFirebaseOperations] Updated predictions:`, updates);
    } catch (error) {
      console.error('[useFirebaseOperations] Error updating predictions:', error);
    }
  }, [matchId, tournamentId, sport, isFirebaseConfigured, db]);

  // Subscribe to Firebase updates
  useEffect(() => {
    if (!matchId || !tournamentId || !sport) return;

    const unsubscribeMeta = onValue(matchMetaRef(sport, tournamentId, matchId), (snap) => {
      setMeta(snap.val());
    });

    const unsubscribeLiveScore = onValue(matchLiveScoreRef(sport, tournamentId, matchId), (snap) => {
      setLiveScore(snap.val());
    });

    const unsubscribePredictions = onValue(matchPredictionsRef(sport, tournamentId, matchId), (snap) => {
      setPredictions(snap.val());
    });

    return () => {
      unsubscribeMeta();
      unsubscribeLiveScore();
      unsubscribePredictions();
    };
  }, [matchId, tournamentId, sport]);

  return {
    meta,
    liveScore,
    predictions,
    updateMeta,
    updateLiveScore,
    updatePredictions
  };
};
