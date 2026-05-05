import { useState, useEffect } from 'react';
import { onValue, ref, get } from 'firebase/database';
import { rtdb } from '../../firebase/config';
import { getTeamLogoUrl } from '../../utils/teamLogos';

interface AudienceGateProps {
  onJoinMatch: (matchCode: string) => void;
  onJoinTournament: (tournamentCode: string) => void;
}

interface MatchMeta {
  teamA?: string;
  teamB?: string;
  matchTitle?: string;
  status?: string;
  venue?: string;
  date?: string;
  startTime?: string;
  countdown?: string;
}

interface ActiveMatch {
  matchCode: string;
  sport: string;
  tournamentId: string;
  matchId: string;
  updatedAt: any;
  meta?: MatchMeta;
}

interface TournamentMeta {
  tournamentName?: string;
  status?: string;
  sport?: string;
}

interface ActiveTournament {
  tournamentCode: string;
  sport: string;
  tournamentId: string;
  tournamentName?: string;
  status?: string;
  updatedAt: any;
  meta?: TournamentMeta;
}

const getDbRoot = () => {
  if (typeof window !== 'undefined') {
    const storedMode = localStorage.getItem('firebase_mode');
    if (storedMode) {
      return storedMode;
    }
    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    const defaultMode = isLocal ? 'local' : 'prod';
    localStorage.setItem('firebase_mode', defaultMode);
    return defaultMode;
  }
  return 'local';
};

