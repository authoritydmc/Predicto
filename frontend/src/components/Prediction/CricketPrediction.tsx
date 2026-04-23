import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { applyPenalty } from '../../firebase/services';
import { CRICKET_PENALTIES } from '../../constants/penalties';

interface CricketPredictionProps {
  teamA: string;
  teamB: string;
  name: string;
  matchStatus: string;
  battingFirst: 'teamA' | 'teamB' | null;
  currentInnings: number;
  isMatchCompleted: boolean;
  predictionsEnabled: boolean;
  predictionsPaused: boolean;
  pauseReason: string;
  disableReason: string;
  targetScore: number | null;
  allowReprediction: boolean;
  hasPredicted: boolean;
  previousPrediction: any;
  sport: string;
  id: string;
  matchId: string;
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
  isMatchCompleted,
  predictionsEnabled,
  predictionsPaused,
  pauseReason,
  disableReason,
  targetScore,
  allowReprediction,
  hasPredicted,
  previousPrediction,
  sport,
  id,
  matchId,
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
  const [secondInningsChasingScore, setSecondInningsChasingScore] = useState('');
  const [secondInningsWinOvers, setSecondInningsWinOvers] = useState('');

  // Pre-select winner based on previous prediction
  useEffect(() => {
    if (previousPrediction) {
      if (previousPrediction.predictedWinner) {
        setWinner(previousPrediction.predictedWinner);
      }
      if (previousPrediction.secondInningsWinner) {
        setSecondInningsWinner(previousPrediction.secondInningsWinner);
      }
    }
  }, [previousPrediction]);

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

  console.log('[CricketPrediction] Render state:', {
    isMatchCompleted,
    predictionsEnabled,
    predictionsPaused,
    matchStatus,
    battingFirst,
    currentInnings,
    targetScore
  });

  const handleSecondInningsPrediction = (e: FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!secondInningsWinner) {
      alert('Please select who you think will win.');
      return;
    }
    
    const chasingTeam = battingFirst === 'teamA' ? 'teamB' : 'teamA';
    
    if (secondInningsWinner === chasingTeam) {
      // Chasing team wins - need overs
      if (!secondInningsWinOvers.trim()) {
        alert(`Please enter in how many overs ${secondInningsWinner === 'teamA' ? teamA : teamB} will win (e.g., 18.2).`);
        return;
      }
      const oversRegex = /^\d+\.\d$/;
      if (!oversRegex.test(secondInningsWinOvers.trim())) {
        alert('Invalid format. Please enter overs as "overs.balls" (e.g., 18.2).');
        return;
      }
    } else {
      // First batting team wins - need chasing team's final score
      if (!secondInningsChasingScore.trim()) {
        alert(`Please enter ${chasingTeam === 'teamA' ? teamA : teamB}'s final score (e.g., 180).`);
        return;
      }
      const scoreRegex = /^\d+$/;
      if (!scoreRegex.test(secondInningsChasingScore.trim())) {
        alert('Invalid format. Please enter score as a number (e.g., 180).');
        return;
      }
    }
    
    const data: any = {
      secondInningsWinner
    };
    // Only include the relevant field based on who is predicted to win
    if (secondInningsWinner === chasingTeam) {
      data.secondInningsWinOvers = secondInningsWinOvers;
    } else {
      data.secondInningsChasingScore = secondInningsChasingScore;
    }
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

            <button type="submit" className="primary-btn" disabled={loading || (hasPredicted && !allowReprediction)} style={{ marginTop: '8px' }}>
              {hasPredicted && !allowReprediction ? '🔒 Already Predicted' : loading ? 'Submitting...' : '🚀 Send Prediction'}
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

