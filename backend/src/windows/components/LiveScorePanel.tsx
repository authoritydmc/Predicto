import React, { useState } from 'react';
import { db, isFirebaseConfigured } from '../../firebase/config';
import { matchLiveScoreRef, update } from '../../firebase/services';

interface LiveScorePanelProps {
  matchId: string;
  tournamentId: string;
  sport: string;
}

export const LiveScorePanel: React.FC<LiveScorePanelProps> = ({ matchId, tournamentId, sport }) => {
  const [liveScore, setLiveScore] = useState<any>(null);

  useEffect(() => {
    if (!matchId || !tournamentId || !sport) return;
    if (!isFirebaseConfigured || !db) return;

    const unsubscribe = onValue(matchLiveScoreRef(sport, tournamentId, matchId), (snap) => {
      setLiveScore(snap.val());
    });

    return () => unsubscribe();
  }, [matchId, tournamentId, sport, isFirebaseConfigured, db]);

  const handleUpdateScore = async (field: string, value: string) => {
    if (!isFirebaseConfigured || !db) return;
    
    try {
      await update(matchLiveScoreRef(sport, tournamentId, matchId), { [field]: value });
      console.log(`[LiveScorePanel] Updated ${field}: ${value}`);
    } catch (error) {
      console.error('[LiveScorePanel] Error updating score:', error);
    }
  };

  return (
    <div className="cp-section">
      <h3>Live Score</h3>
      <div className="cp-form-row">
        <label>Score A</label>
        <input 
          type="text" 
          value={liveScore?.scoreA || ''}
          onChange={(e) => handleUpdateScore('scoreA', e.target.value)}
          placeholder="0"
        />
      </div>
      <div className="cp-form-row">
        <label>Score B</label>
        <input 
          type="text" 
          value={liveScore?.scoreB || ''}
          onChange={(e) => handleUpdateScore('scoreB', e.target.value)}
          placeholder="0"
        />
      </div>
      <div className="cp-form-row">
        <label>Wickets A</label>
        <input 
          type="text" 
          value={liveScore?.wicketsA || ''}
          onChange={(e) => handleUpdateScore('wicketsA', e.target.value)}
          placeholder="0"
        />
      </div>
      <div className="cp-form-row">
        <label>Wickets B</label>
        <input 
          type="text" 
          value={liveScore?.wicketsB || ''}
          onChange={(e) => handleUpdateScore('wicketsB', e.target.value)}
          placeholder="0"
        />
      </div>
      <div className="cp-form-row">
        <label>Overs A</label>
        <input 
          type="text" 
          value={liveScore?.oversA || ''}
          onChange={(e) => handleUpdateScore('oversA', e.target.value)}
          placeholder="0.0"
        />
      </div>
      <div className="cp-form-row">
        <label>Overs B</label>
        <input 
          type="text" 
          value={liveScore?.oversB || ''}
          onChange={(e) => handleUpdateScore('oversB', e.target.value)}
          placeholder="0.0"
        />
      </div>
      <div className="cp-form-row">
        <label>Target Score</label>
        <input 
          type="text" 
          value={liveScore?.targetScore || ''}
          onChange={(e) => handleUpdateScore('targetScore', e.target.value)}
          placeholder="0"
        />
      </div>
    </div>
  );
};
