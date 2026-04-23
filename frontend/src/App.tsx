import { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams, Outlet } from 'react-router-dom';
import { onValue, get, set } from 'firebase/database';
import { matchDiscoveryRef, matchMetaRef, matchLiveScoreRef, userRef, usernameDataRef, saveUserGlobalProfile, rotatePasskey, setFirebaseMode, verifyUserPasskey, generatePasskey, ensureUsernameDataExists } from './firebase/services';
import AudienceGate from './components/Gate/AudienceGate';
import AppHeader from './components/Layout/AppHeader';
import TournamentBrowser from './components/Tournament/TournamentBrowser';
import ChatPanel from './components/Chat/ChatPanel';
import PredictionPanel from './components/Prediction/PredictionPanel';
import FavoriteTeamModal from './components/TeamSelection/FavoriteTeamModal';
import UserAuth from './components/Auth/UserAuth';
import { getTeamLogoUrl, getTeamColor } from './utils/teamLogos';
import './styles/App.css';

// Context for shared app state
interface AppContextType {
  username: string | null;
  isAuthed: boolean;
  passkey: string | null;
  favoriteTeam: string | null;
  teamChangeCount: number;
  clientId: string;
  firebaseMode: 'local' | 'prod';
  handleAuthSuccess: (username: string, clientId: string) => void;
  handleRotatePasskey: () => Promise<void>;
  handleSelectFavoriteTeam: (team: string) => Promise<void>;
  handleToggleFirebaseMode: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

function useAppContext() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppLayout');
  return context;
}

