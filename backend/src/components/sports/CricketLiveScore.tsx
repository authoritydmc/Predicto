import React, { useState, useEffect } from 'react';

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
  onInstantUpdate?: (data: any) => void;
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
  onInstantUpdate,
}) => {
  const [isUpdating, setIsUpdating] = useState(false);

  // Debounced instant update
  useEffect(() => {
    if (!onInstantUpdate) return;

    const timer = setTimeout(() => {
      onInstantUpdate({
        tossWinner: fTossWinner,
        tossDecision: fTossDecision,
        battingTeam: fBattingTeam,
        innings: fInnings,
        scoreTeamARuns,
        scoreTeamAWickets,
        scoreTeamAOvers,
        scoreTeamBRuns,
        scoreTeamBWickets,
        scoreTeamBOvers,
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [
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
    onInstantUpdate,
  ]);

  const battingTeamName = fBattingTeam === 'teamA' ? fTeamA : fTeamB;
  const bowlingTeamName = fBattingTeam === 'teamA' ? fTeamB : fTeamA;

  const battingScore = fBattingTeam === 'teamA' 
    ? { runs: scoreTeamARuns, wickets: scoreTeamAWickets, overs: scoreTeamAOvers }
    : { runs: scoreTeamBRuns, wickets: scoreTeamBWickets, overs: scoreTeamBOvers };

  const bowlingScore = fBattingTeam === 'teamA'
    ? { runs: scoreTeamBRuns, wickets: scoreTeamBWickets, overs: scoreTeamBOvers }
    : { runs: scoreTeamARuns, wickets: scoreTeamAWickets, overs: scoreTeamAOvers };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Compact Match Status Bar */}
      <div style={{
        display: 'flex',
        gap: '12px',
        padding: '12px',
        background: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
      }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px', display: 'block' }}>Innings</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setFInnings('1')}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                border: fInnings === '1' ? '1px solid #667eea' : '1px solid rgba(255,255,255,0.1)',
                background: fInnings === '1' ? 'rgba(102, 126, 234, 0.2)' : 'rgba(255,255,255,0.05)',
                color: '#fff',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              1st
            </button>
            <button
              type="button"
              onClick={() => setFInnings('2')}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                border: fInnings === '2' ? '1px solid #667eea' : '1px solid rgba(255,255,255,0.1)',
                background: fInnings === '2' ? 'rgba(102, 126, 234, 0.2)' : 'rgba(255,255,255,0.05)',
                color: '#fff',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              2nd
            </button>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px', display: 'block' }}>Batting</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setFBattingTeam('teamA')}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                border: fBattingTeam === 'teamA' ? '1px solid #34c759' : '1px solid rgba(255,255,255,0.1)',
                background: fBattingTeam === 'teamA' ? 'rgba(52, 199, 89, 0.2)' : 'rgba(255,255,255,0.05)',
                color: '#fff',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {fTeamA || 'A'}
            </button>
            <button
              type="button"
              onClick={() => setFBattingTeam('teamB')}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                border: fBattingTeam === 'teamB' ? '1px solid #34c759' : '1px solid rgba(255,255,255,0.1)',
                background: fBattingTeam === 'teamB' ? 'rgba(52, 199, 89, 0.2)' : 'rgba(255,255,255,0.05)',
                color: '#fff',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {fTeamB || 'B'}
            </button>
          </div>
        </div>
      </div>

      {/* Batting Team Score - Prominent */}
      <div style={{
        padding: '16px',
        background: 'linear-gradient(135deg, rgba(52, 199, 89, 0.1) 0%, rgba(52, 199, 89, 0.05) 100%)',
        borderRadius: '14px',
        border: '1px solid rgba(52, 199, 89, 0.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <span style={{ fontSize: '16px' }}>🏏</span>
          <span style={{ fontSize: '14px', fontWeight: '700', color: '#34c759' }}>
            {battingTeamName} (Batting)
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px', display: 'block' }}>Runs</label>
            <input
              type="number"
              value={battingScore.runs}
              onChange={e => {
                if (fBattingTeam === 'teamA') setScoreTeamARuns(e.target.value);
                else setScoreTeamBRuns(e.target.value);
              }}
              placeholder="0"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.08)',
                color: '#fff',
                fontSize: '16px',
                fontWeight: '700',
                textAlign: 'center',
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px', display: 'block' }}>Wickets</label>
            <input
              type="number"
              value={battingScore.wickets}
              onChange={e => {
                if (fBattingTeam === 'teamA') setScoreTeamAWickets(e.target.value);
                else setScoreTeamBWickets(e.target.value);
              }}
              placeholder="0"
              max="10"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.08)',
                color: '#fff',
                fontSize: '16px',
                fontWeight: '700',
                textAlign: 'center',
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px', display: 'block' }}>Overs</label>
            <input
              type="number"
              step="0.1"
              value={battingScore.overs}
              onChange={e => {
                if (fBattingTeam === 'teamA') setScoreTeamAOvers(e.target.value);
                else setScoreTeamBOvers(e.target.value);
              }}
              placeholder="0.0"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.08)',
                color: '#fff',
                fontSize: '16px',
                fontWeight: '700',
                textAlign: 'center',
              }}
            />
          </div>
        </div>
      </div>

      {/* Bowling Team Score - Compact */}
      <div style={{
        padding: '12px',
        background: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <span style={{ fontSize: '14px' }}>🎯</span>
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.7)' }}>
            {bowlingTeamName} (Bowling)
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          <div>
            <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '3px', display: 'block' }}>Runs</label>
            <input
              type="number"
              value={bowlingScore.runs}
              onChange={e => {
                if (fBattingTeam === 'teamA') setScoreTeamBRuns(e.target.value);
                else setScoreTeamARuns(e.target.value);
              }}
              placeholder="0"
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                color: '#fff',
                fontSize: '14px',
                fontWeight: '600',
                textAlign: 'center',
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '3px', display: 'block' }}>Wickets</label>
            <input
              type="number"
              value={bowlingScore.wickets}
              onChange={e => {
                if (fBattingTeam === 'teamA') setScoreTeamBWickets(e.target.value);
                else setScoreTeamAWickets(e.target.value);
              }}
              placeholder="0"
              max="10"
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                color: '#fff',
                fontSize: '14px',
                fontWeight: '600',
                textAlign: 'center',
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '3px', display: 'block' }}>Overs</label>
            <input
              type="number"
              step="0.1"
              value={bowlingScore.overs}
              onChange={e => {
                if (fBattingTeam === 'teamA') setScoreTeamBOvers(e.target.value);
                else setScoreTeamAOvers(e.target.value);
              }}
              placeholder="0.0"
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                color: '#fff',
                fontSize: '14px',
                fontWeight: '600',
                textAlign: 'center',
              }}
            />
          </div>
        </div>
      </div>

      {/* Toss Info - Collapsible */}
      <details style={{ marginTop: '8px' }}>
        <summary style={{
          cursor: 'pointer',
          fontSize: '12px',
          color: 'rgba(255,255,255,0.5)',
          padding: '8px 0',
          userSelect: 'none',
        }}>
          Toss Information ▼
        </summary>
        <div style={{ marginTop: '12px', display: 'flex', gap: '16px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px', display: 'block' }}>Toss Winner</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setFTossWinner('teamA')}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: fTossWinner === 'teamA' ? '1px solid #667eea' : '1px solid rgba(255,255,255,0.1)',
                  background: fTossWinner === 'teamA' ? 'rgba(102, 126, 234, 0.2)' : 'rgba(255,255,255,0.05)',
                  color: '#fff',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                {fTeamA || 'A'}
              </button>
              <button
                type="button"
                onClick={() => setFTossWinner('teamB')}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: fTossWinner === 'teamB' ? '1px solid #667eea' : '1px solid rgba(255,255,255,0.1)',
                  background: fTossWinner === 'teamB' ? 'rgba(102, 126, 234, 0.2)' : 'rgba(255,255,255,0.05)',
                  color: '#fff',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                {fTeamB || 'B'}
              </button>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px', display: 'block' }}>Decision</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setFTossDecision('bat')}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: fTossDecision === 'bat' ? '1px solid #667eea' : '1px solid rgba(255,255,255,0.1)',
                  background: fTossDecision === 'bat' ? 'rgba(102, 126, 234, 0.2)' : 'rgba(255,255,255,0.05)',
                  color: '#fff',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Bat
              </button>
              <button
                type="button"
                onClick={() => setFTossDecision('bowl')}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: fTossDecision === 'bowl' ? '1px solid #667eea' : '1px solid rgba(255,255,255,0.1)',
                  background: fTossDecision === 'bowl' ? 'rgba(102, 126, 234, 0.2)' : 'rgba(255,255,255,0.05)',
                  color: '#fff',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Bowl
              </button>
            </div>
          </div>
        </div>
      </details>

      {isUpdating && (
        <div style={{
          fontSize: '11px',
          color: '#34c759',
          textAlign: 'center',
          padding: '4px',
        }}>
          ✓ Syncing...
        </div>
      )}
    </div>
  );
};
