import { useState, FormEvent } from 'react';
import { savePrediction } from '../../firebase/services';

export default function PredictionPanel({ matchId, sportType }: { matchId: string; sportType: string }) {
  const [name, setName] = useState('');
  const [winner, setWinner] = useState('');
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (matchId && name.trim()) {
      await savePrediction(matchId, "temp-client", {
        userId: "temp-client",
        name: name,
        winner: winner,
        scoreA: scoreA,
        scoreB: scoreB,
        sportType: sportType
      });
      alert('Prediction submitted!');
    }
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Prediction • {sportType}</p>
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
            Team A Score
            <input
              type={sportType === 'cricket' ? 'text' : 'number'}
              value={scoreA}
              onChange={e => setScoreA(e.target.value)}
              placeholder={sportType === 'cricket' ? "e.g. 185/4" : "0"}
              required
            />
          </label>
          <label>
            Team B Score
            <input
              type={sportType === 'cricket' ? 'text' : 'number'}
              value={scoreB}
              onChange={e => setScoreB(e.target.value)}
              placeholder={sportType === 'cricket' ? "e.g. 180/8" : "0"}
              required
            />
          </label>
        </div>

        <button type="submit" className="primary-btn">Send prediction</button>
      </form>
    </section>
  );
}