// Layout component with persistent footer
function AppLayout() {
  const [username, setUsername] = useState<string | null>(null);
  const [isAuthed, setIsAuthed] = useState(false);
  const [passkey, setPasskey] = useState<string | null>(null);
  const [favoriteTeam, setFavoriteTeam] = useState<string | null>(null);
  const [teamChangeCount, setTeamChangeCount] = useState(0);
  const [showPasskey, setShowPasskey] = useState(false);
  const [forceShowAuth, setForceShowAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [passkeyCopied, setPasskeyCopied] = useState(false);
  const [firebaseMode, setFirebaseModeState] = useState<'local' | 'prod'>(() => {
    return (localStorage.getItem('firebase_mode') as 'local' | 'prod') || 'local';
  });
  const [clientId] = useState(() => {
    const existing = localStorage.getItem('ovr_client_id');
    if (existing) return existing;
    const next = 'c-' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('ovr_client_id', next);
    return next;
  });

  // Check for login URL parameter (for QR code login)
  useEffect(() => {
    const checkLoginParam = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const loginParam = urlParams.get('login');

      if (loginParam) {
        const [username, passkey] = loginParam.split(':');
        if (username && passkey) {
          console.log('[App] Found login parameter, attempting auto-login for:', username);
          try {
            const result = await verifyUserPasskey(username, passkey);
            if (result.valid) {
              console.log('[App] Auto-login successful for:', username);

              // Write to users/{clientId} to trigger Firebase listener
              await set(userRef(clientId), {
                username: username,
              });

              // Clear URL param
              window.history.replaceState({}, '', window.location.pathname);
            }
          } catch (error) {
            console.error('[App] Auto-login error:', error);
          }
        }
      }
    };

    checkLoginParam();
  }, [clientId]);

  // Load user profile from Firebase
  useEffect(() => {
    console.log('[App] Loading user profile for client:', clientId);

    // First, get username from users/{clientId}
    const userUnsub = onValue(userRef(clientId), (snap) => {
      const userData = snap.val();
      console.log('[App] User data from users node:', userData);

      if (userData?.username) {
        setUsername(userData.username);
        setIsAuthed(true);

        // Ensure username/{username} node exists
        ensureUsernameDataExists(userData.username, clientId)
          .then(() => {
            console.log('[App] Username data ensured');
          })
          .catch((error) => {
            console.error('[App] Error ensuring username data:', error);
          });

        // Then listen to username/{username} for actual user data
        const usernameUnsub = onValue(usernameDataRef(userData.username), (usernameSnap) => {
          const data = usernameSnap.val();
          console.log('[App] User profile data from username node:', data);

          if (data?.passkey) {
            setPasskey(data.passkey);
            console.log('[App] Passkey set:', data.passkey);
          } else if (userData.username) {
            // User exists but no passkey - generate one
            console.log('[App] No passkey found, generating new one');
            const newPasskey = generatePasskey();
            saveUserGlobalProfile(userData.username, { passkey: newPasskey })
              .then(() => {
                setPasskey(newPasskey);
                console.log('[App] New passkey generated and saved:', newPasskey);
              })
              .catch((error) => {
                console.error('[App] Error saving new passkey:', error);
              });
          }

          if (data?.favoriteTeam) {
            setFavoriteTeam(data.favoriteTeam);
          }
          if (data?.teamChangeCount !== undefined) {
            setTeamChangeCount(data.teamChangeCount);
          }
          setLoading(false);
        }, (error) => {
          console.error('[App] Error fetching username data:', error);
          setLoading(false);
        });

        return () => usernameUnsub();
      } else {
        // No username found - user not logged in
        setLoading(false);
      }
    }, (error) => {
      console.error('[App] Error fetching user data:', error);
      setLoading(false);
    });

    return () => userUnsub();
  }, [clientId]);

  const handleAuthSuccess = async (authUsername: string, authClientId: string) => {
    console.log('[App] Auth successful:', { authUsername, authClientId });

    // Update users/{clientId} with username reference
    await set(userRef(clientId), {
      username: authUsername,
    });

    // Firebase will handle the rest via onValue listener
  };

  const handleRotatePasskey = async () => {
    if (!username || !clientId) return;
    try {
      const newPasskey = await rotatePasskey(username, clientId);
      setPasskey(newPasskey);
      setShowPasskey(true);
      alert('New passkey generated! Save it for login on other devices.');
    } catch (error) {
      console.error('[App] Error rotating passkey:', error);
      alert('Error generating new passkey. Please try again.');
    }
  };

  const handleToggleFirebaseMode = () => {
    const newMode = firebaseMode === 'local' ? 'prod' : 'local';
    setFirebaseMode(newMode);
    setFirebaseModeState(newMode);
    alert(`Switched to ${newMode.toUpperCase()} mode. Reloading...`);
    window.location.reload();
  };

  const handleSelectFavoriteTeam = async (team: string) => {
    if (teamChangeCount >= 3) {
      alert('You have reached the maximum limit of 3 favorite team changes.');
      return;
    }

    if (!username) {
      console.error('[App] Cannot save favorite team: username is null');
      return;
    }

    try {
      const newCount = favoriteTeam ? teamChangeCount + 1 : teamChangeCount;
      await saveUserGlobalProfile(username, {
        favoriteTeam: team,
        teamChangeCount: newCount
      });
      // Firebase will update via onValue listener
    } catch (error) {
      console.error('[App] Error saving favorite team:', error);
    }
  };

  const contextValue: AppContextType = {
    username,
    isAuthed,
    passkey,
    favoriteTeam,
    teamChangeCount,
    clientId,
    firebaseMode,
    handleAuthSuccess,
    handleRotatePasskey,
    handleSelectFavoriteTeam,
    handleToggleFirebaseMode,
  };

  // Listen for login trigger event from header
  useEffect(() => {
    const handleTriggerLogin = () => {
      setForceShowAuth(true);
      // Scroll to top to show auth modal
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('trigger-login', handleTriggerLogin);
    return () => window.removeEventListener('trigger-login', handleTriggerLogin);
  }, []);

  console.log('[AppLayout] Rendering with state', { username, isAuthed, passkey, loading });
  
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <h2>Loading OverlayChat</h2>
          <p>Connecting to server...</p>
        </div>
      </div>
    );
  }
  
  return (
    <AppContext.Provider value={contextValue}>
      <div className="app-layout">
        <AppHeader
          username={username}
          isAuthed={isAuthed}
          passkey={passkey}
          favoriteTeam={favoriteTeam}
          teamChangeCount={teamChangeCount}
          onRotatePasskey={handleRotatePasskey}
          onSelectFavoriteTeam={handleSelectFavoriteTeam}
        />
        <div className="app-header-spacer" />
        <Outlet />
        
        {(!isAuthed || forceShowAuth) && (
          <UserAuth clientId={clientId} onAuthSuccess={(username, clientId) => {
            setForceShowAuth(false);
            handleAuthSuccess(username, clientId);
          }} />
        )}
        
        {!loading && isAuthed && !favoriteTeam && (
          <FavoriteTeamModal onSelectTeam={handleSelectFavoriteTeam} teamChangeCount={teamChangeCount} />
        )}

        {isAuthed && passkey && (
          <div className="passkey-footer">
            <div className="passkey-footer-content">
              <span className="passkey-footer-label">Your Passkey:</span>
              <div
                className="passkey-footer-value"
                onClick={async () => {
                  if (showPasskey && passkey) {
                    try {
                      await navigator.clipboard.writeText(passkey);
                      setPasskeyCopied(true);
                      setTimeout(() => setPasskeyCopied(false), 2000);
                    } catch (error) {
                      console.error('Failed to copy passkey:', error);
                    }
                  }
                }}
                style={{ cursor: showPasskey ? 'pointer' : 'default' }}
                title={showPasskey ? 'Click to copy' : ''}
              >
                {passkeyCopied ? '✓ Copied!' : (showPasskey ? (passkey.length > 4 ? `${passkey.slice(0, 4)}-${passkey.slice(4)}` : passkey) : '••••-••••')}
              </div>
              <button 
                className="passkey-toggle-btn"
                onClick={() => setShowPasskey(!showPasskey)}
                title={showPasskey ? 'Hide passkey' : 'Show passkey'}
              >
                {showPasskey ? '👁️' : '👁️‍🗨️'}
              </button>
              <button
                className="passkey-rotate-btn"
                onClick={handleRotatePasskey}
                title="Generate new passkey"
              >
                🔄
              </button>
              <button
                className="firebase-mode-btn"
                onClick={handleToggleFirebaseMode}
                title={`Switch to ${firebaseMode === 'local' ? 'PROD' : 'LOCAL'} mode`}
                style={{
                  background: firebaseMode === 'prod' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                  color: firebaseMode === 'prod' ? '#ef4444' : '#10b981',
                }}
              >
                {firebaseMode.toUpperCase()}
              </button>
            </div>
          </div>
        )}
      </div>
    </AppContext.Provider>
  );
}

