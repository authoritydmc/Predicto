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
      <div className="bg-gradient-to-r from-green-500/10 to-emerald-600/10 p-4 rounded-xl border border-green-500/30 backdrop-blur-md mb-4">
        <div className="text-sm font-semibold text-gray-300 mb-2">
          <span className="text-lg mr-2">⚽</span>
          What this section does:
        </div>
        <p className="text-sm text-gray-400 leading-relaxed">
          Create individual matches, set match details, configure prediction settings, and manage live scores. Updates here affect the current match only.
        </p>
      </div>

      {!tournamentId && (
        <div className="bg-gradient-to-r from-amber-500/10 to-orange-600/10 p-4 rounded-xl border border-amber-500/30 backdrop-blur-md mb-4">
          <div className="text-sm font-semibold text-amber-400 flex items-center gap-2">
            <span className="text-lg mr-2">⚠️</span>
            Please select a tournament first to manage matches
          </div>
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
                    return (matchDateOnly >= nowDateOnly);
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
            <button className={`cp-tab ${activeMatchTab === 'live' ? 'active' : ''}`} onClick={() => onTabChange('live')}>
              📊 Match Control
            </button>
          </div>

          {/* Match Details Tab */}
          {activeMatchTab === 'details' && (
            <div className="cp-tab-content active">
              <div className="bg-gradient-to-br from-slate-800/50 via-slate-700/30 to-slate-800/50 backdrop-blur-xl border border-slate-600/30 rounded-2xl p-8 mb-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full animate-pulse"></div>
                  <h3 className="text-lg font-bold text-white">Match Details</h3>
                </div>
                
                <form onSubmit={onCreateMatch} className="space-y-6">
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <label className="block text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                        <span className="text-blue-400">📋</span>
                        Match Code
                      </label>
                      <div className="relative">
                        <input 
                          className="w-full px-4 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 text-sm font-medium"
                          value={fMatchCode} 
                          onChange={e => setFMatchCode(e.target.value)} 
                          maxLength={40} 
                          placeholder="e.g. csk-vs-mi" 
                          required 
                        />
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/20 to-purple-600/20 opacity-0 pointer-events-none"></div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <label className="block text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                        <span className="text-purple-400">🏆</span>
                        Match Title
                      </label>
                      <div className="relative">
                        <input 
                          className="w-full px-4 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 text-sm font-medium"
                          value={fMatchTitle} 
                          onChange={e => setFMatchTitle(e.target.value)} 
                          placeholder="e.g. CSK vs MI - Match 1" 
                          required 
                        />
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-500/20 to-pink-600/20 opacity-0 pointer-events-none"></div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-4">
                      <label className="block text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                        <span className="text-green-400">🏠</span>
                        Home Team
                      </label>
                      <div className="relative">
                        <div className="flex gap-3">
                          <input 
                            className="flex-1 px-4 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-300 text-sm font-medium"
                            value={fTeamA} 
                            onChange={e => setFTeamA(e.target.value)} 
                            maxLength={30} 
                            placeholder="Team A" 
                            required 
                          />
                          {getTeamLogoUrl(fTeamA, './assets/team-logos') && (
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                              <img 
                                src={getTeamLogoUrl(fTeamA, './assets/team-logos')!} 
                                alt={fTeamA} 
                                className="w-10 h-10 rounded-lg bg-white/20 p-1 border border-white/30 object-contain transition-all duration-200 hover:scale-105 hover:shadow-lg" 
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <label className="block text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                        <span className="text-red-400">✈️</span>
                        Away Team
                      </label>
                      <div className="relative">
                        <div className="flex gap-3">
                          <input 
                            className="flex-1 px-4 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-300 text-sm font-medium"
                            value={fTeamB} 
                            onChange={e => setFTeamB(e.target.value)} 
                            maxLength={30} 
                            placeholder="Team B" 
                            required 
                          />
                          {getTeamLogoUrl(fTeamB, './assets/team-logos') && (
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                              <img 
                                src={getTeamLogoUrl(fTeamB, './assets/team-logos')!} 
                                alt={fTeamB} 
                                className="w-10 h-10 rounded-lg bg-white/20 p-1 border border-white/30 object-contain transition-all duration-200 hover:scale-105 hover:shadow-lg" 
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </form>

                <button 
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold py-4 px-6 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                  type="submit"
                >
                  <span className="flex items-center justify-center gap-2">
                    <span className="text-lg">{fMatchId ? '✏️' : '➕'}</span>
                    {fMatchId ? 'Update Match' : 'Create Match'}
                  </span>
                </button>
              </div>
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
