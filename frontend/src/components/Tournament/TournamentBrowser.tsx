import { useState, useEffect } from 'react';
import { onValue, ref, get } from 'firebase/database';
import { rtdb } from '../../firebase/config';
import { getTeamLogoUrl } from '../../utils/teamLogos';
import TournamentLeaderboardModal from '../Leaderboard/TournamentLeaderboardModal';

interface TournamentBrowserProps {
  tournamentCode: string;
  onJoinMatch: (matchId: string) => void;
  onBack: () => void;
}

interface TournamentInfo {
  sport: string;
  tournamentId: string;
  tournamentName?: string;
  status?: string;
}

interface Match {
  matchId: string;
  meta?: {
    matchTitle?: string;
    teamA?: string;
    teamB?: string;
    date?: string;
    status?: string;
  };
}

interface ScheduledMatch {
  matchId: string;
  matchTitle: string;
  teamA: string;
  teamB: string;
  date: string;
  venue: string;
  status: string;
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

const getSportIcon = (sport: string) => {
  const icons: Record<string, string> = {
    cricket: '🏏',
    football: '⚽',
    basketball: '🏀',
    hockey: '🏒',
    tennis: '🎾',
    baseball: '⚾',
    volleyball: '🏐',
  };
  return icons[sport.toLowerCase()] || '🏆';
};

export default function TournamentBrowser({ tournamentCode, onJoinMatch, onBack }: TournamentBrowserProps) {
  const [tournamentInfo, setTournamentInfo] = useState<TournamentInfo | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [schedule, setSchedule] = useState<ScheduledMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  useEffect(() => {
    const loadTournament = async () => {
      try {
        setLoading(true);
        setError(null);

        const dbRoot = getDbRoot();
        console.log('[TournamentBrowser] Loading tournament:', tournamentCode, 'from dbRoot:', dbRoot);

        // Get tournament info from discovery
        const tournamentDiscoveryPath = `${dbRoot}/discovery/tournaments/${tournamentCode.toLowerCase()}`;
        console.log('[TournamentBrowser] Tournament discovery path:', tournamentDiscoveryPath);
        
        const tournamentSnap = await get(ref(rtdb, tournamentDiscoveryPath));
        const tournamentData = tournamentSnap.val();

        console.log('[TournamentBrowser] Tournament data:', tournamentData);

        if (!tournamentData) {
          setError('Tournament not found. Check the tournament code.');
          setLoading(false);
          return;
        }

        setTournamentInfo(tournamentData);

        // Fetch schedule and live matches
        const tournamentPath = `${dbRoot}/tournaments/${tournamentData.sport}/${tournamentData.tournamentId}`;
        console.log('[TournamentBrowser] Tournament path:', tournamentPath);
        
        // Fetch schedule
        const scheduleRef = ref(rtdb, `${tournamentPath}/schedule`);
        const scheduleUnsub = onValue(scheduleRef, (snap) => {
          const scheduleData = snap.val();
          console.log('[TournamentBrowser] Schedule data:', scheduleData);
          
          if (scheduleData && Array.isArray(scheduleData)) {
            setSchedule(scheduleData);
          } else {
            console.log('[TournamentBrowser] No schedule found');
            setSchedule([]);
          }
        }, (err) => {
          console.error('[TournamentBrowser] Error fetching schedule:', err);
        });

        // Fetch live matches (from matches folder)
        const matchesRef = ref(rtdb, `${tournamentPath}/matches`);
        const matchesUnsub = onValue(matchesRef, (snap) => {
          const matchesData = snap.val();
          console.log('[TournamentBrowser] Matches data:', matchesData);
          
          if (matchesData) {
            const allMatches = Object.entries(matchesData).map(([matchId, data]: [string, any]) => ({
              matchId,
              meta: data.meta
            }));
            console.log('[TournamentBrowser] Parsed matches:', allMatches);
            setMatches(allMatches);
          } else {
            console.log('[TournamentBrowser] No matches found');
            setMatches([]);
          }
          setLoading(false);
        }, (err) => {
          console.error('[TournamentBrowser] Error fetching matches:', err);
          setError('Failed to load matches: ' + err.message);
          setLoading(false);
        });

        return () => {
          scheduleUnsub();
          matchesUnsub();
        };
      } catch (err) {
        console.error('[TournamentBrowser] Error loading tournament:', err);
        setError('Failed to load tournament: ' + (err as Error).message);
        setLoading(false);
      }
    };

    loadTournament();
  }, [tournamentCode]);

  const categorizeMatches = () => {
    const now = Date.now();
    const live: Match[] = [];
    const upcoming: ScheduledMatch[] = [];
    const previous: ScheduledMatch[] = [];

    // Live matches come from the matches folder (actual created matches)
    matches.forEach(match => {
      const status = match.meta?.status || 'scheduled';
      if (status === 'live') {
        live.push(match);
      }
    });

    // Upcoming and past matches come from schedule
    schedule.forEach(scheduledMatch => {
      const matchDate = new Date(scheduledMatch.date).getTime();
      
      if (matchDate > now) {
        upcoming.push(scheduledMatch);
      } else {
        previous.push(scheduledMatch);
      }
    });

    // Sort upcoming by date (soonest first)
    upcoming.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateA - dateB;
    });

