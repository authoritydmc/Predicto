import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { onValue, get } from 'firebase/database';
import QRCode from 'qrcode';
import { matchDiscoveryRef, matchMetaRef, matchLiveScoreRef } from '../../firebase/services';
import PredictionPanel from '../Prediction/PredictionPanel';
import ChatPanel from '../Chat/ChatPanel';
import { useAppContext } from '../../context/AppContext';
import { getTeamLogoUrl, getTeamColor } from '../../utils/teamLogos';

export default function MatchPage() {
  const { matchCode } = useParams();
  const navigate = useNavigate();
  const { clientId, favoriteTeam } = useAppContext();

  const [tournamentContext, setTournamentContext] = useState<{ sport: string; id: string; matchId: string } | null>(null);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [matchStatus, setMatchStatus] = useState<string | null>(null);
  const [liveScore, setLiveScore] = useState<any>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Resolve Tournament Context from Match Code
  useEffect(() => {
    if (!matchCode) return;
    setLoading(true);
    const unsub = onValue(matchDiscoveryRef(matchCode), (snap) => {
      const data = snap.val();
      if (data && data.sport && data.tournamentId) {
        setTournamentContext({ sport: data.sport, id: data.tournamentId, matchId: matchCode });
      } else {
        alert('Match not found or not active. Check the code.');
        navigate('/');
      }
      setLoading(false);
    }, (error) => {
      console.error('[MatchPage] Error fetching discovery:', error);
      setLoading(false);
    });
    return () => unsub();
  }, [matchCode, navigate]);

  // Check match status
  useEffect(() => {
    if (!tournamentContext) return;
    const { sport, id, matchId } = tournamentContext;
    const checkMatchStatus = async () => {
      try {
        const matchMetaSnap = await get(matchMetaRef(sport, id, matchId));
        const matchMeta = matchMetaSnap.val();
        setMatchStatus(matchMeta?.status || 'live');
      } catch {
        setMatchStatus('live');
      }
    };
    checkMatchStatus();
  }, [tournamentContext]);

  // Subscribe to Match Meta
  useEffect(() => {
    if (!tournamentContext) return;
    const { sport, id, matchId } = tournamentContext;
    const unsubMatch = onValue(matchMetaRef(sport, id, matchId), (snap) => {
      setMeta(snap.val());
    }, (error) => {
      console.error('[MatchPage] Error fetching match meta:', error);
    });
    return () => unsubMatch();
  }, [tournamentContext]);

  // Subscribe to Live Score
  useEffect(() => {
    if (!tournamentContext) return;
    const { sport, id, matchId } = tournamentContext;
    const unsubScore = onValue(matchLiveScoreRef(sport, id, matchId), (snap) => {
      setLiveScore(snap.val());
    }, (error) => {
      console.error('[MatchPage] Error fetching live score:', error);
    });
    return () => unsubScore();
  }, [tournamentContext]);

  const handleCopyLink = () => {
    const url = `${window.location.origin}/match/${matchCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleShowQr = () => {
    const url = `${window.location.origin}/match/${matchCode}`;
    QRCode.toDataURL(url, { width: 280, margin: 2 }).then((dataUrl) => {
      setQrDataUrl(dataUrl);
      setShowQrModal(true);
    });
  };

  const teamColors = favoriteTeam ? getTeamColor(favoriteTeam) : { primary: '#6366f1', secondary: '#8b5cf6' };

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 99, g: 102, b: 241 };
  };

  const primaryRgb = hexToRgb(teamColors.primary);
  const secondaryRgb = hexToRgb(teamColors.secondary);

  if (loading || !tournamentContext) {
    return (
      <main className="page">
        <div className="panel">
          <p>Connecting to {matchCode?.toUpperCase() || 'match'}...</p>
        </div>
      </main>
    );
  }

  const activeMatch = meta?.matchTitle || (meta?.teamA && meta?.teamB);

  return (
    <main
      className="page page-audience"
      style={{
        '--team-primary-r': primaryRgb.r,
        '--team-primary-g': primaryRgb.g,
        '--team-primary-b': primaryRgb.b,
        '--team-secondary-r': secondaryRgb.r,
        '--team-secondary-g': secondaryRgb.g,
        '--team-secondary-b': secondaryRgb.b,
        '--team-primary': teamColors.primary,
        '--team-secondary': teamColors.secondary,
      } as React.CSSProperties}
    >
      <div id="audienceApp" className="audience-app-container">
        <header className="audience-header audience-header-merged match-shell-header">
          <div className="audience-header-left">
            <button onClick={() => navigate('/')} className="back-btn" title="Return to home">
              ← Back
            </button>
            <div className="audience-header-title">
              <span className="audience-header-kicker">Live Match</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  className="audience-header-code"
                  onClick={handleCopyLink}
                  style={{ cursor: 'pointer', position: 'relative' }}
                  title="Click to copy link"
                >
                  {matchCode?.toUpperCase() || ''}
                  {copied && (
                    <span style={{
                      position: 'absolute',
                      top: '-24px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: '#10b981',
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      whiteSpace: 'nowrap',
                      zIndex: 10
                    }}>
                      Copied!
                    </span>
                  )}
                </span>
                <button
                  onClick={handleShowQr}
                  className="share-btn"
                  title="Show QR Code"
                  style={{ width: '28px', height: '28px', padding: '4px' }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <rect x="3" y="3" width="7" height="7" rx="1"/>
                    <rect x="14" y="3" width="7" height="7" rx="1"/>
                    <rect x="14" y="14" width="7" height="7" rx="1"/>
                    <rect x="3" y="14" width="7" height="7" rx="1"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <div className="audience-header-right">
            <div className="match-badge-row">
              <span className="badge-mini sport">
                {tournamentContext.sport.toUpperCase()}
              </span>
              {matchStatus && (
                <span className={`badge-mini ${matchStatus}`}>
                  {matchStatus.toUpperCase()}
                </span>
              )}
            </div>
            {(meta?.series || meta?.venue) && (
              <div className="match-badge-row" style={{ marginTop: '4px', opacity: 0.8, fontSize: '0.7rem' }}>
                {meta.series && <span style={{ marginRight: '8px' }}>🏆 {meta.series}</span>}
                {meta.venue && <span>📍 {meta.venue}</span>}
              </div>
            )}
            {meta?.teamA && meta?.teamB ? (
              <div className="match-teams-display match-teams-display-compact">
                <div className="match-team">
                  {getTeamLogoUrl(meta.teamA) && (
                    <img src={getTeamLogoUrl(meta.teamA)!} alt={meta.teamA} className="match-team-logo" />
                  )}
                  <div className="match-team-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>{meta.teamA}</span>
                      {tournamentContext.sport === 'cricket' && liveScore?.teamA?.battingTeam && (
                        <span style={{ fontSize: '12px' }}>🏏</span>
                      )}
                      {meta.tossWinner === 'teamA' && (
                        <span style={{ fontSize: '12px' }}>🪙</span>
                      )}
                    </div>
                    {liveScore?.teamA && (
                      <span className="match-team-score">
                        {tournamentContext.sport === 'cricket'
                          ? `${liveScore.teamA.runs}/${liveScore.teamA.wickets} (${liveScore.teamA.overs})`
                          : liveScore.teamA.goals
                        }
                      </span>
                    )}
                  </div>
                </div>
                <span className="vs-divider">vs</span>
                <div className="match-team">
                  {getTeamLogoUrl(meta.teamB) && (
                    <img src={getTeamLogoUrl(meta.teamB)!} alt={meta.teamB} className="match-team-logo" />
                  )}
                  <div className="match-team-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>{meta.teamB}</span>
                      {tournamentContext.sport === 'cricket' && liveScore?.teamB?.battingTeam && (
                        <span style={{ fontSize: '12px' }}>🏏</span>
                      )}
                      {meta.tossWinner === 'teamB' && (
                        <span style={{ fontSize: '12px' }}>🪙</span>
                      )}
                    </div>
                    {liveScore?.teamB && (
                      <span className="match-team-score">
                        {tournamentContext.sport === 'cricket'
                          ? `${liveScore.teamB.runs}/${liveScore.teamB.wickets} (${liveScore.teamB.overs})`
                          : liveScore.teamB.goals
                        }
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <span id="matchBadge">{activeMatch ? `Active: ${activeMatch}` : 'Waiting for host...'}</span>
            )}

            {tournamentContext.sport === 'cricket' && meta?.teamA && meta?.teamB && (
              <div className="match-cricket-context">
                {meta.secondInnings && liveScore?.teamA && liveScore?.teamB && (
                  <>
                    <div className="match-cricket-note">
                      <span style={{ color: '#34c759' }}>🎯</span>
                      <span>
                        {meta.summary || (() => {
                          const firstBattingTeam = meta.battingFirst || (meta.disableScoreA === false && meta.disableScoreB === true ? 'teamA' : 'teamB');
                          const chasingTeam = firstBattingTeam === 'teamA' ? 'teamB' : 'teamA';
                          const firstBattingScore = firstBattingTeam === 'teamA' ? liveScore.teamA.runs : liveScore.teamB.runs;
                          const chasingScore = chasingTeam === 'teamA' ? liveScore.teamA.runs : liveScore.teamB.runs;
                          const chasingOvers = chasingTeam === 'teamA' ? liveScore.teamA.overs : liveScore.teamB.overs;
                          
                          const chasingTeamName = chasingTeam === 'teamA' ? meta.teamA : meta.teamB;

                          if (matchStatus === 'completed' || matchStatus === 'done') {
                            return "Match Completed";
                          }

                          const target = firstBattingScore + 1;
                          const runsNeeded = target - chasingScore;
                          
                          // Better ball calculation
                          const totalBalls = 120; // Assuming T20
                          const oversFloat = parseFloat(chasingOvers) || 0;
                          const ballsBowled = Math.floor(oversFloat) * 6 + Math.round((oversFloat * 10) % 10);
                          const ballsRemaining = Math.max(0, totalBalls - ballsBowled);
                          const oversRemainingStr = `${Math.floor(ballsRemaining / 6)}.${ballsRemaining % 6}`;

                          if (runsNeeded > 0) {
                            return `${chasingTeamName} needs ${runsNeeded} runs in ${ballsRemaining} balls (${oversRemainingStr} overs) to win`;
                          } else {
                            return `${chasingTeamName} won the match`;
                          }
                        })()}
                      </span>
                    </div>
                    {liveScore.secondInningsStart && (
                      <div className="match-cricket-note">
                        <span style={{ color: '#007aff' }}>⏱️</span>
                        <span>
                          Chasing started: {new Date(liveScore.secondInningsStart).toLocaleTimeString()}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </header>

        {showQrModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}
            onClick={() => setShowQrModal(false)}
          >
            <div
              style={{
                background: '#1a1a2e',
                padding: '24px',
                borderRadius: '16px',
                textAlign: 'center',
                maxWidth: '320px'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ marginBottom: '16px', color: '#fff' }}>Scan to Join Match</h3>
              {qrDataUrl && (
                <img src={qrDataUrl} alt="QR Code" style={{ borderRadius: '8px', maxWidth: '100%' }} />
              )}
              <p style={{ marginTop: '16px', color: '#888', fontSize: '0.875rem' }}>
                {matchCode?.toUpperCase()}
              </p>
              <button
                onClick={() => setShowQrModal(false)}
                style={{
                  marginTop: '16px',
                  padding: '8px 24px',
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}

        <div className="match-content-grid grid-two">
          {activeMatch ? (
            <>
              <PredictionPanel
                sport={tournamentContext.sport}
                id={tournamentContext.id}
                matchId={tournamentContext.matchId}
                clientId={clientId}
              />
              <ChatPanel
                sport={tournamentContext.sport}
                id={tournamentContext.id}
                matchId={tournamentContext.matchId}
                clientId={clientId}
              />
            </>
          ) : (
            <div className="panel"><p>Match setup in progress. Please wait...</p></div>
          )}
        </div>
      </div>
    </main>
  );
}
