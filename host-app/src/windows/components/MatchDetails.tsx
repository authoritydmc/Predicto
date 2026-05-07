import React, { useState } from 'react';
import { db, isFirebaseConfigured } from '../../firebase/config';
import { matchMetaRef } from '../../firebase/services';

interface MatchDetailsProps {
  matchId: string;
  tournamentId: string;
  sport: string;
}

export const MatchDetails: React.FC<MatchDetailsProps> = ({ matchId, tournamentId, sport }) => {
  const [meta, setMeta] = useState<any>(null);

  useEffect(() => {
    if (!matchId || !tournamentId || !sport) return;
    if (!isFirebaseConfigured || !db) return;

    const unsubscribe = onValue(matchMetaRef(sport, tournamentId, matchId), (snap) => {
      setMeta(snap.val());
    });

    return () => unsubscribe();
  }, [matchId, tournamentId, sport, isFirebaseConfigured, db]);

  return (
    <div className="cp-section">
      <h3>Match Details</h3>
      <div className="cp-form-row">
        <label>Match ID</label>
        <input value={matchId} readOnly style={{ background: 'rgba(255,255,255,0.02)' }} />
      </div>
      <div className="cp-form-row">
        <label>Tournament ID</label>
        <input value={tournamentId} readOnly style={{ background: 'rgba(255,255,255,0.02)' }} />
      </div>
      <div className="cp-form-row">
        <label>Sport</label>
        <input value={sport} readOnly style={{ background: 'rgba(255,255,255,0.02)' }} />
      </div>
      {meta && (
        <div className="cp-form-row">
          <label>Status</label>
          <input value={meta.status || 'N/A'} readOnly style={{ background: 'rgba(255,255,255,0.02)' }} />
        </div>
      )}
    </div>
  );
};
