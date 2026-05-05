import React from 'react';
import { MatchControlPanel } from './MatchControlPanel';

interface Match {
  matchId: string;
  matchTitle: string;
  teamA: string;
  teamB: string;
}

interface MatchManagementProps {
  tournamentId: string;
  schedule: any[];
  availableMatches: Match[];
  matchStatuses: Record<string, string>;
  activeMatchTab: string;
  fMatchCode: string;
  fMatchTitle: string;
  fTeamA: string;
  fTeamB: string;
  fMatchId: string;
  fSport: string;
  onSelectMatch: (m: Match) => void;
  onDeleteMatch: (id: string) => void;
  onRestoreMatch: (id: string) => void;
  onLoadMatchFromSchedule: (m: any) => void;
  onTabChange: (tab: string) => void;
  onOpenScheduleEditor: () => void;
  onCreateMatch: (e: React.FormEvent) => void;
  setFMatchCode: (c: string) => void;
  setFMatchTitle: (t: string) => void;
  setFTeamA: (t: string) => void;
  setFTeamB: (t: string) => void;
  getTeamLogoUrl: (name: string, path: string) => string | null;
  // Match Control Props
  scraperRunning: boolean;
  scraperStatus: string;
  scraperOrder: string;
  scraperMatchUrl: string;
  onRunScraper: () => void;
  onUpdateScraperOrder: (o: string) => void;
  onUpdateScraperUrl: (u: string) => void;
  scoreSource: 'auto' | 'manual';
  onScoreSourceChange: (source: 'auto' | 'manual') => void;
  fVenue: string;
  fSeries: string;
  fMatchSummary: string;
  setFVenue: (v: string) => void;
  setFSeries: (s: string) => void;
  setFMatchSummary: (sum: string) => void;
  scoreTeamARuns: number;
  scoreTeamAWickets: number;
  scoreTeamAOvers: string;
  scoreTeamBRuns: number;
  scoreTeamBWickets: number;
  scoreTeamBOvers: string;
  setScoreTeamARuns: (v: number) => void;
  setScoreTeamAWickets: (v: number) => void;
  setScoreTeamAOvers: (v: string) => void;
  setScoreTeamBRuns: (v: number) => void;
  setScoreTeamBWickets: (v: number) => void;
  setScoreTeamBOvers: (v: string) => void;
  fMatchStatus: string;
  setFMatchStatus: (s: string) => void;
  fBattingTeam: string;
  fInnings: string;
  fTossWinner: string;
  fTossDecision: string;
  setFBattingTeam: (t: string) => void;
  setFInnings: (i: string) => void;
  setFTossWinner: (w: string) => void;
  setFTossDecision: (d: string) => void;
  fPredictionsEnabled: boolean;
  fPredictionsPaused: boolean;
  fPauseReason: string;
  fAllowReprediction: boolean;
  onTogglePredictions: () => void;
  onTogglePause: () => void;
  onToggleReprediction: () => void;
  onUpdatePauseReason: (r: string) => void;
  onUpdateLiveScore: () => void;
}

