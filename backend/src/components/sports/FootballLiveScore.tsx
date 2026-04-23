import React from 'react';

interface FootballLiveScoreProps {
  fTeamA: string;
  fTeamB: string;
  scoreTeamARuns: string;
  scoreTeamBRuns: string;
  setScoreTeamARuns: (value: string) => void;
  setScoreTeamBRuns: (value: string) => void;
}

export const FootballLiveScore: React.FC<FootballLiveScoreProps> = ({
  fTeamA,
  fTeamB,
  scoreTeamARuns,
  scoreTeamBRuns,
  setScoreTeamARuns,
  setScoreTeamBRuns,
}) => {
  return (
    <>
      <div className="cp-divider" style={{ margin: '12px 0' }} />
      <div style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--accent-blue)' }}>{fTeamA || 'Team A'}</div>
      <div className="cp-form-row">
        <label>Goals</label>
        <input type="number" value={scoreTeamARuns} onChange={e => setScoreTeamARuns(e.target.value)} placeholder="0" />
      </div>
      <div className="cp-divider" style={{ margin: '12px 0' }} />
      <div style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--accent-blue)' }}>{fTeamB || 'Team B'}</div>
      <div className="cp-form-row">
        <label>Goals</label>
        <input type="number" value={scoreTeamBRuns} onChange={e => setScoreTeamBRuns(e.target.value)} placeholder="0" />
      </div>
    </>
  );
};
