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

const sanitizeRunsInput = (value: string) => value.replace(/\D/g, '').slice(0, 3);

const sanitizeRunsOrOversInput = (value: string) => {
  const cleaned = value.replace(/[^\d.]/g, '');
  const [whole = '', ...rest] = cleaned.split('.');
  const decimal = rest.join('').slice(0, 1);
  return cleaned.includes('.') ? `${whole.slice(0, 2)}.${decimal}` : whole.slice(0, 3);
};

const isRunsValue = (value: string) => /^\d{1,3}$/.test(value) && Number(value) > 0;

const isOversValue = (value: string) => {
  if (!/^\d{1,2}\.[0-5]$/.test(value)) return false;
  const [overs, balls] = value.split('.').map(Number);
  return overs >= 0 && (overs < 20 || (overs === 20 && balls === 0));
};

const getRunsError = (value: string) => {
  if (!value.trim()) return '';
  return isRunsValue(value) ? '' : 'Enter runs only, for example 185. Do not include wickets like 185/4.';
};

const getRunsOrOversError = (value: string) => {
  if (!value.trim()) return '';
  return isRunsValue(value) || isOversValue(value)
    ? ''
    : 'Use runs like 180, or overs like 18.2. Overs ball must be 0-5.';
};

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
  const [winnerTeam, setWinnerTeam] = useState('');
  const [runs, setRuns] = useState('');
  const [secondInningsWinnerTeam, setSecondInningsWinnerTeam] = useState<'teamA' | 'teamB' | ''>('');
  const [secondInningsRunsOrOvers, setSecondInningsRunsOrOvers] = useState('');
  const runsError = getRunsError(runs);
  const secondInningsValueError = getRunsOrOversError(secondInningsRunsOrOvers);

  // Pre-select winner based on previous prediction
  useEffect(() => {
    if (previousPrediction) {
      if (previousPrediction.winnerTeam) {
        // Convert real team name back to teamA/teamB for the select input
        const winnerTeamLower = previousPrediction.winnerTeam.toLowerCase();
        const winnerValue = winnerTeamLower === teamA.toLowerCase() ? 'teamA' : 'teamB';
        setWinnerTeam(winnerValue);
        setRuns(sanitizeRunsInput(String(previousPrediction.runs || '')));
      }
      if (previousPrediction.winnerTeam) {
        // Use same winner for 2nd innings
        const winnerTeamLower = previousPrediction.winnerTeam.toLowerCase();
        const winnerValue = winnerTeamLower === teamA.toLowerCase() ? 'teamA' : 'teamB';
        setSecondInningsWinnerTeam(winnerValue);
        setSecondInningsRunsOrOvers(sanitizeRunsOrOversInput(String(previousPrediction.runsOrOvers || '')));
      }
    }
  }, [previousPrediction, teamA, teamB]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    
    if (!winnerTeam) {
      alert('Please select a winner.');
      return;
    }
    
    if (!runs.trim()) {
      alert('Please enter predicted runs.');
      return;
    }

    if (runsError) {
      return;
    }
    
    const data: any = {
      winnerTeam: winnerTeam === 'teamA' ? teamA : teamB,
      runs
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
    if (!secondInningsWinnerTeam) {
      alert('Please select who you think will win.');
      return;
    }
    
    if (!secondInningsRunsOrOvers.trim()) {
      alert('Please enter the prediction value (runs or overs).');
      return;
    }

    if (secondInningsValueError) {
      return;
    }
    
    const data: any = {
      winnerTeam: secondInningsWinnerTeam === 'teamA' ? teamA : teamB,
      runsOrOvers: secondInningsRunsOrOvers
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
          {disableReason && (
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--muted)' }}>
              {disableReason}
            </p>
          )}
        </div>
      )}

      {/* Read-only Prediction View when Paused/Disabled */}
      {!isMatchCompleted && previousPrediction && (!predictionsEnabled || predictionsPaused) && (
        <div className="cricket-prediction-form" style={{ opacity: 0.7 }}>
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
              <input value={previousPrediction.winnerTeam || '-'} readOnly className="readonly-input" />
            </label>

            {previousPrediction.runsOrOvers ? (
              <label>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>📊</span>
                  Predicted runs or overs
                </span>
                <input value={previousPrediction.runsOrOvers} readOnly className="readonly-input" />
              </label>
            ) : (
              <label>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>📊</span>
                  Predicted runs
                </span>
                <input value={previousPrediction.runs || '-'} readOnly className="readonly-input" />
              </label>
            )}
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
              Predict the winner and runs for the first innings
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
              <select value={winnerTeam} onChange={e => setWinnerTeam(e.target.value)} required>
                <option value="">Choose winner...</option>
                <option value="teamA">{teamA}</option>
                <option value="teamB">{teamB}</option>
              </select>
            </label>

            <label>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>📊</span>
                Predicted runs
              </span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={runs}
                onChange={e => setRuns(sanitizeRunsInput(e.target.value))}
                placeholder="e.g. 185"
                aria-invalid={!!runsError}
                aria-describedby="scheduled-runs-hint"
                required
              />
              <span id="scheduled-runs-hint" className={`field-hint ${runsError ? 'field-error' : ''}`}>
                {runsError || 'Runs only. Example: 185'}
              </span>
            </label>

            <button type="submit" className="primary-btn" disabled={loading || !!runsError || (hasPredicted && !allowReprediction)} style={{ marginTop: '8px' }}>
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
              <select value={winnerTeam} onChange={e => setWinnerTeam(e.target.value)} required>
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
                inputMode="numeric"
                pattern="[0-9]*"
                value={runs}
                onChange={e => setRuns(sanitizeRunsInput(e.target.value))}
                placeholder="e.g. 185"
                aria-invalid={!!runsError}
                aria-describedby="live-runs-hint"
                required
              />
              <span id="live-runs-hint" className={`field-hint ${runsError ? 'field-error' : ''}`}>
                {runsError || 'Runs only. Wickets are not used for scoring.'}
              </span>
            </label>

            <button type="submit" className="primary-btn" disabled={loading || !!runsError || (hasPredicted && !allowReprediction)} style={{ marginTop: '8px' }}>
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
                value={secondInningsWinnerTeam}
                onChange={async e => {
                  const newValue = e.target.value as 'teamA' | 'teamB';
                  // Check if user is switching from their previous winnerTeam prediction
                  if (previousPrediction?.winnerTeam && 
                      previousPrediction.winnerTeam !== (newValue === 'teamA' ? teamA : teamB) &&
                      previousPrediction.winnerTeam !== '') {
                    const confirmed = confirm(
                      `⚠️ Warning: Switching your winner prediction will apply a -20 point penalty.\n\nPrevious: ${previousPrediction.winnerTeam}\nNew: ${newValue === 'teamA' ? teamA : teamB}\n\nDo you want to continue?`
                    );
                    if (confirmed) {
                      setSecondInningsWinnerTeam(newValue);
                      // Apply penalty using consistent constant (backend calculates points)
                      try {
                        await applyPenalty(
                          sport, 
                          id, 
                          name, 
                          matchId, 
                          CRICKET_PENALTIES.INCONSISTENT_WINNER, 
                          'Switching winner prediction'
                        );
                      } catch (error) {
                        console.error('[CricketPrediction] Error applying penalty:', error);
                      }
                    }
                  } else {
                    setSecondInningsWinnerTeam(newValue);
                  }
                }}
                required
              >
                <option value="">Choose winner...</option>
                <option value="teamA">{teamA}</option>
                <option value="teamB">{teamB}</option>
              </select>
            </label>

            <label>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>📊</span>
                Predicted runs or overs
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={secondInningsRunsOrOvers}
                onChange={e => setSecondInningsRunsOrOvers(sanitizeRunsOrOversInput(e.target.value))}
                placeholder="e.g. 180 (runs) or 18.2 (overs)"
                aria-invalid={!!secondInningsValueError}
                aria-describedby="second-innings-value-hint"
                required
              />
              <span id="second-innings-value-hint" className={`field-hint ${secondInningsValueError ? 'field-error' : ''}`}>
                {secondInningsValueError || 'Runs are plain numbers. Overs use balls after the dot, e.g. 18.2'}
              </span>
            </label>

            <button type="submit" className="primary-btn" disabled={loading || !!secondInningsValueError || (hasPredicted && !allowReprediction)} style={{ marginTop: '8px' }}>
              {hasPredicted && !allowReprediction ? '🔒 Already Predicted' : loading ? 'Submitting...' : '🚀 Send Prediction'}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