            <button type="submit" className="primary-btn" disabled={loading || (hasPredicted && !allowReprediction)} style={{ marginTop: '8px' }}>
              {hasPredicted && !allowReprediction ? '🔒 Already Predicted' : loading ? 'Submitting...' : '🚀 Send Prediction'}
            </button>
          </form>
        </div>
      )}

      {/* Second Innings */}
      {!isMatchCompleted && predictionsEnabled && !predictionsPaused && currentInnings === 2 && (
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>
                {battingFirst === 'teamA' ? teamA : teamB} batted first (1st innings)
              </p>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>
                {battingFirst === 'teamA' ? teamB : teamA} batting now (2nd innings)
              </p>
            </div>
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
                onChange={async e => {
                  const newValue = e.target.value as 'teamA' | 'teamB';
                  // Check if user is switching from their previous prediction
                  if (previousPrediction?.secondInningsWinner && 
                      previousPrediction.secondInningsWinner !== newValue &&
                      previousPrediction.secondInningsWinner !== '') {
                    const confirmed = confirm(
                      `⚠️ Warning: Switching your winner prediction will apply a -20 point penalty.\n\nPrevious: ${previousPrediction.secondInningsWinner === 'teamA' ? teamA : teamB}\nNew: ${newValue === 'teamA' ? teamA : teamB}\n\nDo you want to continue?`
                    );
                    if (confirmed) {
                      setSecondInningsWinner(newValue);
                      // Apply penalty using consistent constant (backend calculates points)
                      try {
                        await applyPenalty(
                          sport, 
                          id, 
                          name, 
                          matchId, 
                          CRICKET_PENALTIES.INCONSISTENT_WINNER, 
                          'Switching winner prediction in second innings'
                        );
                      } catch (error) {
                        console.error('[CricketPrediction] Error applying penalty:', error);
                      }
                    }
                  } else {
                    setSecondInningsWinner(newValue);
                  }
                }}
                required
              >
                <option value="">Choose winner...</option>
                <option value="teamA">{teamA}</option>
                <option value="teamB">{teamB}</option>
              </select>
            </label>

            {secondInningsWinner && (
              <>
                {(() => {
                  const chasingTeam = battingFirst === 'teamA' ? 'teamB' : 'teamA';
                  const chasingTeamName = chasingTeam === 'teamA' ? teamA : teamB;
                  const firstBattingTeamName = battingFirst === 'teamA' ? teamA : teamB;
                  const selectedWinnerName = secondInningsWinner === 'teamA' ? teamA : teamB;

                  console.log('[CricketPrediction] Second innings logic:', {
                    battingFirst,
                    chasingTeam,
                    secondInningsWinner,
                    isChasingTeamWinner: secondInningsWinner === chasingTeam
                  });

                  if (secondInningsWinner === chasingTeam) {
                    // Chasing team wins - ask for overs
                    return (
                      <label>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>⏱️</span>
                          {selectedWinnerName} will chase in
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
                    );
                  } else {
                    // First batting team wins - ask for chasing team's final score
                    const winMargin = targetScore && secondInningsChasingScore 
                      ? targetScore - parseInt(secondInningsChasingScore) 
                      : null;
                    return (
                      <label>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>📊</span>
                          {chasingTeamName} Final Score
                        </span>
                        <input
                          type="number"
                          value={secondInningsChasingScore}
                          onChange={e => setSecondInningsChasingScore(e.target.value)}
                          placeholder="e.g. 180"
                          required
                        />
                        {winMargin !== null && winMargin > 0 && (
                          <p style={{ fontSize: '12px', color: '#34c759', fontWeight: 600, marginTop: '4px' }}>
                            {selectedWinnerName} will win by {winMargin} runs
                          </p>
                        )}
                        <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
                          Target: {targetScore || '-'}
                        </p>
                      </label>
                    );
                  }
                })()}
              </>
            )}

            <button type="submit" className="primary-btn" disabled={loading || (hasPredicted && !allowReprediction)} style={{ marginTop: '8px' }}>
              {hasPredicted && !allowReprediction ? '🔒 Already Predicted' : loading ? 'Submitting...' : '🚀 Send Prediction'}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
