import { useState, useEffect } from 'react';
import { onValue, ref, get } from 'firebase/database';
import { rtdb } from '../../firebase/config';

interface AudienceGateProps {
  onJoinMatch: (matchCode: string) => void;
  onJoinTournament: (tournamentCode: string) => void;
}

interface ActiveMatch {
  matchCode: string;
  sport: string;
  tournamentId: string;
  matchId: string;
  updatedAt: any;
}

interface ActiveTournament {
  tournamentCode: string;
  sport: string;
  tournamentId: string;
  tournamentName?: string;
  status?: string;
  updatedAt: any;
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

        // Filter matches by checking their actual status from meta
        const liveMatches = await Promise.all(
          matches.map(async (match) => {
            try {
              const metaRef = ref(rtdb, `${dbRoot}/tournaments/${match.sport}/${match.tournamentId}/matches/${match.matchId}/meta`);
              const metaSnap = await get(metaRef);
              const meta = metaSnap.val();
              if (meta && (meta.status === 'live' || meta.status === 'active')) {
                return match;
              }
              return null;
            } catch (err) {
              console.error('[AudienceGate] Error fetching match meta:', match.matchCode, err);
              return null;
            }
          })
        );

        setActiveMatches(liveMatches.filter((m): m is ActiveMatch => m !== null));
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
                return tournament;
              }
              return null;
            } catch (err) {
              console.error('[AudienceGate] Error fetching tournament meta:', tournament.tournamentCode, err);
              return null;
            }
          })
        );

        setActiveTournaments(activeTournaments.filter((t): t is NonNullable<typeof t> => t !== null));
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
        console.log('[AudienceGate] Joining match:', code.trim().toLowerCase());
        onJoinMatch(code.trim().toLowerCase());
      } else {
        console.log('[AudienceGate] Joining tournament:', code.trim().toLowerCase());
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

  return (
    <section className="panel audience-gate">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Welcome</p>
          <h1>Join a Live Match</h1>
          <p style={{ color: 'var(--muted)', marginTop: 8, fontSize: '0.9rem', lineHeight: 1.5 }}>
            Enter a match code to join predictions and chat with other fans
          </p>
        </div>
      </div>
      
      {/* Input Type Toggle */}
      <div className="gate-toggle-group">
        <button
          type="button"
          onClick={() => setInputType('match')}
          className={`gate-toggle-btn ${inputType === 'match' ? 'active' : ''}`}
        >
          Match Code
        </button>
        <button
          type="button"
          onClick={() => setInputType('tournament')}
          className={`gate-toggle-btn ${inputType === 'tournament' ? 'active' : ''}`}
        >
          Tournament Code
        </button>
      </div>

      <form onSubmit={handleSubmit} className="stack-form gate-form">
        <label className="gate-label">
          <span className="gate-label-text">
            {inputType === 'match' ? 'Match Code' : 'Tournament Code'}
          </span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={40}
            placeholder={inputType === 'match' ? 'e.g. mi-vs-csk' : 'e.g. ipl-2026'}
            required
            className="gate-input"
          />
        </label>
        <button type="submit" className="primary-btn gate-submit-btn">
          {inputType === 'match' ? 'Join Match →' : 'Browse Tournament →'}
        </button>
      </form>

      {/* Active Matches List */}
      <div className="active-discovery">
        <div className="discovery-header">
          <p className="discovery-kicker">Live Matches</p>
          <span className="discovery-count">{activeMatches.length}</span>
        </div>
        {loadingMatches ? (
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Loading live matches...</p>
        ) : activeMatches.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>No live matches at the moment</p>
        ) : (
          <div className="active-sessions-grid">
            {activeMatches.map((match) => (
              <button
                key={match.matchCode}
                onClick={() => handleQuickJoinMatch(match.matchCode)}
                className="discovery-chip"
              >
                <span className="pulse-dot"></span>
                <span className="discovery-sport-icon">{getSportIcon(match.sport)}</span>
                <span className="discovery-chip-text">{match.matchCode}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Active Tournaments List */}
      <div className="active-discovery">
        <div className="discovery-header">
          <p className="discovery-kicker">Live Tournaments</p>
          <span className="discovery-count">{activeTournaments.length}</span>
        </div>
        {loadingTournaments ? (
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Loading tournaments...</p>
        ) : activeTournaments.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>No active tournaments</p>
        ) : (
          <div className="active-sessions-grid">
            {activeTournaments.map((tournament) => (
              <button
                key={tournament.tournamentCode}
                onClick={() => handleQuickJoinTournament(tournament.tournamentCode)}
                className="discovery-chip"
              >
                <span className="pulse-dot"></span>
                <span className="discovery-sport-icon">{getSportIcon(tournament.sport)}</span>
                <span className="discovery-chip-text">{tournament.tournamentName || tournament.tournamentCode}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
