import { useEffect, useState } from 'react';
import { onValue, get } from 'firebase/database';
import { matchMetaRef } from '../firebase/services';
import type { MatchMeta, MatchContext } from '../types';

export function useMatchMeta(context: MatchContext | null) {
  const [meta, setMeta] = useState<MatchMeta | null>(null);
  const [status, setStatus] = useState<'live' | 'scheduled' | 'done' | null>(null);

  useEffect(() => {
    if (!context) return;
    
    const { sport, id, matchId } = context;
    
    // Initial status check
    const checkStatus = async () => {
      try {
        const snap = await get(matchMetaRef(sport, id, matchId));
        const data = snap.val();
        if (data?.status) {
          setStatus(data.status);
        } else {
          setStatus('live');
        }
      } catch (error) {
        console.error('[useMatchMeta] Error fetching status:', error);
        setStatus('live');
      }
    };
    
    checkStatus();

    // Subscribe to meta updates
    const unsub = onValue(matchMetaRef(sport, id, matchId), (snap) => {
      const data = snap.val();
      setMeta(data);
    }, (error) => {
      console.error('[useMatchMeta] Error fetching match meta:', error);
    });

    return () => unsub();
  }, [context]);

  return { meta, status };
}
