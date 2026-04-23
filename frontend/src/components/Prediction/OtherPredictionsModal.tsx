import { useState, useEffect } from 'react';
import { onValue, get, ref } from 'firebase/database';
import { rtdb } from '../../firebase/config';

interface OtherPredictionsModalProps {
  sport: string;
  tournamentId: string;
  matchId: string;
  onClose: () => void;
}

interface PredictionEntry {
  name: string;
  firstInningsCall?: string;
  secondInningsCall?: string;
  penalty?: number;
  totalScore?: number;
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

export default function OtherPredictionsModal({ sport, tournamentId, matchId, onClose }: OtherPredictionsModalProps) {
  const [predictions, setPredictions] = useState<PredictionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchInfo, setMatchInfo] = useState<any>(null);

  useEffect(() => {
    const loadPredictions = async () => {
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

              // Parse first innings prediction
              if (userData.first_inn) {
                const winner = userData.first_inn.predictedWinner === 'teamA' ? matchMeta?.teamA : matchMeta?.teamB;
                firstCall = `${winner} ${userData.first_inn.scoreA || 0}+${userData.first_inn.scoreB || 0}`;
              } else if (userData.early_predict?.first) {
                const winner = userData.early_predict.first.predictedWinner === 'teamA' ? matchMeta?.teamA : matchMeta?.teamB;
                firstCall = `${winner} ${userData.early_predict.first.teamABattingFirstScore || 0}+${userData.early_predict.first.teamBBattingFirstScore || 0}`;
              }

              // Parse second innings prediction
              if (userData.second_inn) {
                const winner = userData.second_inn.secondInningsWinner === 'teamA' ? matchMeta?.teamA : matchMeta?.teamB;
                if (userData.second_inn.secondInningsWinOvers) {
                  secondCall = `${winner} in ${userData.second_inn.secondInningsWinOvers}`;
                } else if (userData.second_inn.secondInningsChasingScore) {
                  secondCall = `${winner} chase ${userData.second_inn.secondInningsChasingScore}`;
                }
              }

              // Calculate penalty
              if (userData.penalties && Array.isArray(userData.penalties)) {
                penalty = userData.penalties.reduce((sum: number, p: any) => sum + (p.penaltyPoints || 0), 0);
              }

              return {
                name,
                firstInningsCall: firstCall,
                secondInningsCall: secondCall,
                penalty,
                totalScore: 0 // Will be calculated after reconciliation
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
        console.error('[OtherPredictionsModal] Error loading predictions:', error);
        setLoading(false);
      }
    };

    loadPredictions();
  }, [sport, tournamentId, matchId]);

  return (
    <div className="predictions-modal-overlay" onClick={onClose}>
      <div className="predictions-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="predictions-modal-header">
          <button className="back-btn" onClick={onClose}>← Back</button>
          <div className="match-info">
            {matchInfo && (
              <>
                <span className="match-date">{new Date(matchInfo.date || Date.now()).toLocaleDateString()}</span>
                <span className="match-teams">{matchInfo.teamA} vs {matchInfo.teamB}</span>
              </>
            )}
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="predictions-modal-body">
          <div className="predictions-header">
            <h2>Player predictions</h2>
            <p>How each person scored across both innings.</p>
          </div>

          <div className="predictions-legend">
            <span className="legend-item positive">POSITIVE PTS</span>
            <span className="legend-item penalty">PENALTY</span>
          </div>

          {loading ? (
            <div className="loading-state">Loading predictions...</div>
          ) : predictions.length === 0 ? (
            <div className="empty-state">No predictions yet</div>
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
                    <td className="player-cell">
                      <span className="rank">{index + 1}</span>
                      <span className="player-name">{prediction.name}</span>
                    </td>
                    <td className="call-cell">{prediction.firstInningsCall}</td>
                    <td className="call-cell">{prediction.secondInningsCall}</td>
                    <td className="penalty-cell">
                      {prediction.penalty > 0 ? (
                        <span className="penalty-value">-{prediction.penalty}</span>
                      ) : (
                        <span className="no-penalty">-</span>
                      )}
                    </td>
                    <td className="total-cell">{prediction.totalScore || 0}</td>
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
    </div>
  );
}
