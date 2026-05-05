import { useState, useEffect } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { get, ref } from 'firebase/database';
import { rtdb } from '../../firebase/config';

interface LeaderboardEntry {
  rank: number;
  name: string;
  totalScore: number;
  predictionsCount: number;
  accuracy: number;
}

interface RouteState {
  from?: string;
  sport?: string;
  tournamentId?: string;
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

export default function TournamentLeaderboardPage() {
  const params = useParams<{ sport: string; tournamentId: string; tournamentCode: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = (location.state ?? {}) as RouteState;
  const sport = params.sport ?? routeState.sport ?? 'cricket';
  const tournamentId = params.tournamentId ?? params.tournamentCode ?? routeState.tournamentId;
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tournamentInfo, setTournamentInfo] = useState<any>(null);

  useEffect(() => {
    const loadLeaderboard = async () => {
      if (!sport || !tournamentId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const dbRoot = getDbRoot();

        // Get tournament info
        const tournamentPath = `${dbRoot}/tournaments/${sport}/${tournamentId}`;
        const tournamentSnap = await get(ref(rtdb, tournamentPath));
        const tournamentData = tournamentSnap.val();
        setTournamentInfo(tournamentData);

        // Get all users in tournament
        const usersPath = `${dbRoot}/tournaments/${sport}/${tournamentId}/users`;
        const usersSnap = await get(ref(rtdb, usersPath));
        const usersData = usersSnap.val();

        if (usersData) {
          const entries = Object.entries(usersData)
            .map(([name, userData]: [string, any]) => {
              let totalScore = 0;
              let predictionsCount = 0;
              let correctPredictions = 0;

              // Calculate scores from all matches
              if (userData.matches) {
                Object.values(userData.matches).forEach((matchData: any) => {
                  if (matchData.first_inn?.reconciled?.score) {
                    totalScore += matchData.first_inn.reconciled.score;
                    predictionsCount++;
                    if (matchData.first_inn.reconciled.score > 0) {
                      correctPredictions++;
                    }
                  }
                  if (matchData.second_inn?.reconciled?.score) {
                    totalScore += matchData.second_inn.reconciled.score;
                    predictionsCount++;
                    if (matchData.second_inn.reconciled.score > 0) {
                      correctPredictions++;
                    }
                  }
                });
              }

              const accuracy = predictionsCount > 0 ? (correctPredictions / predictionsCount) * 100 : 0;

              return {
                name,
                totalScore,
                predictionsCount,
                accuracy,
                rank: 0 // Will be calculated after sorting
              };
            })
            .sort((a, b) => b.totalScore - a.totalScore)
            .map((entry, index) => ({ ...entry, rank: index + 1 }));

          setLeaderboard(entries);
        }
        setLoading(false);
      } catch (error) {
        console.error('[TournamentLeaderboardPage] Error loading leaderboard:', error);
        setLoading(false);
      }
    };

    loadLeaderboard();
  }, [sport, tournamentId]);

  const handleBack = () => {
    navigate(routeState.from || (tournamentId ? `/tournament/${tournamentId}` : '/'));
  };

  return (
    <div className="leaderboard-full-page">
      {/* Header */}
      <div className="leaderboard-page-header">
        <button className="back-btn" onClick={handleBack}>
          ← Back to Tournament
        </button>
        <div className="tournament-info">
          {tournamentInfo && (
            <>
              <span className="tournament-label">{sport?.toUpperCase()}</span>
              <span className="tournament-name">{tournamentInfo.name || 'Tournament'}</span>
            </>
          )}
        </div>
        <button className="close-btn" onClick={handleBack}>
          ✕
        </button>
      </div>

      {/* Main Content */}
      <div className="leaderboard-page-body">
        <div className="leaderboard-header">
          <h2>Tournament Leaderboard</h2>
          <p>Complete rankings across all matches in this tournament.</p>
        </div>

        {loading ? (
          <div className="loading-state">
            <h3>Loading Leaderboard</h3>
            <p>Fetching tournament rankings from server...</p>
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="empty-state">
            <h3>No Rankings Yet</h3>
            <p>No players have participated in this tournament yet.</p>
          </div>
        ) : (
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>RANK</th>
                <th>PLAYER</th>
                <th>TOTAL SCORE</th>
                <th>PREDICTIONS</th>
                <th>ACCURACY</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry) => (
                <tr key={entry.name}>
                  <td className="rank-cell">
                    <div className={`rank-badge ${entry.rank === 1 ? 'rank-1' : entry.rank === 2 ? 'rank-2' : entry.rank === 3 ? 'rank-3' : ''}`}>
                      {entry.rank}
                    </div>
                  </td>
                  <td className="player-cell">
                    <span className="player-name">{entry.name}</span>
                  </td>
                  <td className="score-cell">
                    <span className="score-value">{entry.totalScore}</span>
                  </td>
                  <td className="predictions-cell">
                    <span className="predictions-count">{entry.predictionsCount}</span>
                  </td>
                  <td className="accuracy-cell">
                    <div className="accuracy-bar">
                      <div 
                        className="accuracy-fill" 
                        style={{ width: `${entry.accuracy}%` }}
                      />
                    </div>
                    <span className="accuracy-text">{entry.accuracy.toFixed(1)}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
