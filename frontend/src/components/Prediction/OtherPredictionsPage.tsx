import { useState, useEffect } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { onValue, get, ref } from 'firebase/database';
import { rtdb } from '../../firebase/config';

interface PredictionEntry {
  name: string;
  firstInningsCall?: string;
  secondInningsCall?: string;
  penalty?: number;
  totalScore?: number;
  rank?: number;
}

interface RouteState {
  from?: string;
  sport?: string;
  tournamentId?: string;
  matchId?: string;
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

export default function OtherPredictionsPage() {
  const params = useParams<{ sport: string; tournamentId: string; matchId: string; matchCode: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = (location.state ?? {}) as RouteState;
  const sport = params.sport ?? routeState.sport;
  const tournamentId = params.tournamentId ?? routeState.tournamentId;
  const matchId = params.matchId ?? params.matchCode ?? routeState.matchId;
  const [predictions, setPredictions] = useState<PredictionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchInfo, setMatchInfo] = useState<any>(null);

  useEffect(() => {
    const loadPredictions = async () => {
      if (!sport || !tournamentId || !matchId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const dbRoot = getDbRoot();

        // Get match meta
        const matchMetaPath = `${dbRoot}/tournaments/${sport}/${tournamentId}/matches/${matchId}/meta`;
        const matchMetaSnap = await get(ref(rtdb, matchMetaPath));
        const matchMeta = matchMetaSnap.val();
        setMatchInfo(matchMeta);

        // Listen to predictions
        const predictionsPath = `${dbRoot}/tournaments/${sport}/${tournamentId}/matches/${matchId}/predictions`;
        const unsub = onValue(ref(rtdb, predictionsPath), (snap) => {
          const data = snap.val();
          if (data) {
            const entries = Object.entries(data).map(([name, userData]: [string, any]) => {
              let firstCall = 'no call';
              let secondCall = 'no call';
              let penalty = 0;
              let totalScore = 0;

              // Parse first innings prediction (new schema)
              if (userData.first_inn) {
                const winner = userData.first_inn.winnerTeam || 'unknown';
                const runs = userData.first_inn.runs || 0;
                firstCall = `${winner} ${runs}`;
              } else if (userData.early_predict?.first) {
                const winner = userData.early_predict.first.winnerTeam || 'unknown';
                const runs = userData.early_predict.first.runs || 0;
                firstCall = `${winner} ${runs}`;
              }

              // Parse second innings prediction (new schema)
              if (userData.second_inn) {
                const winner = userData.second_inn.winnerTeam || 'unknown';
                const runsOrOvers = userData.second_inn.runsOrOvers || 0;
                const isOvers = runsOrOvers.includes('.');
                secondCall = isOvers ? `${winner} in ${runsOrOvers}` : `${winner} chase ${runsOrOvers}`;
              } else if (userData.early_predict?.second) {
                const winner = userData.early_predict.second.winnerTeam || 'unknown';
                const runsOrOvers = userData.early_predict.second.runsOrOvers || 0;
                const isOvers = runsOrOvers.includes('.');
                secondCall = isOvers ? `${winner} in ${runsOrOvers}` : `${winner} chase ${runsOrOvers}`;
              }

              // Calculate penalty from appliedPenalties (new schema)
              if (userData.appliedPenalties && typeof userData.appliedPenalties === 'object') {
                const penaltyValues = Object.values(userData.appliedPenalties) as number[];
                penalty = penaltyValues.reduce((sum: number, val: number) => sum + (val || 0), 0);
              }

              // Get total score if reconciled
              if (userData.second_inn?.reconciled && userData.second_inn?.score) {
                totalScore = userData.second_inn.reconciled.score;
              } else if (userData.first_inn?.reconciled && userData.first_inn?.score) {
                totalScore = userData.first_inn.reconciled.score;
              }

              return {
                name,
                firstInningsCall: firstCall,
                secondInningsCall: secondCall,
                penalty,
                totalScore
              };
            });

            setPredictions(entries);
          } else {
            setPredictions([]);
          }
          setLoading(false);
        });

        return () => unsub();
      } catch (error) {
        console.error('[OtherPredictionsPage] Error loading predictions:', error);
        setLoading(false);
      }
    };

    loadPredictions();
  }, [sport, tournamentId, matchId]);

  const handleBack = () => {
    navigate(routeState.from || (matchId ? `/match/${matchId}` : '/'));
  };

  return (
    <div className="predictions-full-page">
      {/* Header */}
      <div className="predictions-page-header">
        <button className="back-btn" onClick={handleBack}>
          ← Back to Match
        </button>
        <div className="match-info">
          {matchInfo && (
            <>
              <span className="match-date">{new Date(matchInfo.date || Date.now()).toLocaleDateString()}</span>
              <span className="match-teams">{matchInfo.teamA} vs {matchInfo.teamB}</span>
            </>
          )}
        </div>
        <button className="close-btn" onClick={handleBack}>
          ✕
        </button>
      </div>

      {/* Main Content */}
      <div className="predictions-page-body">
        <div className="predictions-header">
          <h2>Player predictions</h2>
          <p>How each person scored across both innings.</p>
        </div>

        <div className="predictions-legend">
          <span className="legend-item positive">POSITIVE PTS</span>
          <span className="legend-item penalty">PENALTY</span>
        </div>

        {loading ? (
          <div className="loading-state">
            <h3>Loading Predictions</h3>
            <p>Fetching player predictions from server...</p>
          </div>
        ) : predictions.length === 0 ? (
          <div className="empty-state">
            <h3>No Predictions Yet</h3>
            <p>Be the first to submit your prediction for this match!</p>
          </div>
        ) : (
          <table className="predictions-table">
            <thead>
              <tr>
                <th>PLAYER</th>
                <th>1ST INNINGS CALL</th>
                <th>2ND INNINGS CALL</th>
                <th>PENALTY</th>
                <th>TOTAL</th>
                <th>VISUAL</th>
              </tr>
            </thead>
            <tbody>
              {predictions.map((prediction, index) => (
                <tr key={index}>
                  <td className="player-cell" data-label="PLAYER">
                    <span className={`rank ${index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : ''}`}>
                      {index + 1}
                    </span>
                    <span className="player-name">{prediction.name}</span>
                  </td>
                  <td className="call-cell" data-label="1ST INNINGS">{prediction.firstInningsCall}</td>
                  <td className="call-cell" data-label="2ND INNINGS">{prediction.secondInningsCall}</td>
                  <td className="penalty-cell" data-label="PENALTY">
                    {(prediction.penalty || 0) > 0 ? (
                      <span className="penalty-value">-{prediction.penalty}</span>
                    ) : (
                      <span className="no-penalty">-</span>
                    )}
                  </td>
                  <td className="total-cell" data-label="TOTAL">{prediction.totalScore || 0}</td>
                  <td className="visual-cell">
                    <div className="score-bar">
                      <div 
                        className="score-bar-fill" 
                        style={{ width: `${Math.min((prediction.totalScore || 0) / 5, 100)}%` }}
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
  );
}
