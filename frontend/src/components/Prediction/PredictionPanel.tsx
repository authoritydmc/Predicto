import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { savePrediction, saveUserGlobalProfile, userRef, matchMetaRef, matchLiveScoreRef } from '../../firebase/services';
import { onValue, get } from 'firebase/database';

interface PredictionPanelProps {
  sport: string;
  id: string;
  matchId?: string;
  clientId: string;
}

export default function PredictionPanel({ sport, id, matchId, clientId }: PredictionPanelProps) {
  const [name, setName] = useState('');
  const [winner, setWinner] = useState('');
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [teamA, setTeamA] = useState('Team A');
  const [teamB, setTeamB] = useState('Team B');
  const [loading, setLoading] = useState(false);
  const [battingFirst, setBattingFirst] = useState<'teamA' | 'teamB' | null>(null);
  const [currentInnings, setCurrentInnings] = useState<number>(1);
  const [secondInningsScore, setSecondInningsScore] = useState('');
  const [showSecondInningsPrediction, setShowSecondInningsPrediction] = useState(false);
  const [matchStatus, setMatchStatus] = useState<string>('scheduled');
  const [predictedBattingFirst, setPredictedBattingFirst] = useState<'teamA' | 'teamB'>('teamA');
  const [isMatchCompleted, setIsMatchCompleted] = useState(false);

  console.log('[PredictionPanel] Component mounted with props:', { sport, id, matchId, clientId });

  // Load match meta to get team names and batting info
  useEffect(() => {
    if (!matchId) {
      console.log('[PredictionPanel] No matchId provided, skipping meta load');
      return;
    }
    const loadMatchMeta = async () => {
      try {
        console.log('[PredictionPanel] Loading match meta for:', { sport, id, matchId });
        const snap = await get(matchMetaRef(sport, id, matchId));
        const data = snap.val();
        console.log('[PredictionPanel] Match meta data:', data);
        if (data?.teamA) {
          setTeamA(data.teamA);
          console.log('[PredictionPanel] Set teamA:', data.teamA);
        }
        if (data?.teamB) {
          setTeamB(data.teamB);
          console.log('[PredictionPanel] Set teamB:', data.teamB);
        }
        
        // Set match status
        if (data?.status) {
          setMatchStatus(data.status);
          // Lock predictions if match is completed
          setIsMatchCompleted(data.status === 'done' || data.status === 'completed');
        }
        
        // Determine who is batting first (only if match is live and toss done)
        if (data?.status === 'live' && data?.disableScoreA !== undefined && data?.disableScoreB !== undefined) {
          if (data.disableScoreA === false && data.disableScoreB === true) {
            setBattingFirst('teamA');
          } else if (data.disableScoreA === true && data.disableScoreB === false) {
            setBattingFirst('teamB');
          }
        }
        
        // Set current innings
        if (data?.innings) {
          setCurrentInnings(data.innings);
        }
      } catch (error) {
        console.error('[PredictionPanel] Error loading match meta:', error);
      }
    };
    loadMatchMeta();
    
    // Listen for live score updates to detect innings change
    const liveScoreListener = onValue(matchLiveScoreRef(sport, id, matchId), (snap) => {
      const data = snap.val();
      if (data?.currentInnings) {
        setCurrentInnings(data.currentInnings);
        // Show second innings prediction when entering 2nd innings
        if (data.currentInnings === 2 && !showSecondInningsPrediction) {
          setShowSecondInningsPrediction(true);
        }
      }
    });
    
    return () => liveScoreListener();
  }, [sport, id, matchId, showSecondInningsPrediction]);

  // Sync with Global Profile
  useEffect(() => {
    console.log('[PredictionPanel] Setting up user profile listener for clientId:', clientId);
    return onValue(userRef(clientId), (snap) => {
      const data = snap.val();
      console.log('[PredictionPanel] User profile data received:', data);
      if (data?.username) {
        setName(data.username);
        console.log('[PredictionPanel] Set name from profile:', data.username);
      }
    }, (error) => {
      console.error('[PredictionPanel] Error fetching user profile:', error);
    });
  }, [clientId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (clientId && name.trim()) {
      setLoading(true);
      try {
        console.log('[PredictionPanel] Submitting prediction:', { name, winner, scoreA, scoreB, matchStatus, predictedBattingFirst });
        
        // 1. Save global profile (to remember name for chat/other matches)
        await saveUserGlobalProfile(clientId, { username: name });

        // 2. Save prediction for this specific match
        const predictionData: any = {
          userId: clientId,
          name: name,
          sportType: sport,
          currentInnings: currentInnings
        };

        if (matchStatus === 'scheduled') {
          // Scheduled match: predict both scenarios
          predictionData.predictedBattingFirst = predictedBattingFirst;
          predictionData.scoreA = scoreA;
          predictionData.scoreB = scoreB;
          predictionData.predictedWinner = winner;
        } else if (matchStatus === 'live' && battingFirst) {
          // Live match after toss: only batting team score
          predictionData.battingFirst = battingFirst;
          predictionData.scoreA = battingFirst === 'teamA' ? scoreA : '';
          predictionData.scoreB = battingFirst === 'teamB' ? scoreB : '';
          predictionData.predictedWinner = winner;
        }

        await savePrediction(sport, id, clientId, predictionData, matchId);
        
        console.log('[PredictionPanel] Prediction submitted successfully');
        alert('Prediction submitted!');
        
        // Clear form
        setWinner('');
        setScoreA('');
        setScoreB('');
        setSecondInningsScore('');
      } catch (error) {
        console.error('[PredictionPanel] Error submitting prediction:', error);
        alert('Error submitting prediction. Please try again.');
      } finally {
        setLoading(false);
      }
    } else {
      alert('Please enter your name to submit a prediction.');
    }
  };

  const handleSecondInningsPrediction = async (e: FormEvent) => {
    e.preventDefault();
    if (clientId && name.trim() && secondInningsScore.trim()) {
      setLoading(true);
      try {
        console.log('[PredictionPanel] Submitting second innings prediction:', { name, secondInningsScore });
        
        await savePrediction(sport, id, clientId, {
          userId: clientId,
          name: name,
          secondInningsPrediction: secondInningsScore,
          sportType: sport,
          currentInnings: 2,
          battingFirst: battingFirst
        }, matchId);
        
        console.log('[PredictionPanel] Second innings prediction submitted successfully');
        alert('Second innings prediction submitted!');
        setSecondInningsScore('');
      } catch (error) {
        console.error('[PredictionPanel] Error submitting second innings prediction:', error);
        alert('Error submitting prediction. Please try again.');
      } finally {
        setLoading(false);
      }
    } else {
      alert('Please enter your prediction score.');
    }
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Predict & Win • {sport.toUpperCase()}</p>
          <h2>Submit your call</h2>
        </div>
        <span className={`status-pill ${matchStatus === 'live' ? 'status-live' : matchStatus === 'done' || matchStatus === 'completed' ? 'status-done' : 'status-scheduled'}`}>
          {matchStatus === 'live' ? 'Live' : matchStatus === 'done' || matchStatus === 'completed' ? 'Completed' : 'Scheduled'}
        </span>
      </div>

      {/* Match Completed Lock Message */}
      {isMatchCompleted && (
        <div style={{ 
          padding: '16px', 
          background: 'rgba(239, 68, 68, 0.1)', 
          borderRadius: '8px', 
          marginBottom: '16px',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          textAlign: 'center'
        }}>
          <p style={{ margin: 0, fontSize: '14px', color: '#ef4444', fontWeight: 600 }}>
            🔒 This match has ended. Predictions are closed.
          </p>
        </div>
      )}

      {/* Scheduled Match: Predict both scenarios */}
      {!isMatchCompleted && matchStatus === 'scheduled' && sport === 'cricket' && (
        <>
          <div style={{ 
            padding: '12px', 
            background: 'rgba(52, 199, 89, 0.1)', 
            borderRadius: '8px', 
            marginBottom: '16px',
            border: '1px solid rgba(52, 199, 89, 0.3)'
          }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#34c759', fontWeight: 600 }}>
              📅 Match Scheduled - Predict first innings for both scenarios
            </p>
          </div>

          <form onSubmit={handleSubmit} className="stack-form">
            <label>
              Your name
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={30}
                required
                placeholder="Display name..."
                readOnly
                className="readonly-input"
              />
            </label>

            <label>
              Who do you think will bat first?
              <select 
                value={predictedBattingFirst} 
                onChange={e => setPredictedBattingFirst(e.target.value as 'teamA' | 'teamB')}
                required
              >
                <option value="teamA">{teamA}</option>
                <option value="teamB">{teamB}</option>
              </select>
            </label>

            <label>
              Predicted winner
              <select value={winner} onChange={e => setWinner(e.target.value)} required>
                <option value="">Choose winner...</option>
                <option value="teamA">{teamA}</option>
                <option value="teamB">{teamB}</option>
              </select>
            </label>

            <div className="dual-row">
              <label>
                {teamA} First Innings Forecast
                <input
                  type="text"
                  value={scoreA}
                  onChange={e => setScoreA(e.target.value)}
                  placeholder="e.g. 185/4"
                  required
                />
              </label>
              <label>
                {teamB} First Innings Forecast
                <input
                  type="text"
                  value={scoreB}
                  onChange={e => setScoreB(e.target.value)}
                  placeholder="e.g. 180/8"
                  required
                />
              </label>
            </div>

            <button type="submit" className="primary-btn" disabled={loading}>
              {loading ? 'Submitting...' : 'Send prediction'}
            </button>
          </form>
        </>
      )}

      {/* Live Match After Toss: Only batting team score */}
      {!isMatchCompleted && matchStatus === 'live' && battingFirst && sport === 'cricket' && currentInnings === 1 && (
        <>
          <div style={{ 
            padding: '12px', 
            background: 'rgba(255, 159, 10, 0.1)', 
            borderRadius: '8px', 
            marginBottom: '16px',
            border: '1px solid rgba(255, 159, 10, 0.3)'
          }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#ff9f0a', fontWeight: 600 }}>
              🏏 {battingFirst === 'teamA' ? teamA : teamB} is batting first
            </p>
          </div>

          <form onSubmit={handleSubmit} className="stack-form">
            <label>
              Your name
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={30}
                required
                placeholder="Display name..."
                readOnly
                className="readonly-input"
              />
            </label>

            <label>
              Predicted winner
              <select value={winner} onChange={e => setWinner(e.target.value)} required>
                <option value="">Choose winner...</option>
                <option value="teamA">{teamA}</option>
                <option value="teamB">{teamB}</option>
              </select>
            </label>

            <label>
              {battingFirst === 'teamA' ? teamA : teamB} First Innings Score
              <input
                type="text"
                value={battingFirst === 'teamA' ? scoreA : scoreB}
                onChange={e => {
                  if (battingFirst === 'teamA') setScoreA(e.target.value);
                  else setScoreB(e.target.value);
                }}
                placeholder="e.g. 185/4"
                required
              />
            </label>

            <button type="submit" className="primary-btn" disabled={loading}>
              {loading ? 'Submitting...' : 'Send prediction'}
            </button>
          </form>
        </>
      )}

      {/* Second Innings Early Prediction */}
      {!isMatchCompleted && currentInnings === 2 && showSecondInningsPrediction && sport === 'cricket' && (
        <>
          <div style={{ 
            padding: '12px', 
            background: 'rgba(52, 199, 89, 0.1)', 
            borderRadius: '8px', 
            marginBottom: '16px',
            border: '1px solid rgba(52, 199, 89, 0.3)'
          }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#34c759', fontWeight: 600 }}>
              🎯 Second Innings - Predict chasing team's final score
            </p>
          </div>
          
          <form onSubmit={handleSecondInningsPrediction} className="stack-form">
            <label>
              Your name
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={30}
                required
                placeholder="Display name..."
                readOnly
                className="readonly-input"
              />
            </label>

            <label>
              {battingFirst === 'teamA' ? teamB : teamA} Final Score Prediction
              <input
                type="text"
                value={secondInningsScore}
                onChange={e => setSecondInningsScore(e.target.value)}
                placeholder="e.g. 182/5"
                required
              />
            </label>

            <button type="submit" className="primary-btn" disabled={loading}>
              {loading ? 'Submitting...' : 'Send second innings prediction'}
            </button>
          </form>
        </>
      )}

      {/* Football (unchanged) */}
      {!isMatchCompleted && sport === 'football' && (
        <form onSubmit={handleSubmit} className="stack-form">
          <label>
            Your name
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={30}
              required
              placeholder="Display name..."
              readOnly
              className="readonly-input"
            />
          </label>

          <label>
            Predicted winner
            <select value={winner} onChange={e => setWinner(e.target.value)} required>
              <option value="">Choose winner...</option>
              <option value="teamA">{teamA}</option>
              <option value="teamB">{teamB}</option>
            </select>
          </label>

          <div className="dual-row">
            <label>
              {teamA} Goals
              <input
                type="number"
                value={scoreA}
                onChange={e => setScoreA(e.target.value)}
                placeholder="0"
                required
              />
            </label>
            <label>
              {teamB} Goals
              <input
                type="number"
                value={scoreB}
                onChange={e => setScoreB(e.target.value)}
                placeholder="0"
                required
              />
            </label>
          </div>

          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? 'Submitting...' : 'Send prediction'}
          </button>
        </form>
      )}
    </section>
  );
}
