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
  predictedWinner?: string;
  scoreA?: string;
  scoreB?: string;
  teamABattingFirstScore?: string;
  teamBBattingFirstScore?: string;
  secondInningsWinner?: string;
  secondInningsChasingScore?: string;
  secondInningsWinOvers?: string;
  timestamp?: number;
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
  const [currentInnings, setCurrentInnings] = useState<number>(1);

  useEffect(() => {
    const loadPredictions = async () => {
      try {
        setLoading(true);
        const dbRoot = getDbRoot();

        // Get match meta to determine current innings
        const matchMetaPath = `${dbRoot}/tournaments/${sport}/${tournamentId}/matches/${matchId}/meta`;
        const matchMetaSnap = await get(rtdb.ref(rtdb, matchMetaPath));
        const matchMeta = matchMetaSnap.val();
        if (matchMeta?.secondInnings !== undefined) {
          setCurrentInnings(matchMeta.secondInnings ? 2 : 1);
        }

        // Listen to predictions
        const predictionsPath = `${dbRoot}/tournaments/${sport}/${tournamentId}/matches/${matchId}/predictions`;
        const unsub = onValue(rtdb.ref(rtdb, predictionsPath), (snap) => {
          const data = snap.val();
          if (data) {
            const entries = Object.entries(data).map(([name, userData]: [string, any]) => {
              let prediction: PredictionEntry = { name, timestamp: userData.timestamp };
              
              // Get prediction based on current innings
              if (currentInnings === 2 && userData.second_inn) {
                prediction = {
                  ...prediction,
                  predictedWinner: userData.second_inn.secondInningsWinner,
                  secondInningsWinner: userData.second_inn.secondInningsWinner,
                  secondInningsChasingScore: userData.second_inn.secondInningsChasingScore,
                  secondInningsWinOvers: userData.second_inn.secondInningsWinOvers,
                  timestamp: userData.second_inn.timestamp
                };
              } else if (currentInnings === 1 && userData.first_inn) {
                prediction = {
                  ...prediction,
                  predictedWinner: userData.first_inn.predictedWinner,
                  scoreA: userData.first_inn.scoreA,
                  scoreB: userData.first_inn.scoreB,
                  timestamp: userData.first_inn.timestamp
                };
              } else if (userData.early_predict?.first) {
                prediction = {
                  ...prediction,
                  predictedWinner: userData.early_predict.first.predictedWinner,
                  teamABattingFirstScore: userData.early_predict.first.teamABattingFirstScore,
                  teamBBattingFirstScore: userData.early_predict.first.teamBBattingFirstScore,
                  timestamp: userData.early_predict.first.timestamp
                };
              }
              
              return prediction;
            }).filter(p => p.predictedWinner || p.scoreA || p.scoreB || p.teamABattingFirstScore);
            
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
  }, [sport, tournamentId, matchId, currentInnings]);

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📊 Predictions by Others</h2>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ color: 'var(--muted)', marginBottom: '16px', fontSize: '0.9rem' }}>
            {currentInnings === 2 ? 'Second Innings Predictions' : 'First Innings Predictions'}
          </p>
          {loading ? (
            <p style={{ color: 'var(--muted)', textAlign: 'center' }}>Loading predictions...</p>
          ) : predictions.length === 0 ? (
            <p style={{ color: 'var(--muted)', textAlign: 'center' }}>No predictions yet</p>
          ) : (
            <div className="predictions-list">
              {predictions.map((prediction, index) => (
                <div key={index} className="prediction-card">
                  <div className="prediction-header">
                    <span className="prediction-name">{prediction.name}</span>
                    {prediction.timestamp && (
                      <span className="prediction-time">{formatTime(prediction.timestamp)}</span>
                    )}
                  </div>
                  <div className="prediction-details">
                    {prediction.predictedWinner && (
                      <div className="prediction-detail">
                        <span className="detail-label">Winner:</span>
                        <span className="detail-value">{prediction.predictedWinner === 'teamA' ? 'Team A' : 'Team B'}</span>
                      </div>
                    )}
                    {currentInnings === 1 && prediction.scoreA && (
                      <div className="prediction-detail">
                        <span className="detail-label">Score A:</span>
                        <span className="detail-value">{prediction.scoreA}</span>
                      </div>
                    )}
                    {currentInnings === 1 && prediction.scoreB && (
                      <div className="prediction-detail">
                        <span className="detail-label">Score B:</span>
                        <span className="detail-value">{prediction.scoreB}</span>
                      </div>
                    )}
                    {prediction.teamABattingFirstScore && (
                      <div className="prediction-detail">
                        <span className="detail-label">If Team A bats first:</span>
                        <span className="detail-value">{prediction.teamABattingFirstScore}</span>
                      </div>
                    )}
                    {prediction.teamBBattingFirstScore && (
                      <div className="prediction-detail">
                        <span className="detail-label">If Team B bats first:</span>
                        <span className="detail-value">{prediction.teamBBattingFirstScore}</span>
                      </div>
                    )}
                    {currentInnings === 2 && prediction.secondInningsChasingScore && (
                      <div className="prediction-detail">
                        <span className="detail-label">Chasing Score:</span>
                        <span className="detail-value">{prediction.secondInningsChasingScore}</span>
                      </div>
                    )}
                    {currentInnings === 2 && prediction.secondInningsWinOvers && (
                      <div className="prediction-detail">
                        <span className="detail-label">Win in:</span>
                        <span className="detail-value">{prediction.secondInningsWinOvers} overs</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
