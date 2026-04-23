import React from 'react';

interface CricketMatchDetailsProps {
  fTeamA: string;
  fTeamB: string;
  fTossWinner: 'teamA' | 'teamB' | null;
  fTossDecision: 'bat' | 'bowl' | null;
  fBattingTeam: 'teamA' | 'teamB';
  fInnings: '1' | '2';
  setFTossWinner: (value: 'teamA' | 'teamB' | null) => void;
  setFTossDecision: (value: 'bat' | 'bowl' | null) => void;
  setFBattingTeam: (value: 'teamA' | 'teamB') => void;
  setFInnings: (value: '1' | '2') => void;
}

export const CricketMatchDetails: React.FC<CricketMatchDetailsProps> = ({
  fTeamA,
  fTeamB,
  fTossWinner,
  fTossDecision,
  fBattingTeam,
  fInnings,
  setFTossWinner,
  setFTossDecision,
  setFBattingTeam,
  setFInnings,
}) => {
  return (
    <>
      {/* Toss Information Section */}
      <div className="cp-section-header">
        <span>Toss Information</span>
      </div>
      <div className="cp-dual-row">
        <div className="cp-form-row">
          <label>Toss Winner</label>
          <div className="cp-radio-group">
            <div className="cp-radio-option">
              <input type="radio" id="tossWinnerA" name="tossWinner" value="teamA" checked={fTossWinner === 'teamA'} onChange={() => setFTossWinner('teamA')} />
              <label className="cp-radio-label" htmlFor="tossWinnerA">{fTeamA || 'Home Team'}</label>
            </div>
            <div className="cp-radio-option">
              <input type="radio" id="tossWinnerB" name="tossWinner" value="teamB" checked={fTossWinner === 'teamB'} onChange={() => setFTossWinner('teamB')} />
              <label className="cp-radio-label" htmlFor="tossWinnerB">{fTeamB || 'Away Team'}</label>
            </div>
          </div>
        </div>
        <div className="cp-form-row">
          <label>Toss Decision</label>
          <div className="cp-radio-group">
            <div className="cp-radio-option">
              <input type="radio" id="tossBat" name="tossDecision" value="bat" checked={fTossDecision === 'bat'} onChange={() => setFTossDecision('bat')} />
              <label className="cp-radio-label" htmlFor="tossBat">Bat First</label>
            </div>
            <div className="cp-radio-option">
              <input type="radio" id="tossBowl" name="tossDecision" value="bowl" checked={fTossDecision === 'bowl'} onChange={() => setFTossDecision('bowl')} />
              <label className="cp-radio-label" htmlFor="tossBowl">Bowl First</label>
            </div>
          </div>
        </div>
      </div>
      
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
