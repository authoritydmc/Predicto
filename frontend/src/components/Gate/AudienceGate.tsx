import { useState, useEffect } from 'react';
import { onValue, ref } from 'firebase/database';
import { rtdb } from '../../firebase/config';
import { tournamentDiscoveryRef } from '../../firebase/services';

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

interface TournamentMatch {
  matchId: string;
  matchCode: string;
  sport: string;
  tournamentId: string;
  meta?: any;
}

export default function AudienceGate({ onJoinMatch, onJoinTournament }: AudienceGateProps) {
  const [code, setCode] = useState('');
  const [inputType, setInputType] = useState<'match' | 'tournament'>('match');
  const [activeMatches, setActiveMatches] = useState<ActiveMatch[]>([]);
  const [tournamentMatches, setTournamentMatches] = useState<TournamentMatch[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [loadingTournament, setLoadingTournament] = useState(false);

  // Fetch active matches from discovery
  useEffect(() => {
    const dbRoot = import.meta.env.DEV ? 'local' : 'prod';
    const discoveryRef = ref(rtdb, `${dbRoot}/discovery/matches`);
    
    const unsub = onValue(discoveryRef, (snap) => {
      const data = snap.val();
      if (data) {
        const matches = Object.entries(data).map(([matchCode, info]: [string, any]) => ({
          matchCode,
          sport: info.sport,
          tournamentId: info.tournamentId,
          matchId: info.matchId,
          updatedAt: info.updatedAt
        }));
        setActiveMatches(matches);
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

  // Fetch tournament matches when tournament code is entered
  useEffect(() => {
    if (inputType === 'tournament' && code.trim()) {
      setLoadingTournament(true);
      const tournamentCode = code.trim().toLowerCase();
      const unsub = onValue(tournamentDiscoveryRef(tournamentCode), (snap) => {
        const data = snap.val();
        if (data) {
          const { sport, tournamentId } = data;
          // Fetch all matches in this tournament
          const dbRoot = import.meta.env.DEV ? 'local' : 'prod';
          const matchesRef = ref(rtdb, `${dbRoot}/tournaments/${sport}/${tournamentId}/matches`);
          const unsubMatches = onValue(matchesRef, (matchSnap) => {
            const matchesData = matchSnap.val();
            if (matchesData) {
              const matches = Object.entries(matchesData).map(([matchId, meta]: [string, any]) => ({
                matchId,
                matchCode: matchId,
                sport,
                tournamentId,
                meta: meta.meta
              }));
              setTournamentMatches(matches);
            } else {
              setTournamentMatches([]);
            }
            setLoadingTournament(false);
          });
          return () => unsubMatches();
        } else {
          console.error('[AudienceGate] Tournament not found:', tournamentCode);
          setTournamentMatches([]);
          setLoadingTournament(false);
        }
      }, (error) => {
        console.error('[AudienceGate] Error fetching tournament:', error);
        setTournamentMatches([]);
        setLoadingTournament(false);
      });
      return () => unsub();
    } else {
      setTournamentMatches([]);
    }
  }, [code, inputType]);

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

  return (
    <section className="panel audience-gate">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Join Match</p>
          <h2>Enter the code</h2>
        </div>
      </div>
      
      {/* Input Type Toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setInputType('match')}
          className={`ghost-link-xs ${inputType === 'match' ? 'active' : ''}`}
          style={{ 
            padding: '8px 16px',
            borderRadius: 4,
            background: inputType === 'match' ? 'var(--accent-blue)' : 'transparent',
            color: inputType === 'match' ? 'white' : 'var(--text)'
          }}
        >
          Match Code
        </button>
        <button
          type="button"
          onClick={() => setInputType('tournament')}
          className={`ghost-link-xs ${inputType === 'tournament' ? 'active' : ''}`}
          style={{ 
            padding: '8px 16px',
            borderRadius: 4,
            background: inputType === 'tournament' ? 'var(--accent-blue)' : 'transparent',
            color: inputType === 'tournament' ? 'white' : 'var(--text)'
          }}
        >
          Tournament Code
        </button>
      </div>

      <form onSubmit={handleSubmit} className="stack-form">
        <label>
          {inputType === 'match' ? 'Match code' : 'Tournament code'}
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={40}
            placeholder={inputType === 'match' ? 'e.g. csk-vs-mi' : 'e.g. ipl-2024'}
            required
          />
        </label>
        <button type="submit" className="primary-btn">
          {inputType === 'match' ? 'Join Match' : 'Browse Tournament'}
        </button>
      </form>

      {/* Active Matches List */}
      <div className="active-discovery">
        <p className="discovery-kicker">Active Matches</p>
        {loadingMatches ? (
          <p style={{ color: 'var(--muted)' }}>Loading active matches...</p>
        ) : activeMatches.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No active matches currently</p>
        ) : (
          <div className="active-sessions-grid">
            {activeMatches.map((match) => (
              <button
                key={match.matchCode}
                onClick={() => handleQuickJoinMatch(match.matchCode)}
                className="discovery-chip"
              >
                <span className="pulse-dot"></span>
                <span>{match.matchCode}</span>
                <span className="badge-mini" style={{ 
                  background: 'rgba(99, 102, 241, 0.2)', 
                  color: '#818cf8', 
                  padding: '2px 6px', 
                  borderRadius: 4, 
                  fontSize: 10, 
                  fontWeight: 800 
                }}>
                  {match.sport.toUpperCase()}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tournament Matches List */}
      {inputType === 'tournament' && tournamentMatches.length > 0 && (
        <div className="active-discovery" style={{ marginTop: 16 }}>
          <p className="discovery-kicker">Tournament Matches</p>
          {loadingTournament ? (
            <p style={{ color: 'var(--muted)' }}>Loading tournament matches...</p>
          ) : tournamentMatches.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>No matches in this tournament</p>
          ) : (
            <div className="active-sessions-grid">
              {tournamentMatches.map((match) => (
                <button
                  key={match.matchId}
                  onClick={() => handleQuickJoinMatch(match.matchId)}
                  className="discovery-chip"
                >
                  <span className="pulse-dot"></span>
                  <span>{match.meta?.matchTitle || match.matchId}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
