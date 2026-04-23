import React from 'react';

interface CricketMatchDetailsProps {
  fTeamA: string;
  fTeamB: string;
  fBattingTeam: 'teamA' | 'teamB';
  fInnings: '1' | '2';
  setFBattingTeam: (value: 'teamA' | 'teamB') => void;
  setFInnings: (value: '1' | '2') => void;
}

export const CricketMatchDetails: React.FC<CricketMatchDetailsProps> = ({
  fTeamA,
  fTeamB,
  fBattingTeam,
  fInnings,
  setFBattingTeam,
  setFInnings,
}) => {
  return (
    <>
      {/* Match Status Section */}
      <div className="cp-section-header">
        <span>Match Status</span>
      </div>
      <div className="cp-dual-row">
        <div className="cp-form-row">
          <label>Batting Team (Active Predictions)</label>
          <div className="cp-radio-group">
            <div className="cp-radio-option">
              <input type="radio" id="battingA" name="battingTeam" value="teamA" checked={fBattingTeam === 'teamA'} onChange={() => setFBattingTeam('teamA')} />
              <label className="cp-radio-label" htmlFor="battingA">{fTeamA || 'Home Team'}</label>
            </div>
            <div className="cp-radio-option">
              <input type="radio" id="battingB" name="battingTeam" value="teamB" checked={fBattingTeam === 'teamB'} onChange={() => setFBattingTeam('teamB')} />
              <label className="cp-radio-label" htmlFor="battingB">{fTeamB || 'Away Team'}</label>
            </div>
          </div>
        </div>
        <div className="cp-form-row">
          <label>Current Innings</label>
          <div className="cp-radio-group">
            <div className="cp-radio-option">
              <input type="radio" id="innings1st" name="innings" value="1" checked={fInnings === '1'} onChange={() => setFInnings('1')} />
              <label className="cp-radio-label" htmlFor="innings1st">1st Innings</label>
            </div>
            <div className="cp-radio-option">
              <input type="radio" id="innings2nd" name="innings" value="2" checked={fInnings === '2'} onChange={() => setFInnings('2')} />
              <label className="cp-radio-label" htmlFor="innings2nd">2nd Innings</label>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
