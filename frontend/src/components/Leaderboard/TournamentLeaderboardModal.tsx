import { useState, useEffect } from 'react';
import { onValue, get, ref } from 'firebase/database';
import { rtdb } from '../../firebase/config';

interface TournamentLeaderboardModalProps {
  sport: string;
  tournamentId: string;
  onClose: () => void;
}

interface LeaderboardEntry {
  name: string;
  totalPoints: number;
  matchesPlayed: number;
  rank?: number;
}

const getDbRoot = () => {
  if (typeof window !== 'undefined') {
    const storedMode = localStorage.getItem('firebase_mode');
    if (storedMode) return storedMode;
    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    const defaultMode = isLocal ? 'local' : 'prod';
    localStorage.setItem('firebase_mode', defaultMode);
    return defaultMode;
  }
  return 'local';
};

export default function TournamentLeaderboardModal({ sport, tournamentId, onClose }: TournamentLeaderboardModalProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tournamentName, setTournamentName] = useState<string>('');

  useEffect(() => {
    const loadLeaderboard = async () => {
      try {
        setLoading(true);
        const dbRoot = getDbRoot();

        // Get tournament name
        const tournamentMetaPath = `${dbRoot}/tournaments/${sport}/${tournamentId}/meta`;
        const tournamentMetaSnap = await get(ref(rtdb, tournamentMetaPath));
        const tournamentMeta = tournamentMetaSnap.val();
        if (tournamentMeta?.tournamentName) {
          setTournamentName(tournamentMeta.tournamentName);
        }

        // Listen to leaderboard
        const leaderboardPath = `${dbRoot}/tournaments/${sport}/${tournamentId}/leaderboard`;
        const unsub = onValue(ref(rtdb, leaderboardPath), (snap) => {
          const data = snap.val();
          if (data) {
            const entries = Object.entries(data)
              .map(([name, stats]: [string, any]) => ({
                name,
                totalPoints: stats.totalPoints || 0,
                matchesPlayed: stats.matchesPlayed || 0
              }))
              .sort((a, b) => b.totalPoints - a.totalPoints)
              .map((entry, index) => ({ ...entry, rank: index + 1 }));
            setLeaderboard(entries);
          } else {
            setLeaderboard([]);
          }
          setLoading(false);
        });

        return () => unsub();
      } catch (error) {
        console.error('[TournamentLeaderboardModal] Error loading leaderboard:', error);
        setLoading(false);
      }
    };

    loadLeaderboard();
  }, [sport, tournamentId]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🏆 Tournament Leaderboard</h2>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {tournamentName && (
            <p style={{ color: 'var(--muted)', marginBottom: '16px', fontSize: '0.9rem' }}>
              {tournamentName}
            </p>
          )}
          {loading ? (
            <p style={{ color: 'var(--muted)', textAlign: 'center' }}>Loading leaderboard...</p>
          ) : leaderboard.length === 0 ? (
            <p style={{ color: 'var(--muted)', textAlign: 'center' }}>No leaderboard data available</p>
          ) : (
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Name</th>
                  <th>Points</th>
                  <th>Matches</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry) => (
                  <tr key={entry.name}>
                    <td>
                      <span className={`rank-badge ${entry.rank === 1 ? 'rank-1' : entry.rank === 2 ? 'rank-2' : entry.rank === 3 ? 'rank-3' : ''}`}>
                        {entry.rank}
                      </span>
                    </td>
                    <td>{entry.name}</td>
                    <td style={{ fontWeight: 'bold', color: '#34c759' }}>{entry.totalPoints}</td>
                    <td>{entry.matchesPlayed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
