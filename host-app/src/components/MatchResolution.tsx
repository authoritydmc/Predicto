import React from 'react';

interface MatchResolutionProps {
  is2nd: boolean;
  fActualScore: string;
  setFActualScore: (value: string) => void;
  fActualResult: string;
  setFActualResult: (value: string) => void;
  fChaserWon: 'yes' | 'no';
  setFChaserWon: (value: 'yes' | 'no') => void;
  forceReprocess: boolean;
  setForceReprocess: (value: boolean) => void;
  resolutionStatus: 'idle' | 'running' | 'success' | 'error';
  resolutionMessage: string;
  onResolve: () => void;
  onViewStandings: () => void;
  chasingTeam?: string;
}

export const MatchResolution: React.FC<MatchResolutionProps> = ({
  is2nd,
  fActualScore,
  setFActualScore,
  fActualResult,
  setFActualResult,
  fChaserWon,
  setFChaserWon,
  forceReprocess,
  setForceReprocess,
  resolutionStatus,
  resolutionMessage,
  onResolve,
  onViewStandings,
  chasingTeam,
}) => {
  const getStatusIcon = () => {
    switch (resolutionStatus) {
      case 'running': return '⏳ ';
      case 'success': return '✅ ';
      case 'error': return '❌ ';
      default: return '';
    }
  };

  return (
    <div className="cp-glass-card cp-stack">
      {!is2nd ? (
        <div className="cp-form-row">
          <label>Actual 1st Innings Score</label>
          <input
            type="number"
            value={fActualScore}
            onChange={(e) => setFActualScore(e.target.value)}
            placeholder="e.g. 158"
            min="1"
            max="999"
          />
        </div>
      ) : (
        <>
          <div className="cp-form-row">
            <label>Did {chasingTeam} win?</label>
            <div className="cp-radio-group">
              <div className="cp-radio-option">
                <input
                  type="radio"
                  id="chaserYes"
                  name="chaserWon"
                  value="yes"
                  checked={fChaserWon === 'yes'}
                  onChange={() => setFChaserWon('yes')}
                />
                <label className="cp-radio-label" htmlFor="chaserYes">Yes</label>
              </div>
              <div className="cp-radio-option">
                <input
                  type="radio"
                  id="chaserNo"
                  name="chaserWon"
                  value="no"
                  checked={fChaserWon === 'no'}
                  onChange={() => setFChaserWon('no')}
                />
                <label className="cp-radio-label" htmlFor="chaserNo">No</label>
              </div>
            </div>
          </div>
          <div className="cp-form-row">
            <label>{fChaserWon === 'yes' ? 'Actual Overs (e.g. 15.2)' : 'Actual Chasing Score'}</label>
            <input
              type="number"
              value={fActualResult}
              onChange={(e) => setFActualResult(e.target.value)}
              placeholder={fChaserWon === 'yes' ? 'e.g. 15.2' : 'e.g. 145'}
              step="any"
              min="0"
            />
          </div>
        </>
      )}

      <div className="cp-input-action-group">
        <button
          className="cp-primary-btn"
          onClick={onResolve}
          disabled={resolutionStatus === 'running'}
        >
          {resolutionStatus === 'running' ? 'Processing...' : is2nd ? 'Resolve 2nd Innings' : 'Resolve 1st Innings'}
        </button>
        <button className="cp-action-btn" onClick={onViewStandings}>
          View Final Game Standings
        </button>
      </div>

      <div className="cp-form-row" style={{ marginTop: '8px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={forceReprocess}
            onChange={(e) => setForceReprocess(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          <span style={{ fontSize: '13px', color: '#999' }}>Force reprocess (skip reconciled check)</span>
        </label>
      </div>

      {resolutionMessage && (
        <div
          className="cp-panel-note"
          style={{
            marginTop: '12px',
            padding: '8px 12px',
            borderRadius: '6px',
            background: resolutionStatus === 'success' ? 'rgba(52, 199, 89, 0.1)' :
                       resolutionStatus === 'error' ? 'rgba(255, 59, 48, 0.1)' :
                       'rgba(255, 255, 255, 0.05)',
            border: `1px solid ${resolutionStatus === 'success' ? 'rgba(52, 199, 89, 0.3)' :
                                  resolutionStatus === 'error' ? 'rgba(255, 59, 48, 0.3)' :
                                  'rgba(255, 255, 255, 0.1)'}`,
            color: resolutionStatus === 'success' ? '#34c759' :
                   resolutionStatus === 'error' ? '#ff3b30' :
                   'var(--text-primary)',
          }}
        >
          {getStatusIcon()}{resolutionMessage}
        </div>
      )}

      <p className="cp-panel-note">
        Resolve the current innings to archive points and prepare for the final report.
        Python processing handles scoring and leaderboard updates automatically.
      </p>
    </div>
  );
};
