import { useState, useEffect } from 'react';
import { onValue, ref, get } from 'firebase/database';
import { rtdb } from '../../firebase/config';
import { tournamentDiscoveryRef } from '../../firebase/services';

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

const getDbRoot = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('firebase_mode') === 'prod' ? 'prod' : 'local';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTournament = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get tournament info from discovery
        const tournamentSnap = await get(tournamentDiscoveryRef(tournamentCode));
        const tournamentData = tournamentSnap.val();

        if (!tournamentData) {
          setError('Tournament not found');
          setLoading(false);
          return;
        }

        setTournamentInfo(tournamentData);

        // Fetch all matches
        const dbRoot = getDbRoot();
        const matchesRef = ref(rtdb, `${dbRoot}/tournaments/${tournamentData.sport}/${tournamentData.tournamentId}/matches`);
        
        const unsub = onValue(matchesRef, (snap) => {
          const matchesData = snap.val();
          if (matchesData) {
            const allMatches = Object.entries(matchesData).map(([matchId, data]: [string, any]) => ({
              matchId,
              meta: data.meta
            }));
            setMatches(allMatches);
          } else {
            setMatches([]);
          }
          setLoading(false);
        }, (err) => {
          console.error('[TournamentBrowser] Error fetching matches:', err);
          setError('Failed to load matches');
          setLoading(false);
        });

        return () => unsub();
      } catch (err) {
        console.error('[TournamentBrowser] Error loading tournament:', err);
        setError('Failed to load tournament');
        setLoading(false);
      }
    };

    loadTournament();
  }, [tournamentCode]);

  const categorizeMatches = () => {
    const now = Date.now();
    const live: Match[] = [];
    const upcoming: Match[] = [];
    const previous: Match[] = [];

    matches.forEach(match => {
      const status = match.meta?.status || 'scheduled';
      const matchDate = match.meta?.date ? new Date(match.meta.date).getTime() : 0;

      if (status === 'live') {
        live.push(match);
      } else if (status === 'done') {
        previous.push(match);
      } else if (matchDate > now) {
        upcoming.push(match);
      } else {
        previous.push(match);
      }
    });

    // Sort upcoming by date (soonest first)
    upcoming.sort((a, b) => {
      const dateA = a.meta?.date ? new Date(a.meta.date).getTime() : 0;
      const dateB = b.meta?.date ? new Date(b.meta.date).getTime() : 0;
      return dateA - dateB;
    });

    // Sort previous by date (most recent first)
    previous.sort((a, b) => {
      const dateA = a.meta?.date ? new Date(a.meta.date).getTime() : 0;
      const dateB = b.meta?.date ? new Date(b.meta.date).getTime() : 0;
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
              <button
                key={match.matchId}
                onClick={() => onJoinMatch(match.matchId)}
                className="match-card live"
              >
                <div className="match-card-header">
                  <span className="match-status live">LIVE</span>
                </div>
                <div className="match-card-content">
                  <h4 className="match-title">{match.meta?.matchTitle || match.matchId}</h4>
                  {match.meta?.teamA && match.meta?.teamB && (
                    <p className="match-teams">{match.meta.teamA} vs {match.meta.teamB}</p>
                  )}
                </div>
              </button>
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
              <button
                key={match.matchId}
                onClick={() => onJoinMatch(match.matchId)}
                className="match-card"
              >
                <div className="match-card-header">
                  <span className="match-date">{formatDate(match.meta?.date)}</span>
                </div>
                <div className="match-card-content">
                  <h4 className="match-title">{match.meta?.matchTitle || match.matchId}</h4>
                  {match.meta?.teamA && match.meta?.teamB && (
                    <p className="match-teams">{match.meta.teamA} vs {match.meta.teamB}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Previous Matches */}
      {previous.length > 0 && (
        <div className="tournament-section">
          <div className="section-header">
            <h3 className="section-title">Completed</h3>
            <span className="section-count">{previous.length}</span>
          </div>
          <div className="match-grid">
            {previous.map((match) => (
              <button
                key={match.matchId}
                onClick={() => onJoinMatch(match.matchId)}
                className="match-card completed"
              >
                <div className="match-card-header">
                  <span className="match-status done">DONE</span>
                  <span className="match-date">{formatDate(match.meta?.date)}</span>
                </div>
                <div className="match-card-content">
                  <h4 className="match-title">{match.meta?.matchTitle || match.matchId}</h4>
                  {match.meta?.teamA && match.meta?.teamB && (
                    <p className="match-teams">{match.meta.teamA} vs {match.meta.teamB}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {matches.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: 'var(--muted)' }}>No matches in this tournament</p>
        </div>
      )}
    </section>
  );
}
