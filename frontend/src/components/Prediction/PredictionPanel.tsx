import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { savePrediction, saveUserGlobalProfile, userRef, matchMetaRef, matchLiveScoreRef, matchPredictionsRef } from '../../firebase/services';
import { onValue, get } from 'firebase/database';
import CricketPrediction from './CricketPrediction';
import FootballPrediction from './FootballPrediction';

interface PredictionPanelProps {
  sport: string;
  id: string;
  matchId?: string;
  clientId: string;
}

export default function PredictionPanel({ sport, id, matchId, clientId }: PredictionPanelProps) {
  const [name, setName] = useState('');
  const [teamA, setTeamA] = useState('Team A');
  const [teamB, setTeamB] = useState('Team B');
  const [loading, setLoading] = useState(false);
  const [battingFirst, setBattingFirst] = useState<'teamA' | 'teamB' | null>(null);
  const [currentInnings, setCurrentInnings] = useState<number>(1);
  const [showSecondInningsPrediction, setShowSecondInningsPrediction] = useState(false);
  const [matchStatus, setMatchStatus] = useState<string>('scheduled');
  const [isMatchCompleted, setIsMatchCompleted] = useState(false);
  const [predictionsEnabled, setPredictionsEnabled] = useState(true);
  const [predictionsPaused, setPredictionsPaused] = useState(false);
  const [pauseReason, setPauseReason] = useState('');

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

        // Set prediction control settings
        if (data?.predictionsEnabled !== undefined) {
          setPredictionsEnabled(data.predictionsEnabled);
        }
        if (data?.predictionsPaused !== undefined) {
          setPredictionsPaused(data.predictionsPaused);
        }
        if (data?.pauseReason) {
          setPauseReason(data.pauseReason);
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
          // Load user's first innings prediction to get their predicted winner
          loadFirstInningsPrediction();
        }
      }
    });
    
    return () => liveScoreListener();
  }, [sport, id, matchId, showSecondInningsPrediction]);

  // Load user's first innings prediction
  const loadFirstInningsPrediction = async () => {
    try {
      const predictionsSnap = await get(matchPredictionsRef(sport, id, matchId));
      const predictions = predictionsSnap.val();
      if (predictions && predictions[clientId]) {
        const userPrediction = predictions[clientId];
        // Default winner to first innings prediction (handled in child component)
        console.log('[PredictionPanel] First innings prediction loaded:', userPrediction);
      }
    } catch (error) {
      console.error('[PredictionPanel] Error loading first innings prediction:', error);
    }
  };

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

  const handlePredictionSubmit = async (e: FormEvent, formData: any) => {
    e.preventDefault();
    if (clientId && name.trim()) {
      setLoading(true);
      try {
        console.log('[PredictionPanel] Submitting prediction:', { name, formData, matchStatus, currentInnings });
        
        // 1. Save global profile (to remember name for chat/other matches)
        await saveUserGlobalProfile(clientId, { username: name });

        // 2. Save prediction for this specific match
        const predictionData: any = {
          userId: clientId,
          name: name,
          sportType: sport,
          currentInnings: currentInnings
        };

        // Handle different prediction types based on form data
        if (formData.secondInningsWinner) {
          // Second innings prediction
          predictionData.predictionType = 'live_second_innings';
          predictionData.battingFirst = battingFirst;
          predictionData.secondInningsWinner = formData.secondInningsWinner;
          if (formData.secondInningsAllOutScore) {
            predictionData.secondInningsAllOutScore = formData.secondInningsAllOutScore;
          }
          if (formData.secondInningsWinOvers) {
            predictionData.secondInningsWinOvers = formData.secondInningsWinOvers;
          }
        } else if (matchStatus === 'scheduled') {
          // Early first innings prediction
          predictionData.predictionType = 'early_first_innings';
          predictionData.teamABattingFirstScore = formData.teamABattingFirstScore;
          predictionData.teamBBattingFirstScore = formData.teamBBattingFirstScore;
          predictionData.predictedWinner = formData.winner;
        } else if (matchStatus === 'live' && battingFirst) {
          // Live first innings prediction
          predictionData.predictionType = 'live_first_innings';
          predictionData.battingFirst = battingFirst;
          predictionData.scoreA = battingFirst === 'teamA' ? formData.scoreA : '';
          predictionData.scoreB = battingFirst === 'teamB' ? formData.scoreB : '';
          predictionData.predictedWinner = formData.winner;
        } else {
          // Football or other sports
          predictionData.predictedWinner = formData.winner;
          predictionData.scoreA = formData.scoreA;
          predictionData.scoreB = formData.scoreB;
        }

        await savePrediction(sport, id, clientId, predictionData, matchId);
        
        console.log('[PredictionPanel] Prediction submitted successfully');
        alert('Prediction submitted!');
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

      {sport === 'cricket' && (
        <CricketPrediction
          teamA={teamA}
          teamB={teamB}
          name={name}
          matchStatus={matchStatus}
          battingFirst={battingFirst}
          currentInnings={currentInnings}
          showSecondInningsPrediction={showSecondInningsPrediction}
          isMatchCompleted={isMatchCompleted}
          predictionsEnabled={predictionsEnabled}
          predictionsPaused={predictionsPaused}
          pauseReason={pauseReason}
          onNameChange={setName}
          onSubmit={handlePredictionSubmit}
          loading={loading}
        />
      )}

      {sport === 'football' && (
        <FootballPrediction
          teamA={teamA}
          teamB={teamB}
          name={name}
          matchStatus={matchStatus}
          isMatchCompleted={isMatchCompleted}
          predictionsEnabled={predictionsEnabled}
          predictionsPaused={predictionsPaused}
          pauseReason={pauseReason}
          onNameChange={setName}
          onSubmit={handlePredictionSubmit}
          loading={loading}
        />
      )}
    </section>
  );
}
