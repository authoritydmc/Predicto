import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { savePrediction, saveUserGlobalProfile, userRef, matchMetaRef } from '../../firebase/services';
import { onValue, get } from 'firebase/database';

interface PredictionPanelProps {
  sport: string;
  id: string;
  matchId?: string;
  clientId: string;
}

export default function PredictionPanel({ sport, id, matchId, clientId }: PredictionPanelProps) {
  const [name, setName] = useState('');
  const [winner, setWinner] = useState('');
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [teamA, setTeamA] = useState('Team A');
  const [teamB, setTeamB] = useState('Team B');
  const [loading, setLoading] = useState(false);

  console.log('[PredictionPanel] Component mounted with props:', { sport, id, matchId, clientId });

  // Load match meta to get team names
  useEffect(() => {
    if (!matchId) {
      console.log('[PredictionPanel] No matchId provided, skipping meta load');
      return;
    }
    const loadMatchMeta = async () => {
      try {
        console.log('[PredictionPanel] Loading match meta for:', { sport, id, matchId });
        const snap = await get(matchMetaRef(sport, id, matchId));
        const data = snap.val();
        console.log('[PredictionPanel] Match meta data:', data);
        if (data?.teamA) {
          setTeamA(data.teamA);
          console.log('[PredictionPanel] Set teamA:', data.teamA);
        }
        if (data?.teamB) {
          setTeamB(data.teamB);
          console.log('[PredictionPanel] Set teamB:', data.teamB);
        }
      } catch (error) {
        console.error('[PredictionPanel] Error loading match meta:', error);
      }
    };
    loadMatchMeta();
  }, [sport, id, matchId]);

  // Sync with Global Profile
  useEffect(() => {
    console.log('[PredictionPanel] Setting up user profile listener for clientId:', clientId);
    return onValue(userRef(clientId), (snap) => {
      const data = snap.val();
      console.log('[PredictionPanel] User profile data received:', data);
      if (data?.username) {
        setName(data.username);
        console.log('[PredictionPanel] Set name from profile:', data.username);
      }
    }, (error) => {
      console.error('[PredictionPanel] Error fetching user profile:', error);
    });
  }, [clientId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (clientId && name.trim()) {
      setLoading(true);
      try {
        console.log('[PredictionPanel] Submitting prediction:', { name, winner, scoreA, scoreB });
        
        // 1. Save global profile (to remember name for chat/other matches)
        await saveUserGlobalProfile(clientId, { name });

        // 2. Save prediction for this specific match
        await savePrediction(sport, id, clientId, {
          userId: clientId,
          name: name,
          predictedWinner: winner,
          scoreA: scoreA,
          scoreB: scoreB,
          sportType: sport
        }, matchId);
        
        console.log('[PredictionPanel] Prediction submitted successfully');
        alert('Prediction submitted!');
        
        // Clear form
        setWinner('');
        setScoreA('');
        setScoreB('');
      } catch (error) {
        console.error('[PredictionPanel] Error submitting prediction:', error);
        alert('Error submitting prediction. Please try again.');
      } finally {
        setLoading(false);
      }
    } else {
      alert('Please enter your name to submit a prediction.');
    }
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Predict & Win • {sport.toUpperCase()}</p>
          <h2>Submit your call</h2>
        </div>
        <span className="status-pill status-live">Live</span>
      </div>

      <form onSubmit={handleSubmit} className="stack-form">
        <label>
          Your name
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={30}
            required
            placeholder="Display name..."
            readOnly
            className="readonly-input"
          />
        </label>

        <label>
          Predicted winner
          <select value={winner} onChange={e => setWinner(e.target.value)} required>
            <option value="">Choose winner...</option>
            <option value="teamA">{teamA}</option>
            <option value="teamB">{teamB}</option>
          </select>
        </label>

        <div className="dual-row">
          <label>
            {teamA} Forecast
            <input
              type={sport === 'cricket' ? 'text' : 'number'}
              value={scoreA}
              onChange={e => setScoreA(e.target.value)}
              placeholder={sport === 'cricket' ? "e.g. 185/4" : "0"}
              required
            />
          </label>
          <label>
            {teamB} Forecast
            <input
              type={sport === 'cricket' ? 'text' : 'number'}
              value={scoreB}
              onChange={e => setScoreB(e.target.value)}
              placeholder={sport === 'cricket' ? "e.g. 180/8" : "0"}
              required
            />
          </label>
        </div>

        <button type="submit" className="primary-btn" disabled={loading}>
          {loading ? 'Submitting...' : 'Send prediction'}
        </button>
      </form>
    </section>
  );
}
