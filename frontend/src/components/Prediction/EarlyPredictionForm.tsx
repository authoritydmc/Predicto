import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';

interface EarlyPredictionFormProps {
  teamA: string;
  teamB: string;
  name: string;
  onNameChange: (name: string) => void;
  onSubmit: (e: FormEvent, data: any) => void;
  loading: boolean;
  hasPredicted: boolean;
  allowReprediction: boolean;
  previousPrediction: any;
}

const sanitizeRunsInput = (value: string) => value.replace(/\D/g, '').slice(0, 3);

const isRunsValue = (value: string) => /^\d{1,3}$/.test(value) && Number(value) > 0;

const getRunsError = (value: string) => {
  if (!value.trim()) return '';
  return isRunsValue(value) ? '' : 'Enter runs only, for example 185.';
};

export default function EarlyPredictionForm({
  teamA,
  teamB,
  name,
  onNameChange,
  onSubmit,
  loading,
  hasPredicted,
  allowReprediction,
  previousPrediction,
}: EarlyPredictionFormProps) {
  const [winnerTeam, setWinnerTeam] = useState('');
  const [teamAScore, setTeamAScore] = useState('');
  const [teamBScore, setTeamBScore] = useState('');

  const teamAScoreError = getRunsError(teamAScore);
  const teamBScoreError = getRunsError(teamBScore);

  // Pre-fill from previous prediction
  useEffect(() => {
    if (previousPrediction) {
      if (previousPrediction.winnerTeam) {
        const winnerTeamLower = previousPrediction.winnerTeam.toLowerCase();
        const winnerValue = winnerTeamLower === teamA.toLowerCase() ? 'teamA' : 'teamB';
        setWinnerTeam(winnerValue);
      }
      // Handle early prediction scores
      if (previousPrediction.first_innings) {
        if (previousPrediction.first_innings.teamA_batting_first) {
          setTeamAScore(String(previousPrediction.first_innings.teamA_batting_first || ''));
        }
        if (previousPrediction.first_innings.teamB_batting_first) {
          setTeamBScore(String(previousPrediction.first_innings.teamB_batting_first || ''));
        }
      }
    }
  }, [previousPrediction, teamA, teamB]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!winnerTeam) {
      alert('Please select a winner.');
      return;
    }

    if (!teamAScore.trim() || !teamBScore.trim()) {
      alert('Please enter predicted scores for both scenarios.');
      return;
    }

    if (teamAScoreError || teamBScoreError) {
      return;
    }

    const data = {
      predictionType: 'early_first_innings',
      winnerTeam: winnerTeam === 'teamA' ? teamA : teamB,
      first_innings: {
        teamA_batting_first: Number(teamAScore),
        teamB_batting_first: Number(teamBScore),
      },
    };

    onSubmit(e, data);
  };

  return (
    <div className="cricket-prediction-form">
      <div style={{
        padding: '20px',
        background: 'linear-gradient(135deg, rgba(52, 199, 89, 0.2) 0%, rgba(52, 199, 89, 0.08) 100%)',
        borderRadius: '16px',
        marginBottom: '24px',
        border: '1px solid rgba(52, 199, 89, 0.4)',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>📅</span>
            <div>
              <p style={{ margin: 0, fontSize: '16px', color: '#34c759', fontWeight: 700 }}>
                Schedule Mode Prediction
              </p>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--muted)', fontWeight: 500 }}>
                Match is scheduled - predict for both batting scenarios
              </p>
            </div>
          </div>
          <div className="scheduled-indicator" style={{
            background: 'rgba(52, 199, 89, 0.15)',
            border: '1px solid rgba(52, 199, 89, 0.3)',
            padding: '6px 12px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 600,
            color: '#34c759',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <span style={{ fontSize: '10px' }}>●</span>
            Scheduled
          </div>
        </div>
        <div style={{
          padding: '12px',
          background: 'rgba(52, 199, 89, 0.08)',
          borderRadius: '8px',
          fontSize: '12px',
          color: 'var(--muted)',
          lineHeight: '1.4'
        }}>
          <strong>💡 How it works:</strong> Predict the winner and first innings score for both possible batting scenarios. When the match starts, your prediction for the actual batting team will be used.
        </div>
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
            Match Winner
          </span>
          <select value={winnerTeam} onChange={e => setWinnerTeam(e.target.value)} required>
            <option value="">Select winner...</option>
            <option value="teamA">{teamA}</option>
            <option value="teamB">{teamB}</option>
          </select>
        </label>

        {/* Team A Batting First Scenario */}
        <div style={{
          padding: '18px',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(99, 102, 241, 0.05) 100%)',
          borderRadius: '12px',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          marginBottom: '16px'
        }}>
          <div style={{ 
            fontSize: '14px', 
            fontWeight: '700', 
            color: '#818cf8', 
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ fontSize: '16px' }}>🏏</span>
            Scenario 1: {teamA} bats first
          </div>
          <label style={{ marginBottom: '0' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '500' }}>
              <span>📊</span>
              {teamA}&apos;s score (1st innings)
            </span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={teamAScore}
              onChange={e => setTeamAScore(sanitizeRunsInput(e.target.value))}
              placeholder={`e.g. 180`}
              aria-invalid={!!teamAScoreError}
              aria-describedby="teamA-score-hint"
              required
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                borderRadius: '8px',
                padding: '12px'
              }}
            />
            <span id="teamA-score-hint" className={`field-hint ${teamAScoreError ? 'field-error' : ''}`}>
              {teamAScoreError || `Predict ${teamA}'s score if they bat first`}
            </span>
          </label>
        </div>

        {/* Team B Batting First Scenario */}
        <div style={{
          padding: '18px',
          background: 'linear-gradient(135deg, rgba(255, 159, 10, 0.15) 0%, rgba(255, 159, 10, 0.05) 100%)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 159, 10, 0.3)',
          marginBottom: '16px'
        }}>
          <div style={{ 
            fontSize: '14px', 
            fontWeight: '700', 
            color: '#ff9f0a', 
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ fontSize: '16px' }}>🏏</span>
            Scenario 2: {teamB} bats first
          </div>
          <label style={{ marginBottom: '0' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '500' }}>
              <span>📊</span>
              {teamB}&apos;s score (1st innings)
            </span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={teamBScore}
              onChange={e => setTeamBScore(sanitizeRunsInput(e.target.value))}
              placeholder={`e.g. 175`}
              aria-invalid={!!teamBScoreError}
              aria-describedby="teamB-score-hint"
              required
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 159, 10, 0.2)',
                borderRadius: '8px',
                padding: '12px'
              }}
            />
            <span id="teamB-score-hint" className={`field-hint ${teamBScoreError ? 'field-error' : ''}`}>
              {teamBScoreError || `Predict ${teamB}'s score if they bat first`}
            </span>
          </label>
        </div>

        
        <button
          type="submit"
          className="primary-btn"
          disabled={loading || !!teamAScoreError || !!teamBScoreError || (hasPredicted && !allowReprediction)}
          style={{ 
            marginTop: '16px',
            background: loading || !!teamAScoreError || !!teamBScoreError || (hasPredicted && !allowReprediction) 
              ? 'rgba(142, 142, 147, 0.2)' 
              : 'linear-gradient(135deg, rgba(52, 199, 89, 0.8) 0%, rgba(52, 199, 89, 0.6) 100%)',
            border: '1px solid rgba(52, 199, 89, 0.4)',
            padding: '14px 24px',
            fontSize: '15px',
            fontWeight: '600',
            borderRadius: '12px',
            cursor: loading || !!teamAScoreError || !!teamBScoreError || (hasPredicted && !allowReprediction) ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          {hasPredicted && !allowReprediction ? '🔒 Already Predicted' : loading ? '⏳ Submitting...' : '� Submit Schedule Prediction'}
        </button>
      </form>
    </div>
  );
}
