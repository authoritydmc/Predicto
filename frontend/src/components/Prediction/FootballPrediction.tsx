import { useState } from 'react';
import type { FormEvent } from 'react';

interface FootballPredictionProps {
  teamA: string;
  teamB: string;
  name: string;
  isMatchCompleted: boolean;
  predictionsEnabled: boolean;
  predictionsPaused: boolean;
  pauseReason: string;
  disableReason: string;
  hasPredicted?: boolean;
  previousPrediction?: any;
  allowReprediction?: boolean;
  onNameChange: (name: string) => void;
  onSubmit: (e: FormEvent, data: any) => void;
  loading: boolean;
}

export default function FootballPrediction({
  teamA,
  teamB,
  name,
  isMatchCompleted,
  predictionsEnabled,
  predictionsPaused,
  pauseReason,
  disableReason,
  hasPredicted,
  previousPrediction,
  allowReprediction,
  onNameChange,
  onSubmit,
  loading
}: FootballPredictionProps) {
  const [winner, setWinner] = useState('');
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const data = { winner, scoreA, scoreB };
    onSubmit(e, data);
  };

  return (
    <>
      {/* Match Completed Lock Message */}
      {isMatchCompleted && (
        <div style={{
          padding: '16px',
          background: 'rgba(239, 68, 68, 0.1)',
          borderRadius: '8px',
          marginBottom: '16px',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          textAlign: 'center'
        }}>
          <p style={{ margin: 0, fontSize: '14px', color: '#ef4444', fontWeight: 600 }}>
            🔒 This match has ended. Predictions are closed.
          </p>
        </div>
      )}

      {/* Predictions Disabled Message */}
      {!isMatchCompleted && !predictionsEnabled && (
        <div style={{
          padding: '16px',
          background: 'rgba(142, 142, 147, 0.1)',
          borderRadius: '8px',
          marginBottom: '16px',
          border: '1px solid rgba(142, 142, 147, 0.3)',
          textAlign: 'center'
        }}>
          <p style={{ margin: 0, fontSize: '14px', color: '#8e8e93', fontWeight: 600 }}>
            🔒 Predictions are disabled for this match.
          </p>
          {disableReason && (
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--muted)' }}>
              {disableReason}
            </p>
          )}
        </div>
      )}

      {/* Read-only Prediction View when Disabled/Paused */}
      {!isMatchCompleted && previousPrediction && (!predictionsEnabled || predictionsPaused) && (
        <div className="football-prediction-form" style={{ opacity: 0.7 }}>
          <div style={{
            padding: '16px',
            background: 'linear-gradient(135deg, rgba(142, 142, 147, 0.15) 0%, rgba(142, 142, 147, 0.05) 100%)',
            borderRadius: '12px',
            marginBottom: '20px',
            border: '1px solid rgba(142, 142, 147, 0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '20px' }}>👁️</span>
              <p style={{ margin: 0, fontSize: '14px', color: '#8e8e93', fontWeight: 700 }}>
                Your Prediction (View Only)
              </p>
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>
              You can view your prediction but cannot modify it
            </p>
          </div>

          <div className="stack-form" style={{ pointerEvents: 'none' }}>
            <label>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>👤</span>
                Your name
              </span>
              <input value={name} readOnly className="readonly-input" />
            </label>

            <label>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🏆</span>
                Predicted winner
              </span>
              <input value={previousPrediction.winnerTeam || previousPrediction.winner || '-'} readOnly className="readonly-input" />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <label>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>⚽</span>
                  {teamA} Goals
                </span>
                <input value={previousPrediction.scoreA ?? '-'} readOnly className="readonly-input" />
              </label>
              <label>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>⚽</span>
                  {teamB} Goals
                </span>
                <input value={previousPrediction.scoreB ?? '-'} readOnly className="readonly-input" />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Predictions Paused Message */}
      {!isMatchCompleted && predictionsEnabled && predictionsPaused && (
        <div style={{
          padding: '16px',
          background: 'rgba(255, 159, 10, 0.1)',
          borderRadius: '8px',
          marginBottom: '16px',
          border: '1px solid rgba(255, 159, 10, 0.3)',
          textAlign: 'center'
        }}>
          <p style={{ margin: 0, fontSize: '14px', color: '#ff9f0a', fontWeight: 600 }}>
            ⏸️ Predictions are temporarily paused.
          </p>
          {pauseReason && (
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--muted)' }}>
              {pauseReason}
            </p>
          )}
        </div>
      )}

      {/* No Prediction Yet Message when Paused/Disabled */}
      {!isMatchCompleted && !previousPrediction && (!predictionsEnabled || predictionsPaused) && (
        <div style={{
          padding: '16px',
          background: 'rgba(142, 142, 147, 0.05)',
          borderRadius: '8px',
          marginBottom: '16px',
          border: '1px dashed rgba(142, 142, 147, 0.4)',
          textAlign: 'center'
        }}>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted)', fontWeight: 500 }}>
            📭 You have not submitted a prediction yet.
          </p>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--muted)' }}>
            Predictions will open again soon.
          </p>
        </div>
      )}

      {/* Football Prediction Form */}
      {!isMatchCompleted && predictionsEnabled && !predictionsPaused && (
        <div className="football-prediction-form">
          <div style={{
            padding: '16px',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.05) 100%)',
            borderRadius: '12px',
            marginBottom: '20px',
            border: '1px solid rgba(59, 130, 246, 0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '20px' }}>⚽</span>
              <p style={{ margin: 0, fontSize: '14px', color: '#3b82f6', fontWeight: 700 }}>
                Match Prediction
              </p>
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>
              Predict the final score
            </p>
          </div>

          <form onSubmit={handleSubmit} className="stack-form">
            <label>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>👤</span>
                Your name
              </span>
              <input
                value={name}
                onChange={e => onNameChange(e.target.value)}
                maxLength={30}
                required
                placeholder="Display name..."
                readOnly
                className="readonly-input"
              />
            </label>

            <label>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🏆</span>
                Predicted winner
              </span>
              <select value={winner} onChange={e => setWinner(e.target.value)} required>
                <option value="">Choose winner...</option>
                <option value="teamA">{teamA}</option>
                <option value="teamB">{teamB}</option>
              </select>
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <label>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>⚽</span>
                  {teamA} Goals
                </span>
                <input
                  type="number"
                  value={scoreA}
                  onChange={e => setScoreA(e.target.value)}
                  placeholder="0"
                  required
                />
              </label>
              <label>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>⚽</span>
                  {teamB} Goals
                </span>
                <input
                  type="number"
                  value={scoreB}
                  onChange={e => setScoreB(e.target.value)}
                  placeholder="0"
                  required
                />
              </label>
            </div>

            <button type="submit" className="primary-btn" disabled={loading || (hasPredicted && !allowReprediction)} style={{ marginTop: '8px' }}>
              {hasPredicted && !allowReprediction ? '🔒 Already Predicted' : loading ? 'Submitting...' : '🚀 Send Prediction'}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