// Home page
function HomePage() {
  const navigate = useNavigate();
  return (
    <main className="page">
      <AudienceGate 
        onJoinMatch={(code) => navigate(`/match/${code}`)}
        onJoinTournament={(code) => navigate(`/tournament/${code}`)}
      />
    </main>
  );
}

// Tournament page
function TournamentPage() {
  const { tournamentCode } = useParams();
  const navigate = useNavigate();
  
  if (!tournamentCode) return null;
  
  return (
    <main className="page">
      <TournamentBrowser 
        tournamentCode={tournamentCode}
        onJoinMatch={(matchId) => navigate(`/match/${matchId}`)}
        onBack={() => navigate('/')}
      />
    </main>
  );
}

// Match page
function MatchPage() {
  const { matchCode } = useParams();
  const navigate = useNavigate();
  const { 
    clientId, 
    favoriteTeam
  } = useAppContext();
  
  const [tournamentContext, setTournamentContext] = useState<{ sport: string; id: string; matchId: string } | null>(null);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [matchStatus, setMatchStatus] = useState<string | null>(null);
  const [liveScore, setLiveScore] = useState<any>(null);

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
      console.error('[App] Error fetching discovery for match:', matchCode, error);
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
        if (matchMeta && matchMeta.status) {
          setMatchStatus(matchMeta.status);
          if (matchMeta.status === 'done') {
            alert('This match has ended. You cannot join completed matches.');
            navigate('/');
            setTournamentContext(null);
          }
        } else {
          setMatchStatus('live');
        }
      } catch (error) {
        setMatchStatus('live');
      }
    };
    
    checkMatchStatus();
  }, [tournamentContext, navigate]);

  // Subscribe to Match Meta
  useEffect(() => {
    if (!tournamentContext) return;
    const { sport, id, matchId } = tournamentContext;
    const unsubMatch = onValue(matchMetaRef(sport, id, matchId), (snap) => {
      setMeta(snap.val());
    }, (error) => {
      console.error('[App] Error fetching match meta:', { sport, id, matchId }, error);
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
      console.error('[App] Error fetching live score:', { sport, id, matchId }, error);
    });
    return () => unsubScore();
  }, [tournamentContext]);

  if (loading || !tournamentContext) {
    return <main className="page"><div className="panel"><p>Connecting to {matchCode?.toUpperCase() || 'match'}...</p></div></main>;
  }

  const handleCopyMatchCode = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      alert('Match link copied to clipboard!');
    }).catch(() => {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Match link copied to clipboard!');
    });
  };

  const activeMatch = meta?.matchTitle;
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
        <header className="audience-header audience-header-merged">
          <div className="audience-header-left">
            <button onClick={() => navigate('/')} className="back-btn" title="Return to home">
              ← Back
            </button>
            <div className="audience-header-title">
              <span className="audience-header-kicker">Live Match</span>
              <span className="audience-header-code">{matchCode?.toUpperCase() || ''}</span>
            </div>
          </div>
          <div className="audience-header-right">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
               <span className="badge-mini sport">
                 {tournamentContext.sport.toUpperCase()}
               </span>
               <span style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }} onClick={handleCopyMatchCode}>
                 <strong id="roomBadge">{matchCode}</strong>
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.6 }}>
                   <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                   <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                 </svg>
               </span>
               {matchStatus && (
                 <span className={`badge-mini ${matchStatus}`}>
                   {matchStatus.toUpperCase()}
                 </span>
               )}
            </div>
            {meta?.teamA && meta?.teamB ? (
              <div className="match-teams-display match-teams-display-compact">
                <div className="match-team">
                  {getTeamLogoUrl(meta.teamA) && (
                    <img src={getTeamLogoUrl(meta.teamA)!} alt={meta.teamA} className="match-team-logo" />
                  )}
                  <div className="match-team-info">
                    <span>{meta.teamA}</span>
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
                    <span>{meta.teamB}</span>
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
            <button 
              onClick={() => {
                const url = `${window.location.origin}/match/${matchCode}`;
                navigator.clipboard.writeText(url).then(() => {
                  alert('Link copied to clipboard!');
                });
              }}
              className="share-btn"
              title="Copy link"
            >
              🔗
            </button>
          </div>
        </header>

        <div className="grid-two">
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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/match/:matchCode" element={<MatchPage />} />
          <Route path="/tournament/:tournamentCode" element={<TournamentPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
