import { useState, useEffect } from 'react';
import { onValue, get } from 'firebase/database';
import { matchDiscoveryRef, metaRef, matchMetaRef, userRef, saveUserGlobalProfile, rotatePasskey } from './firebase/services';
import AudienceGate from './components/Gate/AudienceGate';
import ChatPanel from './components/Chat/ChatPanel';
import PredictionPanel from './components/Prediction/PredictionPanel';
import FavoriteTeamModal from './components/TeamSelection/FavoriteTeamModal';
import UserAuth from './components/Auth/UserAuth';
import { getTeamLogoUrl, getTeamColor } from './utils/teamLogos';
import './styles/App.css';

function App() {
  const [matchCode, setMatchCode] = useState<string | null>(null);
  const [tournamentContext, setTournamentContext] = useState<{sport: string, id: string, matchId: string} | null>(null);
  const [meta, setMeta] = useState<any>(null);
  const [favoriteTeam, setFavoriteTeam] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [matchStatus, setMatchStatus] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isAuthed, setIsAuthed] = useState(false);
  const [passkey, setPasskey] = useState<string | null>(null);
  const [showPasskey, setShowPasskey] = useState(false);
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

  // Load match code from localStorage on mount
  useEffect(() => {
    const storedMatchCode = localStorage.getItem('ovr_match_code');
    if (storedMatchCode) {
      console.log('[App] Found match code in localStorage:', storedMatchCode);
      setMatchCode(storedMatchCode);
    }
  }, []);

  // Save match code to localStorage when it changes
  useEffect(() => {
    if (matchCode) {
      localStorage.setItem('ovr_match_code', matchCode);
    } else {
      localStorage.removeItem('ovr_match_code');
    }
  }, [matchCode]);

  // Load user profile (username, passkey, and favorite team) from Firebase
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

  // Save favorite team to Firebase
  const handleSelectFavoriteTeam = async (team: string) => {
    console.log('[App] Saving favorite team:', team);
    try {
      await saveUserGlobalProfile(clientId, { favoriteTeam: team });
      setFavoriteTeam(team);
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
        setMatchCode(null);
      }
      setLoading(false);
    }, (error) => {
      console.error('[App] Error fetching discovery for match:', matchCode, error);
      setLoading(false);
    });
    return () => unsub();
  }, [matchCode]);

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
          // Only block if match is done, allow live and scheduled matches
          if (matchMeta.status === 'done') {
            alert('This match has ended. You cannot join completed matches.');
            setMatchCode(null);
            setTournamentContext(null);
          }
        } else {
          // If no status set, assume it's live (backward compatibility)
          setMatchStatus('live');
        }
      } catch (error) {
        console.error('[App] Error fetching match status:', error);
        // If error fetching, allow entry (backward compatibility)
        setMatchStatus('live');
      }
    };
    
    checkMatchStatus();
  }, [tournamentContext]);

  // 3. Subscribe to Tournament Meta
  useEffect(() => {
    if (!tournamentContext) return;
    const { sport, id } = tournamentContext;
    const unsubMatch = onValue(metaRef(sport, id), (snap) => {
      setMeta(snap.val());
    }, (error) => {
      console.error('[App] Error fetching tournament meta:', { sport, id }, error);
    });
    return () => unsubMatch();
  }, [tournamentContext]);

  if (!matchCode) {
    return <AudienceGate 
      onJoinMatch={(code) => setMatchCode(code)}
      onJoinTournament={(code) => {
        // For tournament, we'll need to implement tournament browsing
        // For now, treat it as a match code for backward compatibility
        setMatchCode(code);
      }}
    />;
  }

  if (loading || !tournamentContext) {
    return <main className="page"><div className="panel"><p>Connecting to {matchCode.toUpperCase()}...</p></div></main>;
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
        <FavoriteTeamModal onSelectTeam={handleSelectFavoriteTeam} />
      )}
      
      <div id="audienceApp" className="audience-app-container">
        <section className="hero audience-hero audience-hero-compact">
          <div className="hero-meta">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
               <span className="badge-mini" style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 800 }}>
                 {tournamentContext.sport.toUpperCase()}
               </span>
               <span>Room: <strong id="roomBadge">{matchCode}</strong></span>
            </div>
            <span id="matchBadge">{activeMatch ? `Active: ${activeMatch}` : 'Waiting for host...'}</span>
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
                <button onClick={() => setFavoriteTeam(null)} className="ghost-link-xs">
                  Change
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
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
