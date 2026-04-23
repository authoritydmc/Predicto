import { useEffect, useState } from 'react';
import { onValue } from 'firebase/database';
import { matchDiscoveryRef } from '../firebase/services';
import type { MatchContext } from '../types';

export function useMatchContext(matchCode: string | null) {
  const [context, setContext] = useState<MatchContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!matchCode) return;
    
    setLoading(true);
    setError(null);
    
    const unsub = onValue(matchDiscoveryRef(matchCode), (snap) => {
      const data = snap.val();
      if (data && data.sport && data.tournamentId) {
        setContext({ sport: data.sport, id: data.tournamentId, matchId: matchCode });
      } else {
        setError('Match not found or not active');
      }
      setLoading(false);
    }, (err) => {
      console.error('[useMatchContext] Error fetching match context:', err);
      setError('Failed to load match');
      setLoading(false);
    });

    return () => unsub();
  }, [matchCode]);

  return { context, loading, error };
}
