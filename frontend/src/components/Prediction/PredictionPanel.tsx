import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { savePrediction, saveUserGlobalProfile, userRef } from '../../firebase/services';
import { onValue } from 'firebase/database';

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

  // Sync with Global Profile
  useEffect(() => {
    return onValue(userRef(clientId), (snap) => {
      const data = snap.val();
      if (data?.name) setName(data.name);
    }, (error) => {
      console.error('[PredictionPanel] Error fetching user profile:', error);
    });
  }, [clientId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (clientId && name.trim()) {
      try {
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
        alert('Prediction submitted!');
      } catch (error) {
        console.error('[PredictionPanel] Error submitting prediction:', error);
      }
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
          />
        </label>

        <label>
          Predicted winner
          <select value={winner} onChange={e => setWinner(e.target.value)} required>
            <option value="">Choose winner...</option>
            <option value="teamA">Team A</option>
            <option value="teamB">Team B</option>
          </select>
        </label>

        <div className="dual-row">
          <label>
            Team A Forecast
            <input
              type={sport === 'cricket' ? 'text' : 'number'}
              value={scoreA}
              onChange={e => setScoreA(e.target.value)}
              placeholder={sport === 'cricket' ? "e.g. 185/4" : "0"}
              required
            />
          </label>
          <label>
            Team B Forecast
            <input
              type={sport === 'cricket' ? 'text' : 'number'}
              value={scoreB}
              onChange={e => setScoreB(e.target.value)}
              placeholder={sport === 'cricket' ? "e.g. 180/8" : "0"}
              required
            />
          </label>
        </div>

        <button type="submit" className="primary-btn">Send prediction</button>
      </form>
    </section>
  );
}
