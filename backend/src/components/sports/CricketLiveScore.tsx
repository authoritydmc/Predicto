import React from 'react';

interface CricketLiveScoreProps {
  fTeamA: string;
  fTeamB: string;
  fTossWinner: 'teamA' | 'teamB' | null;
  fTossDecision: 'bat' | 'bowl' | null;
  fBattingTeam: 'teamA' | 'teamB';
  fInnings: '1' | '2';
  scoreTeamARuns: string;
  scoreTeamAWickets: string;
  scoreTeamAOvers: string;
  scoreTeamBRuns: string;
  scoreTeamBWickets: string;
  scoreTeamBOvers: string;
  setFTossWinner: (value: 'teamA' | 'teamB' | null) => void;
  setFTossDecision: (value: 'bat' | 'bowl' | null) => void;
  setFBattingTeam: (value: 'teamA' | 'teamB') => void;
  setFInnings: (value: '1' | '2') => void;
  setScoreTeamARuns: (value: string) => void;
  setScoreTeamAWickets: (value: string) => void;
  setScoreTeamAOvers: (value: string) => void;
  setScoreTeamBRuns: (value: string) => void;
  setScoreTeamBWickets: (value: string) => void;
  setScoreTeamBOvers: (value: string) => void;
}

export const CricketLiveScore: React.FC<CricketLiveScoreProps> = ({
  fTeamA,
  fTeamB,
  fTossWinner,
  fTossDecision,
  fBattingTeam,
  fInnings,
  scoreTeamARuns,
  scoreTeamAWickets,
  scoreTeamAOvers,
  scoreTeamBRuns,
  scoreTeamBWickets,
  scoreTeamBOvers,
  setFTossWinner,
  setFTossDecision,
  setFBattingTeam,
  setFInnings,
  setScoreTeamARuns,
  setScoreTeamAWickets,
  setScoreTeamAOvers,
  setScoreTeamBRuns,
  setScoreTeamBWickets,
  setScoreTeamBOvers,
}) => {
  return (
    <>
      <div className="cp-divider" style={{ margin: '12px 0' }} />
      
      {/* Toss Information */}
      <div className="cp-section-header">
        <span>Toss Information</span>
      </div>
      <div className="cp-dual-row">
        <div className="cp-form-row">
          <label>Toss Winner</label>
          <div className="cp-radio-group">
            <div className="cp-radio-option">
              <input type="radio" id="liveTossWinnerA" name="liveTossWinner" value="teamA" checked={fTossWinner === 'teamA'} onChange={() => setFTossWinner('teamA')} />
              <label className="cp-radio-label" htmlFor="liveTossWinnerA">{fTeamA || 'Team A'}</label>
            </div>
            <div className="cp-radio-option">
              <input type="radio" id="liveTossWinnerB" name="liveTossWinner" value="teamB" checked={fTossWinner === 'teamB'} onChange={() => setFTossWinner('teamB')} />
              <label className="cp-radio-label" htmlFor="liveTossWinnerB">{fTeamB || 'Team B'}</label>
            </div>
          </div>
        </div>
        <div className="cp-form-row">
          <label>Toss Decision</label>
          <div className="cp-radio-group">
            <div className="cp-radio-option">
              <input type="radio" id="liveTossBat" name="liveTossDecision" value="bat" checked={fTossDecision === 'bat'} onChange={() => setFTossDecision('bat')} />
              <label className="cp-radio-label" htmlFor="liveTossBat">Bat First</label>
            </div>
            <div className="cp-radio-option">
              <input type="radio" id="liveTossBowl" name="liveTossDecision" value="bowl" checked={fTossDecision === 'bowl'} onChange={() => setFTossDecision('bowl')} />
              <label className="cp-radio-label" htmlFor="liveTossBowl">Bowl First</label>
            </div>
          </div>
        </div>
      </div>
      
      <div className="cp-divider" style={{ margin: '12px 0' }} />
      
      {/* Match Status */}
      <div className="cp-section-header">
        <span>Match Status</span>
      </div>
      <div className="cp-dual-row">
        <div className="cp-form-row">
          <label>Current Innings</label>
          <div className="cp-radio-group">
            <div className="cp-radio-option">
              <input type="radio" id="liveInnings1st" name="liveInnings" value="1" checked={fInnings === '1'} onChange={() => setFInnings('1')} />
              <label className="cp-radio-label" htmlFor="liveInnings1st">1st Innings</label>
            </div>
            <div className="cp-radio-option">
              <input type="radio" id="liveInnings2nd" name="liveInnings" value="2" checked={fInnings === '2'} onChange={() => setFInnings('2')} />
              <label className="cp-radio-label" htmlFor="liveInnings2nd">2nd Innings</label>
            </div>
          </div>
        </div>
        <div className="cp-form-row">
          <label>Batting Team</label>
          <div className="cp-radio-group">
            <div className="cp-radio-option">
              <input type="radio" id="liveBattingA" name="liveBattingTeam" value="teamA" checked={fBattingTeam === 'teamA'} onChange={() => setFBattingTeam('teamA')} />
              <label className="cp-radio-label" htmlFor="liveBattingA">{fTeamA || 'Team A'}</label>
            </div>
            <div className="cp-radio-option">
              <input type="radio" id="liveBattingB" name="liveBattingTeam" value="teamB" checked={fBattingTeam === 'teamB'} onChange={() => setFBattingTeam('teamB')} />
              <label className="cp-radio-label" htmlFor="liveBattingB">{fTeamB || 'Team B'}</label>
            </div>
          </div>
        </div>
      </div>
      <div className="cp-divider" style={{ margin: '12px 0' }} />
      <div style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--accent-blue)' }}>{fTeamA || 'Team A'}</div>
      <div className="cp-form-row">
        <label>Runs</label>
        <input type="number" value={scoreTeamARuns} onChange={e => setScoreTeamARuns(e.target.value)} placeholder="0" />
      </div>
      <div className="cp-form-row">
        <label>Wickets</label>
        <input type="number" value={scoreTeamAWickets} onChange={e => setScoreTeamAWickets(e.target.value)} placeholder="0" max="10" />
      </div>
      <div className="cp-form-row">
        <label>Overs</label>
        <input type="number" step="0.1" value={scoreTeamAOvers} onChange={e => setScoreTeamAOvers(e.target.value)} placeholder="0.0" />
      </div>
      <div className="cp-divider" style={{ margin: '12px 0' }} />
      <div style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--accent-blue)' }}>{fTeamB || 'Team B'}</div>
      <div className="cp-form-row">
        <label>Runs</label>
        <input type="number" value={scoreTeamBRuns} onChange={e => setScoreTeamBRuns(e.target.value)} placeholder="0" />
      </div>
      <div className="cp-form-row">
        <label>Wickets</label>
        <input type="number" value={scoreTeamBWickets} onChange={e => setScoreTeamBWickets(e.target.value)} placeholder="0" max="10" />
      </div>
      <div className="cp-form-row">
        <label>Overs</label>
        <input type="number" step="0.1" value={scoreTeamBOvers} onChange={e => setScoreTeamBOvers(e.target.value)} placeholder="0.0" />
      </div>
    </>
  );
};
