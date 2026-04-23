import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';

interface CricketPredictionProps {
  teamA: string;
  teamB: string;
  name: string;
  matchStatus: string;
  battingFirst: 'teamA' | 'teamB' | null;
  currentInnings: number;
  showSecondInningsPrediction: boolean;
  isMatchCompleted: boolean;
  predictionsEnabled: boolean;
  predictionsPaused: boolean;
  pauseReason: string;
  onNameChange: (name: string) => void;
  onSubmit: (e: FormEvent, data: any) => void;
  loading: boolean;
}

export default function CricketPrediction({
  teamA,
  teamB,
  name,
  matchStatus,
  battingFirst,
  currentInnings,
  showSecondInningsPrediction,
  isMatchCompleted,
  predictionsEnabled,
  predictionsPaused,
  pauseReason,
  onNameChange,
  onSubmit,
  loading
}: CricketPredictionProps) {
  const [winner, setWinner] = useState('');
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [teamABattingFirstScore, setTeamABattingFirstScore] = useState('');
  const [teamBBattingFirstScore, setTeamBBattingFirstScore] = useState('');
  const [secondInningsWinner, setSecondInningsWinner] = useState<'teamA' | 'teamB' | ''>('');
  const [secondInningsAllOutScore, setSecondInningsAllOutScore] = useState('');
  const [secondInningsWinOvers, setSecondInningsWinOvers] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const data: any = {
      winner,
      scoreA,
      scoreB,
      teamABattingFirstScore,
      teamBBattingFirstScore
    };
    onSubmit(e, data);
  };

  const handleSecondInningsPrediction = (e: FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!secondInningsWinner) {
      alert('Please select who you think will win.');
      return;
    }
    
    const firstTeam = battingFirst;
    
    if (secondInningsWinner === firstTeam) {
      if (!secondInningsAllOutScore.trim()) {
        alert('Please enter the chasing team\'s all-out score (e.g., 182/10).');
        return;
      }
      const allOutRegex = /^\d+\/10$/;
      if (!allOutRegex.test(secondInningsAllOutScore.trim())) {
        alert('Invalid format. Please enter score as "runs/10" (e.g., 182/10).');
        return;
      }
    } else {
      if (!secondInningsWinOvers.trim()) {
        alert('Please enter in how many overs the chasing team will win (e.g., 18.2).');
        return;
      }
      const oversRegex = /^\d+\.\d$/;
      if (!oversRegex.test(secondInningsWinOvers.trim())) {
        alert('Invalid format. Please enter overs as "overs.balls" (e.g., 18.2).');
        return;
      }
    }
    
    const data: any = {
      secondInningsWinner,
      secondInningsAllOutScore,
      secondInningsWinOvers
    };
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

      {/* Scheduled Match */}
      {!isMatchCompleted && predictionsEnabled && !predictionsPaused && matchStatus === 'scheduled' && (
        <div className="cricket-prediction-form">
          <div style={{
            padding: '16px',
            background: 'linear-gradient(135deg, rgba(52, 199, 89, 0.15) 0%, rgba(52, 199, 89, 0.05) 100%)',
            borderRadius: '12px',
            marginBottom: '20px',
            border: '1px solid rgba(52, 199, 89, 0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '20px' }}>🏏</span>
              <p style={{ margin: 0, fontSize: '14px', color: '#34c759', fontWeight: 700 }}>
                Early First Innings Prediction
              </p>
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>
              Predict both scenarios: if {teamA} bats first and if {teamB} bats first
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
                  <span>📊</span>
                  If {teamA} bats first
                </span>
                <input
                  type="text"
                  value={teamABattingFirstScore}
                  onChange={e => setTeamABattingFirstScore(e.target.value)}
                  placeholder="e.g. 185/4"
                  required
                />
              </label>
              <label>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>📊</span>
                  If {teamB} bats first
                </span>
                <input
                  type="text"
                  value={teamBBattingFirstScore}
                  onChange={e => setTeamBBattingFirstScore(e.target.value)}
                  placeholder="e.g. 180/8"
                  required
                />
              </label>
            </div>

            <button type="submit" className="primary-btn" disabled={loading} style={{ marginTop: '8px' }}>
              {loading ? 'Submitting...' : '🚀 Send Prediction'}
            </button>
          </form>
        </div>
      )}

      {/* Live Match - First Innings */}
      {!isMatchCompleted && predictionsEnabled && !predictionsPaused && matchStatus === 'live' && battingFirst && currentInnings === 1 && (
        <div className="cricket-prediction-form">
          <div style={{
            padding: '16px',
            background: 'linear-gradient(135deg, rgba(255, 159, 10, 0.15) 0%, rgba(255, 159, 10, 0.05) 100%)',
            borderRadius: '12px',
            marginBottom: '20px',
            border: '1px solid rgba(255, 159, 10, 0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '20px' }}>🏏</span>
              <p style={{ margin: 0, fontSize: '14px', color: '#ff9f0a', fontWeight: 700 }}>
                First Innings Live
              </p>
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>
              {battingFirst === 'teamA' ? teamA : teamB} is batting first
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

            <label>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>📊</span>
                {battingFirst === 'teamA' ? teamA : teamB} Final Score
              </span>
              <input
                type="text"
                value={battingFirst === 'teamA' ? scoreA : scoreB}
                onChange={e => {
                  if (battingFirst === 'teamA') setScoreA(e.target.value);
                  else setScoreB(e.target.value);
                }}
                placeholder="e.g. 185/4"
                required
              />
            </label>

            <button type="submit" className="primary-btn" disabled={loading} style={{ marginTop: '8px' }}>
              {loading ? 'Submitting...' : '🚀 Send Prediction'}
            </button>
          </form>
        </div>
      )}

      {/* Second Innings */}
      {!isMatchCompleted && predictionsEnabled && !predictionsPaused && currentInnings === 2 && showSecondInningsPrediction && (
        <div className="cricket-prediction-form">
          <div style={{
            padding: '16px',
            background: 'linear-gradient(135deg, rgba(52, 199, 89, 0.15) 0%, rgba(52, 199, 89, 0.05) 100%)',
            borderRadius: '12px',
            marginBottom: '20px',
            border: '1px solid rgba(52, 199, 89, 0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '20px' }}>🎯</span>
              <p style={{ margin: 0, fontSize: '14px', color: '#34c759', fontWeight: 700 }}>
                Second Innings Prediction
              </p>
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>
              Update your prediction for the chase
            </p>
          </div>

          <form onSubmit={handleSecondInningsPrediction} className="stack-form">
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
                Who will win?
              </span>
              <select
                value={secondInningsWinner}
                onChange={e => setSecondInningsWinner(e.target.value as 'teamA' | 'teamB')}
                required
              >
                <option value="">Choose winner...</option>
                <option value="teamA">{teamA}</option>
                <option value="teamB">{teamB}</option>
              </select>
            </label>

            {secondInningsWinner && (
              <>
                {secondInningsWinner === (battingFirst === 'teamA' ? 'teamA' : 'teamB') ? (
                  <label>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>📊</span>
                      {battingFirst === 'teamA' ? teamB : teamA} All-Out Score
                    </span>
                    <input
                      type="text"
                      value={secondInningsAllOutScore}
                      onChange={e => setSecondInningsAllOutScore(e.target.value)}
                      placeholder="e.g. 182/10 (must be all out)"
                      required
                    />
                    <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
                      Format: runs/10 (e.g., 182/10) - chasing team must be all out
                    </p>
                  </label>
                ) : (
                  <label>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>⏱️</span>
                      {battingFirst === 'teamA' ? teamB : teamA} will win in
                    </span>
                    <input
                      type="text"
                      value={secondInningsWinOvers}
                      onChange={e => setSecondInningsWinOvers(e.target.value)}
                      placeholder="e.g. 18.2"
                      required
                    />
                    <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
                      Format: overs.balls (e.g., 18.2)
                    </p>
                  </label>
                )}
              </>
            )}

            <button type="submit" className="primary-btn" disabled={loading} style={{ marginTop: '8px' }}>
              {loading ? 'Submitting...' : '🚀 Send Prediction'}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