export const MatchManagement: React.FC<MatchManagementProps> = ({
  tournamentId,
  schedule,
  availableMatches,
  matchStatuses,
  activeMatchTab,
  fMatchCode,
  fMatchTitle,
  fTeamA,
  fTeamB,
  fMatchId,
  fSport,
  onSelectMatch,
  onDeleteMatch,
  onRestoreMatch,
  onLoadMatchFromSchedule,
  onTabChange,
  onOpenScheduleEditor,
  onCreateMatch,
  setFMatchCode,
  setFMatchTitle,
  setFTeamA,
  setFTeamB,
  getTeamLogoUrl,
  ...controlProps
}) => {
  return (
    <div className="cp-glass-card">
      <div style={{ 
        padding: '12px 16px', 
        background: 'rgba(52, 199, 89, 0.1)', 
        borderRadius: '8px', 
        border: '1px solid rgba(52, 199, 89, 0.2)', 
        marginBottom: '16px',
        fontSize: '12px',
        color: 'var(--muted)'
      }}>
        <strong>⚽ What this section does:</strong> Create individual matches, set match details, configure prediction settings, and manage live scores. Updates here affect the current match only.
      </div>

      {!tournamentId && (
        <div style={{ padding: '16px', background: 'rgba(255, 159, 10, 0.1)', borderRadius: '8px', border: '1px solid rgba(255, 159, 10, 0.3)', marginBottom: '16px' }}>
          <span style={{ fontSize: '13px', color: '#ff9f0a', fontWeight: '600' }}>
            ⚠️ Please select a tournament first to manage matches
          </span>
        </div>
      )}

      {tournamentId && (
        <>
          {/* Schedule View */}
          {schedule.length > 0 && (
            <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted)' }}>Next Scheduled Match</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button type="button" onClick={onOpenScheduleEditor} className="cp-action-btn cp-small" style={{ fontSize: '10px' }}>
                    Edit Schedule
                  </button>
                </div>
              </div>
              <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {schedule
                  .filter((match: any) => {
                    if (!match.date) return false;
                    const matchDate = new Date(match.date);
                    const now = new Date();
                    const matchDateOnly = new Date(matchDate.getFullYear(), matchDate.getMonth(), matchDate.getDate());
                    const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    return matchDateOnly >= nowDateOnly;
                  })
                  .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .slice(0, 1)
                  .map((match, idx) => (
                    <div 
                      key={idx}
                      style={{ 
                        padding: '10px', 
                        background: 'rgba(255,255,255,0.05)', 
                        borderRadius: '6px',
                        border: '1px solid rgba(255,255,255,0.08)',
                        fontSize: '12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '600', color: 'var(--text)' }}>{match.matchTitle}</div>
                        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{match.date || 'TBD'} • {match.venue || ''}</div>
                      </div>
                      <button type="button" onClick={() => onLoadMatchFromSchedule(match)} className="cp-action-btn cp-small" style={{ fontSize: '10px', padding: '4px 8px' }}>
                        Load
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Existing Matches */}
          {availableMatches.length > 0 && (
            <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
              <div className="cp-section-header">
                <span>Existing Matches ({availableMatches.length})</span>
              </div>
              <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {availableMatches.map((match) => (
                  <div 
                    key={match.matchId}
                    style={{ 
                      padding: '10px', 
                      background: fMatchId === match.matchId ? 'rgba(0, 122, 255, 0.15)' : 'rgba(255,255,255,0.05)', 
                      borderRadius: '6px',
                      border: fMatchId === match.matchId ? '1px solid var(--accent-blue)' : '1px solid rgba(255,255,255,0.08)',
                      fontSize: '12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: '600', color: 'var(--text)' }}>{match.matchTitle}</div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{match.teamA} vs {match.teamB}</div>
                      <div style={{ marginTop: '4px' }}>
                        <span style={{ 
                          fontSize: '10px', 
                          padding: '2px 6px', 
                          borderRadius: '4px',
                          background: matchStatuses[match.matchId] === 'live' ? 'rgba(239, 68, 68, 0.2)' : matchStatuses[match.matchId] === 'done' ? 'rgba(142, 142, 147, 0.2)' : 'rgba(52, 199, 89, 0.2)',
                          color: matchStatuses[match.matchId] === 'live' ? '#ef4444' : matchStatuses[match.matchId] === 'done' ? '#8e8e93' : '#34c759',
                          fontWeight: '600'
                        }}>
                          {(matchStatuses[match.matchId] || 'scheduled').toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {matchStatuses[match.matchId] === 'done' && (
                        <button type="button" onClick={() => onRestoreMatch(match.matchId)} className="cp-action-btn cp-small" style={{ fontSize: '10px', padding: '4px 8px', background: 'rgba(52, 199, 89, 0.2)', color: '#34c759' }}>
                          Restore
                        </button>
                      )}
                      <button type="button" onClick={() => onSelectMatch(match)} className="cp-action-btn cp-small" style={{ fontSize: '10px', padding: '4px 8px' }}>
                        Edit
                      </button>
                      <button type="button" onClick={() => onDeleteMatch(match.matchId)} className="cp-action-btn cp-small cp-danger" style={{ fontSize: '10px', padding: '4px 8px' }}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="cp-divider" />

          {/* Match Tabs */}
          <div className="cp-tabs">
            <button className={`cp-tab ${activeMatchTab === 'details' ? 'active' : ''}`} onClick={() => onTabChange('details')}>
              📋 Match Details
            </button>
            <button className={`cp-tab-btn ${activeMatchTab === 'live' ? 'active' : ''}`} onClick={() => onTabChange('live')}>
              📊 Match Control
            </button>
          </div>

          {/* Match Details Tab */}
          {activeMatchTab === 'details' && (
            <div className="cp-tab-content active">
              <form onSubmit={onCreateMatch}>
                <div className="cp-dual-row">
                  <div className="cp-form-row">
                    <label>Match Code</label>
                    <input value={fMatchCode} onChange={e => setFMatchCode(e.target.value)} maxLength={40} placeholder="e.g. csk-vs-mi" required />
                  </div>
                  <div className="cp-form-row">
                    <label>Match Title</label>
                    <input value={fMatchTitle} onChange={e => setFMatchTitle(e.target.value)} placeholder="e.g. CSK vs MI - Match 1" required />
                  </div>
                </div>
                <div className="cp-dual-row">
                  <div className="cp-form-row">
                    <label>Home Team</label>
                    <div className="cp-input-action-group">
                      <input value={fTeamA} onChange={e => setFTeamA(e.target.value)} maxLength={30} placeholder="Team A" required />
                      {getTeamLogoUrl(fTeamA, '../desktop/assets/team-logos') && (
                        <img src={getTeamLogoUrl(fTeamA, '../desktop/assets/team-logos')!} alt={fTeamA} style={{ width: 40, height: 40, objectFit: 'contain', padding: 4 }} />
                      )}
                    </div>
                  </div>
                  <div className="cp-form-row">
                    <label>Away Team</label>
                    <div className="cp-input-action-group">
                      <input value={fTeamB} onChange={e => setFTeamB(e.target.value)} maxLength={30} placeholder="Team B" required />
                      {getTeamLogoUrl(fTeamB, '../desktop/assets/team-logos') && (
                        <img src={getTeamLogoUrl(fTeamB, '../desktop/assets/team-logos')!} alt={fTeamB} style={{ width: 40, height: 40, objectFit: 'contain', padding: 4 }} />
                      )}
                    </div>
                  </div>
                </div>
                <button className="cp-primary-btn cp-wide-btn" type="submit" style={{ marginTop: '12px' }}>
                  {fMatchId ? 'Update Match' : 'Create Match'}
                </button>
              </form>
            </div>
          )}

          {/* Match Control Tab */}
          {activeMatchTab === 'live' && (
            <div className="cp-tab-content active">
              <MatchControlPanel
                fSport={fSport}
                fTeamA={fTeamA}
                fTeamB={fTeamB}
                matchId={fMatchId}
                tournamentId={tournamentId}
                {...controlProps}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};
