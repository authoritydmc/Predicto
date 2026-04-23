import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { onValue, get } from 'firebase/database';
import { matchDiscoveryRef, matchMetaRef, userRef, saveUserGlobalProfile, rotatePasskey, setFirebaseMode } from './firebase/services';
import AudienceGate from './components/Gate/AudienceGate';
import TournamentBrowser from './components/Tournament/TournamentBrowser';
import ChatPanel from './components/Chat/ChatPanel';
import PredictionPanel from './components/Prediction/PredictionPanel';
import FavoriteTeamModal from './components/TeamSelection/FavoriteTeamModal';
import UserAuth from './components/Auth/UserAuth';
import { getTeamLogoUrl, getTeamColor } from './utils/teamLogos';
import './styles/App.css';

function AppContent() {
  const navigate = useNavigate();
  const params = useParams();
  
  const matchCode = params.matchCode || null;
  const tournamentCode = params.tournamentCode || null;
  
  const [tournamentContext, setTournamentContext] = useState<{ sport: string; id: string; matchId: string } | null>(null);
  const [meta, setMeta] = useState<any>(null);
  const [favoriteTeam, setFavoriteTeam] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [matchStatus, setMatchStatus] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isAuthed, setIsAuthed] = useState(false);
  const [passkey, setPasskey] = useState<string | null>(null);
  const [showPasskey, setShowPasskey] = useState(false);
  const [teamChangeCount, setTeamChangeCount] = useState(0);
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

  // Load auth state from localStorage on mount
  useEffect(() => {
    const storedUsername = localStorage.getItem('ovr_username');
    const storedIsAuthed = localStorage.getItem('ovr_is_authed');
    if (storedUsername && storedIsAuthed === 'true') {
      console.log('[App] Found auth state in localStorage:', storedUsername);
      setUsername(storedUsername);
      setIsAuthed(true);
    }
  }, []);

  // Load user profile (username, passkey, favorite team, and change count) from Firebase
  useEffect(() => {
    console.log('[App] Loading user profile for client:', clientId);
    const unsub = onValue(userRef(clientId), (snap) => {
      const data = snap.val();
      console.log('[App] User profile data:', data);
      if (data?.username) {
        console.log('[App] Found username:', data.username);
        setUsername(data.username);
        setIsAuthed(true);
      }
      if (data?.passkey) {
        console.log('[App] Found passkey');
        setPasskey(data.passkey);
      }
      if (data?.favoriteTeam) {
        console.log('[App] Found favorite team:', data.favoriteTeam);
        setFavoriteTeam(data.favoriteTeam);
      }
      if (data?.teamChangeCount !== undefined) {
        console.log('[App] Found team change count:', data.teamChangeCount);
        setTeamChangeCount(data.teamChangeCount);
      }
    }, (error) => {
      console.error('[App] Error fetching user profile:', error);
    });
    return () => unsub();
  }, [clientId]);

  const handleAuthSuccess = (authUsername: string, authClientId: string) => {
    console.log('[App] Auth successful:', { authUsername, authClientId });
    setUsername(authUsername);
    setIsAuthed(true);
    // Save auth state to localStorage
    localStorage.setItem('ovr_username', authUsername);
    localStorage.setItem('ovr_is_authed', 'true');
    localStorage.setItem('ovr_client_id', authClientId);
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

  // Save favorite team to Firebase
  const handleSelectFavoriteTeam = async (team: string) => {
    console.log('[App] Saving favorite team:', team, 'Current count:', teamChangeCount);
    
    // Check if user has reached the limit
    if (teamChangeCount >= 3) {
      alert('You have reached the maximum limit of 3 favorite team changes.');
      return;
    }
    
    try {
      const newCount = favoriteTeam ? teamChangeCount + 1 : 0;
      console.log('[App] New team change count:', newCount);
      
      await saveUserGlobalProfile(clientId, { 
        favoriteTeam: team,
        teamChangeCount: newCount
      });
      setFavoriteTeam(team);
      setTeamChangeCount(newCount);
      console.log('[App] Favorite team saved successfully');
    } catch (error) {
      console.error('[App] Error saving favorite team:', error);
    }
  };

  // 1. Resolve Tournament Context from Match Code
  useEffect(() => {
    if (!matchCode) return;
    setLoading(true);
    const unsub = onValue(matchDiscoveryRef(matchCode), (snap) => {
      const data = snap.val();
      if (data && data.sport && data.tournamentId) {
        setTournamentContext({ sport: data.sport, id: data.tournamentId, matchId: matchCode });
      } else {
        console.error('[App] Match not found or not active for match:', matchCode);
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

  // 2. Check match status
  useEffect(() => {
    if (!tournamentContext) return;
    const { sport, id, matchId } = tournamentContext;
    
    const checkMatchStatus = async () => {
      try {
        const matchMetaSnap = await get(matchMetaRef(sport, id, matchId));
        const matchMeta = matchMetaSnap.val();
        if (matchMeta && matchMeta.status) {
          setMatchStatus(matchMeta.status);
          console.log('[App] Match status:', matchMeta.status);
          // Only block if match is done, allow live and scheduled matches
          if (matchMeta.status === 'done') {
            alert('This match has ended. You cannot join completed matches.');
            navigate('/');
            setTournamentContext(null);
          }
        } else {
          // If no status set, assume it's live (backward compatibility)
          setMatchStatus('live');
          console.log('[App] Match status: live (default)');
        }
      } catch (error) {
        console.error('[App] Error fetching match status:', error);
        // If error fetching, allow entry (backward compatibility)
        setMatchStatus('live');
      }
    };
    
    checkMatchStatus();
  }, [tournamentContext, navigate]);

  // 3. Subscribe to Match Meta (not Tournament Meta)
  useEffect(() => {
    if (!tournamentContext) return;
    const { sport, id, matchId } = tournamentContext;
    console.log('[App] Subscribing to match meta for:', { sport, id, matchId });
    const unsubMatch = onValue(matchMetaRef(sport, id, matchId), (snap) => {
      const data = snap.val();
      console.log('[App] Match meta received:', data);
      setMeta(data);
    }, (error) => {
      console.error('[App] Error fetching match meta:', { sport, id, matchId }, error);
    });
    return () => unsubMatch();
  }, [tournamentContext]);

  if (!matchCode && !tournamentCode) {
    console.log('[App] Rendering AudienceGate');
    return <AudienceGate 
      onJoinMatch={(code) => {
        console.log('[App] onJoinMatch called with:', code);
        navigate(`/match/${code}`);
      }}
      onJoinTournament={(code) => {
        console.log('[App] onJoinTournament called with:', code);
        navigate(`/tournament/${code}`);
      }}
    />;
  }

  // Tournament browsing mode
  if (tournamentCode && !matchCode) {
    console.log('[App] Rendering TournamentBrowser for tournament:', tournamentCode);
    return (
      <main className="page">
        <TournamentBrowser 
          tournamentCode={tournamentCode}
          onJoinMatch={(matchId) => {
            console.log('[App] TournamentBrowser onJoinMatch called with:', matchId);
            navigate(`/match/${matchId}`);
          }}
          onBack={() => {
            console.log('[App] TournamentBrowser onBack called');
            navigate('/');
          }}
        />
      </main>
    );
  }

  if (loading || !tournamentContext) {
    return <main className="page"><div className="panel"><p>Connecting to {matchCode?.toUpperCase() || 'match'}...</p></div></main>;
  }

  const activeMatch = meta?.matchTitle;
  const teamColors = favoriteTeam ? getTeamColor(favoriteTeam) : { primary: '#6366f1', secondary: '#8b5cf6' };

  // Convert hex to RGB for rgba usage
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
      {!isAuthed && (
        <UserAuth clientId={clientId} onAuthSuccess={handleAuthSuccess} />
      )}
      
      {isAuthed && !favoriteTeam && (
        <FavoriteTeamModal onSelectTeam={handleSelectFavoriteTeam} teamChangeCount={teamChangeCount} />
      )}
      
      <div id="audienceApp" className="audience-app-container">
        {/* Header with back button */}
        <header className="audience-header">
          <button 
            onClick={() => navigate('/')}
            className="back-btn"
            title="Return to home"
          >
            ← Back
          </button>
          <div className="audience-header-title">
            <span className="audience-header-kicker">Live Match</span>
            <span className="audience-header-code">{matchCode?.toUpperCase() || ''}</span>
          </div>
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
        </header>

        <section className="hero audience-hero audience-hero-compact">
          <div className="hero-meta">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
               <span className="badge-mini" style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 800 }}>
                 {tournamentContext.sport.toUpperCase()}
               </span>
               <span>Room: <strong id="roomBadge">{matchCode}</strong></span>
               {matchStatus && (
                 <span className="badge-mini" style={{ background: matchStatus === 'live' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)', color: matchStatus === 'live' ? '#10b981' : '#f59e0b', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 800 }}>
                   {matchStatus.toUpperCase()}
                 </span>
               )}
            </div>
            {meta?.teamA && meta?.teamB ? (
              <div className="match-teams-display">
                <div className="match-team">
                  {getTeamLogoUrl(meta.teamA) && (
                    <img src={getTeamLogoUrl(meta.teamA)!} alt={meta.teamA} className="match-team-logo" />
                  )}
                  <span>{meta.teamA}</span>
                </div>
                <span className="vs-divider">vs</span>
                <div className="match-team">
                  {getTeamLogoUrl(meta.teamB) && (
                    <img src={getTeamLogoUrl(meta.teamB)!} alt={meta.teamB} className="match-team-logo" />
                  )}
                  <span>{meta.teamB}</span>
                </div>
              </div>
            ) : (
              <span id="matchBadge">{activeMatch ? `Active: ${activeMatch}` : 'Waiting for host...'}</span>
            )}
          </div>
        </section>

        {favoriteTeam && (
          <section className="panel favorite-team-panel">
            <div className="favorite-team-display">
              {getTeamLogoUrl(favoriteTeam) && (
                <div className="favorite-team-logo-wrapper">
                  <img 
                    src={getTeamLogoUrl(favoriteTeam)!} 
                    alt={favoriteTeam}
                    className="favorite-team-logo"
                  />
                </div>
              )}
              <div className="favorite-team-info">
                <p className="favorite-team-label">Supporting</p>
                <h3 className="favorite-team-name">{favoriteTeam}</h3>
                <button onClick={() => setFavoriteTeam(null)} className="ghost-link-xs" disabled={teamChangeCount >= 3}>
                  Change {teamChangeCount >= 3 ? '(Limit reached)' : `(${3 - teamChangeCount} left)`}
                </button>
              </div>
            </div>
          </section>
        )}

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

      {isAuthed && passkey && (
        <div className="passkey-footer">
          <div className="passkey-footer-content">
            <span className="passkey-footer-label">Your Passkey:</span>
            <div className="passkey-footer-value">
              {showPasskey ? passkey : '••••••'}
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
    </main>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppContent />} />
        <Route path="/match/:matchCode" element={<AppContent />} />
        <Route path="/tournament/:tournamentCode" element={<AppContent />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