export default function AudienceGate({ onJoinMatch, onJoinTournament }: AudienceGateProps) {
  const [code, setCode] = useState('');
  const [inputType, setInputType] = useState<'match' | 'tournament'>('match');
  const [activeMatches, setActiveMatches] = useState<ActiveMatch[]>([]);
  const [activeTournaments, setActiveTournaments] = useState<ActiveTournament[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [loadingTournaments, setLoadingTournaments] = useState(true);
  const [activeTab, setActiveTab] = useState<'matches' | 'tournaments'>('matches');

  // Fetch active matches from discovery and filter by status='live'
  useEffect(() => {
    const dbRoot = getDbRoot();
    const discoveryRef = ref(rtdb, `${dbRoot}/discovery/matches`);
    
    const unsub = onValue(discoveryRef, async (snap) => {
      const data = snap.val();
      if (data) {
        const matches = Object.entries(data).map(([matchCode, info]: [string, any]) => ({
          matchCode,
          sport: info.sport,
          tournamentId: info.tournamentId,
          matchId: info.matchId,
          updatedAt: info.updatedAt
        }));

        // Filter matches by checking their actual status from meta and fetch team info
        const liveMatches = await Promise.all(
          matches.map(async (match) => {
            try {
              const metaRef = ref(rtdb, `${dbRoot}/tournaments/${match.sport}/${match.tournamentId}/matches/${match.matchId}/meta`);
              const metaSnap = await get(metaRef);
              const meta = metaSnap.val();
              if (meta && (meta.status === 'live' || meta.status === 'active')) {
                return { ...match, meta };
              }
              return null;
            } catch (err) {
              console.error('[AudienceGate] Error fetching match meta:', match.matchCode, err);
              return null;
            }
          })
        );

        setActiveMatches(liveMatches.filter((m) => m !== null) as ActiveMatch[]);
      } else {
        setActiveMatches([]);
      }
      setLoadingMatches(false);
    }, (error) => {
      console.error('[AudienceGate] Error fetching match discovery:', error);
      setLoadingMatches(false);
    });

    return () => unsub();
  }, []);

  // Fetch active tournaments from discovery and filter by status='active'
  useEffect(() => {
    const dbRoot = getDbRoot();
    const tournamentsRef = ref(rtdb, `${dbRoot}/discovery/tournaments`);
    
    const unsub = onValue(tournamentsRef, async (snap) => {
      const data = snap.val();
      if (data) {
        const tournaments = Object.entries(data).map(([tournamentCode, info]: [string, any]) => ({
          tournamentCode,
          sport: info.sport,
          tournamentId: info.tournamentId,
          tournamentName: info.tournamentName,
          status: info.status,
          updatedAt: info.updatedAt
        }));

        // Filter tournaments by checking their actual status from meta
        const activeTournaments = await Promise.all(
          tournaments.map(async (tournament) => {
            try {
              const metaRef = ref(rtdb, `${dbRoot}/tournaments/${tournament.sport}/${tournament.tournamentId}/meta`);
              const metaSnap = await get(metaRef);
              const meta = metaSnap.val();
              if (meta && meta.status === 'active') {
                return { ...tournament, meta };
              }
              return null;
            } catch (err) {
              console.error('[AudienceGate] Error fetching tournament meta:', tournament.tournamentCode, err);
              return null;
            }
          })
        );

        setActiveTournaments(activeTournaments.filter((t) => t !== null) as ActiveTournament[]);
      } else {
        setActiveTournaments([]);
      }
      setLoadingTournaments(false);
    }, (error) => {
      console.error('[AudienceGate] Error fetching tournament discovery:', error);
      setLoadingTournaments(false);
    });

    return () => unsub();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim()) {
      if (inputType === 'match') {
        onJoinMatch(code.trim().toLowerCase());
      } else {
        onJoinTournament(code.trim().toLowerCase());
      }
    }
  };

  const handleQuickJoinMatch = (matchCode: string) => {
    onJoinMatch(matchCode.toLowerCase());
  };

  const handleQuickJoinTournament = (tournamentCode: string) => {
    onJoinTournament(tournamentCode.toLowerCase());
  };

  return (
    <div className="audience-gate-container">
      {/* Header Section */}
      <div className="gate-hero">
        <div className="gate-hero-content">
          <div className="gate-logo">
            <span className="gate-logo-icon">🔮</span>
          </div>
          <h1 className="gate-title">Predicto</h1>
          <p className="gate-subtitle">Predict live. Win together.</p>
        </div>
      </div>

      {/* Main Card with Input */}
      <div className="gate-card gate-card-compact">
        <form onSubmit={handleSubmit} className="gate-form-inline">
          <div className="gate-input-row">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={40}
              placeholder={inputType === 'match' ? 'Enter match code...' : 'Enter tournament code...'}
              required
              className="gate-input-modern"
            />
            <button type="submit" className="gate-submit-btn-icon" aria-label="Join">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <div className="gate-form-footer">
            <div className="gate-tabs-mini">
              <button
                type="button"
                onClick={() => {
                  setInputType('match');
                  setCode('');
                }}
                className={`gate-tab-mini ${inputType === 'match' ? 'active' : ''}`}
              >
                <span>�</span> Match
              </button>
              <button
                type="button"
                onClick={() => {
                  setInputType('tournament');
                  setCode('');
                }}
                className={`gate-tab-mini ${inputType === 'tournament' ? 'active' : ''}`}
              >
                <span>🏆</span> Tournament
              </button>
            </div>
            <span className="gate-input-hint-inline">
              {inputType === 'match' ? 'e.g., dc-vs-csk-2026' : 'e.g., ipl26'}
            </span>
          </div>
        </form>
      </div>

      {/* Live Content Section - Tabs for Matches/Tournaments */}
      <div className="gate-section">
        <div className="gate-section-tabs">
          <button
            className={`gate-section-tab ${activeTab === 'matches' ? 'active' : ''}`}
            onClick={() => setActiveTab('matches')}
          >
            <span className="live-pulse"></span>
            <span>Matches</span>
            {!loadingMatches && activeMatches.length > 0 && (
              <span className="gate-tab-badge">{activeMatches.length}</span>
            )}
          </button>
          <button
            className={`gate-section-tab ${activeTab === 'tournaments' ? 'active' : ''}`}
            onClick={() => setActiveTab('tournaments')}
          >
            <span>Tournaments</span>
            {!loadingTournaments && activeTournaments.length > 0 && (
              <span className="gate-tab-badge">{activeTournaments.length}</span>
            )}
          </button>
        </div>

        {activeTab === 'matches' ? (
          loadingMatches ? (
            <div className="gate-skeleton-list">
              <div className="gate-skeleton-card"></div>
              <div className="gate-skeleton-card"></div>
            </div>
          ) : activeMatches.length === 0 ? (
            <div className="gate-empty-state-compact">
              <span className="gate-empty-icon">📭</span>
              <span className="gate-empty-text">No live matches right now</span>
            </div>
          ) : (
            <div className="gate-grid">
              {activeMatches.map((match) => (
                <button
                  key={match.matchCode}
                  onClick={() => handleQuickJoinMatch(match.matchCode)}
                  className="gate-match-card-compact"
                >
                  {match.meta?.teamA && match.meta?.teamB ? (
                    <>
                      <div className="gate-team-compact">
                        {getTeamLogoUrl(match.meta.teamA) ? (
                          <img 
                            src={getTeamLogoUrl(match.meta.teamA)!} 
                            alt={match.meta.teamA}
                            className="gate-logo-compact"
                          />
                        ) : (
                          <div className="gate-logo-compact-placeholder">
                            {match.meta.teamA.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <span className="gate-team-abbr">{match.meta.teamA.slice(0, 3).toUpperCase()}</span>
                      </div>
                      <div className="gate-vs-center">
                        <span className="gate-vs-text">VS</span>
                        {(match.meta.venue || match.meta.startTime) && (
                          <div className="gate-match-meta">
                            {match.meta.startTime && (
                              <span className="gate-match-time">{match.meta.startTime}</span>
                            )}
                            {match.meta.venue && (
                              <span className="gate-match-venue">{match.meta.venue}</span>
                            )}
                          </div>
                        )}
                        <span className="gate-code-text">{match.matchCode}</span>
                      </div>
                      <div className="gate-team-compact">
                        {getTeamLogoUrl(match.meta.teamB) ? (
                          <img 
                            src={getTeamLogoUrl(match.meta.teamB)!} 
                            alt={match.meta.teamB}
                            className="gate-logo-compact"
                          />
                        ) : (
                          <div className="gate-logo-compact-placeholder">
                            {match.meta.teamB.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <span className="gate-team-abbr">{match.meta.teamB.slice(0, 3).toUpperCase()}</span>
                      </div>
                    </>
                  ) : (
                    <span className="gate-match-code-full">{match.matchCode}</span>
                  )}
                </button>
              ))}
            </div>
          )
        ) : (
          loadingTournaments ? (
            <div className="gate-skeleton-list">
              <div className="gate-skeleton-card"></div>
            </div>
          ) : activeTournaments.length === 0 ? (
            <div className="gate-empty-state-compact">
              <span className="gate-empty-icon">📭</span>
              <span className="gate-empty-text">No active tournaments</span>
            </div>
          ) : (
            <div className="gate-scroll-list">
              {activeTournaments.map((tournament) => (
                <button
                  key={tournament.tournamentCode}
                  onClick={() => handleQuickJoinTournament(tournament.tournamentCode)}
                  className="gate-tournament-card"
                >
                  <div className="gate-tournament-icon">
                    {tournament.sport === 'cricket' ? '🏏' : 
                     tournament.sport === 'football' ? '⚽' : '🏆'}
                  </div>
                  <div className="gate-tournament-info">
                    <span className="gate-tournament-name">
                      {tournament.meta?.tournamentName || tournament.tournamentName || tournament.tournamentCode}
                    </span>
                    <span className="gate-tournament-id">{tournament.tournamentCode}</span>
                  </div>
                  <div className="gate-match-arrow">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
