import { useState, useEffect } from 'react';
import { onValue, ref } from 'firebase/database';
import { rtdb } from '../../firebase/config';

interface AudienceGateProps {
  onJoin: (code: string) => void;
}

interface ActiveMatch {
  roomId: string;
  sport: string;
  tournamentId: string;
  updatedAt: any;
}

export default function AudienceGate({ onJoin }: AudienceGateProps) {
  const [code, setCode] = useState('');
  const [activeMatches, setActiveMatches] = useState<ActiveMatch[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);

  // Fetch active matches from discovery
  useEffect(() => {
    const dbRoot = import.meta.env.DEV ? 'local' : 'prod';
    const discoveryRef = ref(rtdb, `${dbRoot}/discovery`);
    
    const unsub = onValue(discoveryRef, (snap) => {
      const data = snap.val();
      if (data) {
        const matches = Object.entries(data).map(([roomId, info]: [string, any]) => ({
          roomId,
          sport: info.sport,
          tournamentId: info.tournamentId,
          updatedAt: info.updatedAt
        }));
        setActiveMatches(matches);
      } else {
        setActiveMatches([]);
      }
      setLoadingMatches(false);
    }, (error) => {
      console.error('[AudienceGate] Error fetching discovery:', error);
      setLoadingMatches(false);
    });

    return () => unsub();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim()) {
      onJoin(code.trim().toLowerCase());
    }
  };

  const handleQuickJoin = (roomId: string) => {
    onJoin(roomId.toLowerCase());
  };

  return (
    <section className="panel audience-gate">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Join Match</p>
          <h2>Enter the match code</h2>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="stack-form">
        <label>
          Match code
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={40}
            placeholder="e.g. ipl"
            required
          />
        </label>
        <button type="submit" className="primary-btn">Join audience room</button>
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
                key={match.roomId}
                onClick={() => handleQuickJoin(match.roomId)}
                className="discovery-chip"
              >
                <span className="pulse-dot"></span>
                <span>{match.roomId}</span>
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
    </section>
  );
}
