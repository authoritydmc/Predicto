import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { savePrediction, saveUserGlobalProfile, userRef, matchMetaRef, matchLiveScoreRef, matchPredictionsRef } from '../../firebase/services';
import { onValue, get } from 'firebase/database';
import CricketPrediction from './CricketPrediction';
import FootballPrediction from './FootballPrediction';
import TournamentLeaderboardModal from '../Leaderboard/TournamentLeaderboardModal';
import OtherPredictionsModal from './OtherPredictionsModal';

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
  const [matchStatus, setMatchStatus] = useState<string>('scheduled');
  const [isMatchCompleted, setIsMatchCompleted] = useState(false);
  const [predictionsEnabled, setPredictionsEnabled] = useState(true);
  const [predictionsPaused, setPredictionsPaused] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const [disableReason, setDisableReason] = useState('');
  const [targetScore, setTargetScore] = useState<number | null>(null);
  const [allowReprediction, setAllowReprediction] = useState(false);
  const [hasPredicted, setHasPredicted] = useState(false);
  const [previousPrediction, setPreviousPrediction] = useState<any>(null);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [showOtherPredictionsModal, setShowOtherPredictionsModal] = useState(false);

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
        console.log('[PredictionPanel] Batting info:', { battingTeam: data?.battingTeam, secondInnings: data?.secondInnings, disableScoreA: data?.disableScoreA, disableScoreB: data?.disableScoreB });
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
        
        // Set batting team from meta (backend now stores battingFirst explicitly)
        if (data?.battingFirst) {
          // Use the explicitly stored battingFirst value
          setBattingFirst(data.battingFirst);
        } else if (data?.battingTeam) {
          // Fallback: infer from battingTeam
          if (data.secondInnings) {
            // Second innings: battingTeam is chasing, so the other team batted first
            setBattingFirst(data.battingTeam === 'teamA' ? 'teamB' : 'teamA');
          } else {
            // First innings: battingTeam is batting first
            setBattingFirst(data.battingTeam);
          }
        } else if (data?.disableScoreA !== undefined && data?.disableScoreB !== undefined) {
          // Final fallback: infer from disableScore flags
          if (data.disableScoreA === false && data.disableScoreB === true) {
            setBattingFirst('teamA');
          } else if (data.disableScoreA === true && data.disableScoreB === false) {
            setBattingFirst('teamB');
          }
        }
        
        // Set current innings (backend uses secondInnings boolean)
        if (data?.secondInnings !== undefined) {
          setCurrentInnings(data.secondInnings ? 2 : 1);
        } else if (data?.innings !== undefined) {
          setCurrentInnings(Number(data.innings));
        }

        // Set target score
        if (data?.targetScore !== undefined) {
          setTargetScore(Number(data.targetScore));
        }

        // Set prediction control settings
        console.log('[PredictionPanel] Prediction control settings from meta:', {
          predictionsEnabled: data?.predictionsEnabled,
          predictionsPaused: data?.predictionsPaused,
          pauseReason: data?.pauseReason,
          disableReason: data?.disableReason
        });
        if (data?.predictionsEnabled !== undefined) {
          setPredictionsEnabled(data.predictionsEnabled);
        } else {
          // Default to true if not set
          setPredictionsEnabled(true);
        }
        if (data?.predictionsPaused !== undefined) {
          setPredictionsPaused(data.predictionsPaused);
        }
        if (data?.pauseReason) {
          setPauseReason(data.pauseReason);
        }
        if (data?.disableReason) {
          setDisableReason(data.disableReason);
        }
        if (data?.allowReprediction !== undefined) {
          setAllowReprediction(data.allowReprediction);
        }
      } catch (error) {
        console.error('[PredictionPanel] Error loading match meta:', error);
      }
    };
    loadMatchMeta();
    
    // Listen for live score updates to detect innings change and calculate target
    const liveScoreListener = onValue(matchLiveScoreRef(sport, id, matchId), (snap) => {
      const data = snap.val();
      if (data?.currentInnings !== undefined) {
        setCurrentInnings(Number(data.currentInnings));
      }
      
      // Update battingFirst from live score if available (real-time updates)
      if (data?.battingFirst && data.battingFirst !== battingFirst) {
        setBattingFirst(data.battingFirst);
      }
      
      // Calculate target score from first innings
      if (data && battingFirst) {
        const firstBattingScore = battingFirst === 'teamA' ? data.scoreA : data.scoreB;
        if (firstBattingScore) {
          // Extract runs from score format (e.g., "208/6" -> 208)
          const runs = parseInt(firstBattingScore.split('/')[0]);
          if (!isNaN(runs)) {
            setTargetScore(runs + 1);
          }
        }
      }
    });
    
    return () => liveScoreListener();
  }, [sport, id, matchId, battingFirst, setBattingFirst]);

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

  // Check if user has already predicted and load previous prediction
  useEffect(() => {
    if (!matchId || !name) return;
    const checkPrediction = async () => {
      try {
        const predictionsRef = matchPredictionsRef(sport, id, matchId);
        const snap = await get(predictionsRef);
        const predictionsData = snap.val();
        if (predictionsData && predictionsData[name]) {
          setHasPredicted(true);
          // Get prediction based on current innings
          const userData = predictionsData[name];
          if (currentInnings === 2 && userData.second_inn) {
            setPreviousPrediction(userData.second_inn);
          } else if (currentInnings === 1 && userData.first_inn) {
            setPreviousPrediction(userData.first_inn);
          } else if (userData.early_predict?.first) {
            setPreviousPrediction(userData.early_predict.first);
          }
        }
      } catch (error) {
        console.error('[PredictionPanel] Error checking prediction:', error);
      }
    };
    checkPrediction();
  }, [sport, id, matchId, name, currentInnings]);

  const handlePredictionSubmit = async (e: FormEvent, formData: any) => {
    e.preventDefault();
    if (clientId && name.trim()) {
      setLoading(true);
      try {
        console.log('[PredictionPanel] Submitting prediction:', { name, formData, matchStatus, currentInnings });
        
        // 1. Save global profile (to remember name for chat/other matches)
        await saveUserGlobalProfile(clientId, { username: name });

        // 2. Check for existing penalties and include them
        let existingPenalties: any[] = [];
        try {
          const predictionsRef = matchPredictionsRef(sport, id, matchId);
          const snap = await get(predictionsRef);
          const predictionsData = snap.val();
          if (predictionsData && predictionsData[name] && predictionsData[name].penalties) {
            existingPenalties = predictionsData[name].penalties;
          }
        } catch (error) {
          console.error('[PredictionPanel] Error fetching existing penalties:', error);
        }

        // 3. Save prediction for this specific match
        const predictionData: any = {
          userId: clientId,
          name: name,
          sportType: sport,
          currentInnings: currentInnings,
          existingPenalties: existingPenalties
        };

        // Handle different prediction types based on form data
        if (formData.runsOrOvers) {
          // Second innings prediction (has runsOrOvers field)
          predictionData.predictionType = 'live_second_innings';
          predictionData.battingFirst = battingFirst;
          predictionData.winnerTeam = formData.winnerTeam;
          predictionData.runsOrOvers = formData.runsOrOvers;
        } else if (matchStatus === 'scheduled') {
          // Early first innings prediction
          predictionData.predictionType = 'early_first_innings';
          predictionData.winnerTeam = formData.winnerTeam;
          predictionData.runs = formData.runs;
        } else if (matchStatus === 'live' && battingFirst) {
          // Live first innings prediction
          predictionData.predictionType = 'live_first_innings';
          predictionData.battingFirst = battingFirst;
          predictionData.winnerTeam = formData.winnerTeam;
          predictionData.runs = formData.runs;
        } else {
          // Football or other sports
          predictionData.winnerTeam = formData.winnerTeam;
          predictionData.scoreA = formData.scoreA;
          predictionData.scoreB = formData.scoreB;
        }

        await savePrediction(sport, id, clientId, predictionData, matchId);
        
        setHasPredicted(true);
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => setShowOtherPredictionsModal(true)}
            className="link-btn"
            style={{ fontSize: '0.85rem', padding: '6px 12px' }}
          >
            📊 Other Predictions
          </button>
          <button
            onClick={() => setShowLeaderboardModal(true)}
            className="link-btn"
            style={{ fontSize: '0.85rem', padding: '6px 12px' }}
          >
            🏆 Tournament Leaderboard
          </button>
          <span className={`status-pill ${matchStatus === 'live' ? 'status-live' : matchStatus === 'done' || matchStatus === 'completed' ? 'status-done' : 'status-scheduled'}`}>
            {matchStatus === 'live' ? 'Live' : matchStatus === 'done' || matchStatus === 'completed' ? 'Completed' : 'Scheduled'}
          </span>
        </div>
      </div>

      {sport === 'cricket' && (
        <CricketPrediction
          teamA={teamA}
          teamB={teamB}
          name={name}
          matchStatus={matchStatus}
          battingFirst={battingFirst}
          currentInnings={currentInnings}
          isMatchCompleted={isMatchCompleted}
          predictionsEnabled={predictionsEnabled}
          predictionsPaused={predictionsPaused}
          pauseReason={pauseReason}
          disableReason={disableReason}
          targetScore={targetScore}
          allowReprediction={allowReprediction}
          hasPredicted={hasPredicted}
          previousPrediction={previousPrediction}
          sport={sport}
          id={id}
          matchId={matchId}
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
          isMatchCompleted={isMatchCompleted}
          predictionsEnabled={predictionsEnabled}
          predictionsPaused={predictionsPaused}
          pauseReason={pauseReason}
          disableReason={disableReason}
          onNameChange={setName}
          onSubmit={handlePredictionSubmit}
          loading={loading}
        />
      )}

      {/* Modals */}
      {showLeaderboardModal && (
        <TournamentLeaderboardModal
          sport={sport}
          tournamentId={id}
          onClose={() => setShowLeaderboardModal(false)}
        />
      )}

      {showOtherPredictionsModal && matchId && (
        <OtherPredictionsModal
          sport={sport}
          tournamentId={id}
          matchId={matchId}
          onClose={() => setShowOtherPredictionsModal(false)}
        />
      )}
    </section>
  );
}
