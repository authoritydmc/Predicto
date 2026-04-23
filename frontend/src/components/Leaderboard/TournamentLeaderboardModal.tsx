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

  console.log('[TournamentLeaderboardModal] Modal rendered with:', { sport, tournamentId });

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
    <div className="leaderboard-modal-overlay" onClick={onClose}>
      <div className="leaderboard-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="leaderboard-modal-header">
          <button className="back-btn" onClick={onClose}>← Back</button>
          <div className="tournament-info">
            {tournamentName && (
              <>
                <span className="tournament-label">TOURNAMENT</span>
                <span className="tournament-name">{tournamentName}</span>
              </>
            )}
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="leaderboard-modal-body">
          <div className="leaderboard-header">
            <h2>Leaderboard</h2>
            <p>Current standings across all matches</p>
          </div>

          {loading ? (
            <div className="loading-state">Loading leaderboard...</div>
          ) : leaderboard.length === 0 ? (
            <div className="empty-state">No leaderboard data available</div>
          ) : (
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>RANK</th>
                  <th>PLAYER</th>
                  <th>POINTS</th>
                  <th>MATCHES</th>
                  <th>AVG</th>
                  <th>VISUAL</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry) => (
                  <tr key={entry.name}>
                    <td className="rank-cell">
                      <span className={`rank-badge ${entry.rank === 1 ? 'rank-1' : entry.rank === 2 ? 'rank-2' : entry.rank === 3 ? 'rank-3' : ''}`}>
                        {entry.rank}
                      </span>
                    </td>
                    <td className="player-cell">
                      <span className="player-name">{entry.name}</span>
                    </td>
                    <td className="points-cell">{entry.totalPoints}</td>
                    <td className="matches-cell">{entry.matchesPlayed}</td>
                    <td className="avg-cell">
                      {entry.matchesPlayed > 0 ? (entry.totalPoints / entry.matchesPlayed).toFixed(1) : '0.0'}
                    </td>
                    <td className="visual-cell">
                      <div className="score-bar">
                        <div 
                          className="score-bar-fill" 
                          style={{ width: `${Math.min((entry.totalPoints / (leaderboard[0]?.totalPoints || 1)) * 100, 100)}%` }}
                        />
                      </div>
                    </td>
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