    // Sort previous by date (most recent first)
    previous.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });

    return { live, upcoming, previous };
  };

  const { live, upcoming, previous } = categorizeMatches();

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getTimeUntil = (dateStr: string) => {
    const now = Date.now();
    const matchDate = new Date(dateStr).getTime();
    const diff = matchDate - now;
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    } else if (minutes > 0) {
      return `${minutes} min${minutes > 1 ? 's' : ''}`;
    }
    return 'Starting soon';
  };

  const getShareUrl = (matchId: string) => {
    return `${window.location.origin}/match/${matchId}`;
  };

  const copyShareUrl = (matchId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = getShareUrl(matchId);
    navigator.clipboard.writeText(url).then(() => {
      alert('Link copied to clipboard!');
    });
  };

  const copyTournamentUrl = () => {
    const url = `${window.location.origin}/tournament/${tournamentCode}`;
    navigator.clipboard.writeText(url).then(() => {
      alert('Tournament link copied to clipboard!');
    });
  };

  if (loading) {
    return (
      <section className="panel tournament-browser">
        <div className="tournament-browser-header">
          <button onClick={onBack} className="back-btn">← Back</button>
        </div>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: 'var(--muted)' }}>Loading tournament...</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="panel tournament-browser">
        <div className="tournament-browser-header">
          <button onClick={onBack} className="back-btn">← Back</button>
        </div>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: '#ef4444' }}>{error}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel tournament-browser">
      <div className="tournament-browser-header">
        <button onClick={onBack} className="back-btn">← Back</button>
        <div className="tournament-header-info">
          <span className="tournament-sport-icon">{getSportIcon(tournamentInfo?.sport || '')}</span>
          <div>
            <h2>{tournamentInfo?.tournamentName || tournamentCode}</h2>
            <p className="tournament-meta">{tournamentInfo?.sport?.toUpperCase()}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => {
              console.log('[TournamentBrowser] Leaderboard button clicked, tournamentInfo:', tournamentInfo);
              setShowLeaderboard(true);
            }}
            className="link-btn"
            style={{ fontSize: '0.85rem', padding: '6px 12px' }}
          >
            🏆 Leaderboard
          </button>
          <button 
            onClick={copyTournamentUrl}
            className="share-btn"
            title="Copy tournament link"
          >
            🔗
          </button>
        </div>
      </div>

      {/* Live Matches */}
      {live.length > 0 && (
        <div className="tournament-section">
          <div className="section-header">
            <h3 className="section-title">
              <span className="pulse-dot"></span>
              Live Now
            </h3>
            <span className="section-count">{live.length}</span>
          </div>
          <div className="match-grid">
            {live.map((match) => (
              <div
                key={match.matchId}
                onClick={() => onJoinMatch(match.matchId)}
                className="match-card live"
                role="button"
                tabIndex={0}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onJoinMatch(match.matchId);
                  }
                }}
              >
                <div className="match-card-header">
                  <span className="match-status live">LIVE</span>
                  <button 
                    onClick={(e) => copyShareUrl(match.matchId, e)}
                    className="share-btn"
                    title="Copy link"
                  >
                    🔗
                  </button>
                </div>
                <div className="match-card-content">
                  <h4 className="match-title">{match.meta?.matchTitle || match.matchId}</h4>
                  {match.meta?.teamA && match.meta?.teamB && (
                    <div className="match-teams-with-logos">
                      <div className="team-logo-container">
                        {getTeamLogoUrl(match.meta.teamA) && (
                          <img 
                            src={getTeamLogoUrl(match.meta.teamA)!} 
                            alt={match.meta.teamA}
                            className="team-logo"
                          />
                        )}
                        <span>{match.meta.teamA}</span>
                      </div>
                      <span className="vs-divider">vs</span>
                      <div className="team-logo-container">
                        {getTeamLogoUrl(match.meta.teamB) && (
                          <img 
                            src={getTeamLogoUrl(match.meta.teamB)!} 
                            alt={match.meta.teamB}
                            className="team-logo"
                          />
                        )}
                        <span>{match.meta.teamB}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Matches */}
      {upcoming.length > 0 && (
        <div className="tournament-section">
          <div className="section-header">
            <h3 className="section-title">Upcoming</h3>
            <span className="section-count">{upcoming.length}</span>
          </div>
          <div className="match-grid">
            {upcoming.map((match) => (
              <div
                key={match.matchId}
                onClick={() => onJoinMatch(match.matchId)}
                className="match-card"
                role="button"
                tabIndex={0}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onJoinMatch(match.matchId);
                  }
                }}
              >
                <div className="match-card-header">
                  <span className="match-countdown">{getTimeUntil(match.date)}</span>
                  <button 
                    onClick={(e) => copyShareUrl(match.matchId, e)}
                    className="share-btn"
                    title="Copy link"
                  >
                    🔗
                  </button>
                </div>
                <div className="match-card-content">
                  <h4 className="match-title">{match.matchTitle || match.matchId}</h4>
                  {match.teamA && match.teamB && (
                    <div className="match-teams-with-logos">
                      <div className="team-logo-container">
                        {getTeamLogoUrl(match.teamA) && (
                          <img 
                            src={getTeamLogoUrl(match.teamA)!} 
                            alt={match.teamA}
                            className="team-logo"
                          />
                        )}
                        <span>{match.teamA}</span>
                      </div>
                      <span className="vs-divider">vs</span>
                      <div className="team-logo-container">
                        {getTeamLogoUrl(match.teamB) && (
                          <img 
                            src={getTeamLogoUrl(match.teamB)!} 
                            alt={match.teamB}
                            className="team-logo"
                          />
                        )}
                        <span>{match.teamB}</span>
                      </div>
                    </div>
                  )}
                  {match.venue && (
                    <p className="match-venue">{match.venue}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Previous Matches */}
      {previous.length > 0 && (
        <div className="tournament-section">
          <div className="section-header">
            <h3 className="section-title">Past</h3>
            <span className="section-count">{previous.length}</span>
          </div>
          <div className="match-grid">
            {previous.map((match) => (
              <div
                key={match.matchId}
                onClick={() => onJoinMatch(match.matchId)}
                className="match-card completed"
                role="button"
                tabIndex={0}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onJoinMatch(match.matchId);
                  }
                }}
              >
                <div className="match-card-header">
                  <span className="match-status done">DONE</span>
                  <span className="match-date">{formatDate(match.date)}</span>
                  <button 
                    onClick={(e) => copyShareUrl(match.matchId, e)}
                    className="share-btn"
                    title="Copy link"
                  >
                    🔗
                  </button>
                </div>
                <div className="match-card-content">
                  <h4 className="match-title">{match.matchTitle || match.matchId}</h4>
                  {match.teamA && match.teamB && (
                    <p className="match-teams">{match.teamA} vs {match.teamB}</p>
                  )}
                  {match.venue && (
                    <p className="match-venue">{match.venue}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {matches.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: 'var(--muted)' }}>No matches in this tournament</p>
        </div>
      )}

      {/* Leaderboard Modal */}
      {showLeaderboard && tournamentInfo && (
        <TournamentLeaderboardModal
          sport={tournamentInfo.sport}
          tournamentId={tournamentInfo.tournamentId}
          onClose={() => setShowLeaderboard(false)}
        />
      )}
    </section>
  );
}
