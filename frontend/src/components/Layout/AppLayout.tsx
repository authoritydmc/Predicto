import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { onValue, set } from 'firebase/database';
import { userRef, usernameDataRef, saveUserGlobalProfile, rotatePasskey, setFirebaseMode, verifyUserPasskey, generatePasskey, ensureUsernameDataExists } from '../../firebase/services';
import AppHeader from './AppHeader';
import FavoriteTeamModal from '../TeamSelection/FavoriteTeamModal';
import UserAuth from '../Auth/UserAuth';
import { AppContext } from '../../context/AppContext';
import { FooterVersion } from '../ui/VersionInfo';

export default function AppLayout() {
  const [username, setUsername] = useState<string | null>(null);
  const [isAuthed, setIsAuthed] = useState(false);
  const [passkey, setPasskey] = useState<string | null>(null);
  const [favoriteTeam, setFavoriteTeam] = useState<string | null>(null);
  const [teamChangeCount, setTeamChangeCount] = useState(0);
  const [showPasskey, setShowPasskey] = useState(false);
  const [forceShowAuth, setForceShowAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [passkeyCopied, setPasskeyCopied] = useState(false);

  const getFirebaseModeFromUrl = (): 'local' | 'prod' => {
    const origin = window.location.origin;
    const isLocal = origin.includes('localhost') ||
                    origin.includes('127.0.0.1') ||
                    origin.startsWith('http://192.');
    return isLocal ? 'local' : 'prod';
  };

  const [firebaseMode, setFirebaseModeState] = useState<'local' | 'prod'>(() => {
    return getFirebaseModeFromUrl();
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
        const [user, key] = loginParam.split(':');
        if (user && key) {
          try {
            const result = await verifyUserPasskey(user, key);
            if (result.valid) {
              await set(userRef(clientId), { username: user });
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
    const userUnsub = onValue(userRef(clientId), (snap) => {
      const userData = snap.val();
      if (userData?.username) {
        setUsername(userData.username);
        setIsAuthed(true);
        ensureUsernameDataExists(userData.username, clientId).catch(console.error);

        const usernameUnsub = onValue(usernameDataRef(userData.username), (usernameSnap) => {
          const data = usernameSnap.val();
          if (data?.passkey) {
            setPasskey(data.passkey);
          } else if (userData.username) {
            const newPasskey = generatePasskey();
            saveUserGlobalProfile(userData.username, { passkey: newPasskey })
              .then(() => setPasskey(newPasskey))
              .catch(console.error);
          }
          if (data?.favoriteTeam) setFavoriteTeam(data.favoriteTeam);
          if (data?.teamChangeCount !== undefined) setTeamChangeCount(data.teamChangeCount);
          setLoading(false);
        }, () => setLoading(false));

        return () => usernameUnsub();
      } else {
        setLoading(false);
      }
    }, () => setLoading(false));

    return () => userUnsub();
  }, [clientId]);

  // Listen for login trigger event from header
  useEffect(() => {
    const handleTriggerLogin = () => {
      setForceShowAuth(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('trigger-login', handleTriggerLogin);
    return () => window.removeEventListener('trigger-login', handleTriggerLogin);
  }, []);

  const handleAuthSuccess = async (authUsername: string, authClientId: string) => {
    await set(userRef(authClientId), { username: authUsername });
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
    if (!username) return;
    try {
      const newCount = favoriteTeam ? teamChangeCount + 1 : teamChangeCount;
      await saveUserGlobalProfile(username, { favoriteTeam: team, teamChangeCount: newCount });
    } catch (error) {
      console.error('[App] Error saving favorite team:', error);
    }
  };

  const contextValue = {
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

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <h2>Loading Predicto</h2>
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
          <UserAuth clientId={clientId} onAuthSuccess={(user, cid) => {
            setForceShowAuth(false);
            handleAuthSuccess(user, cid);
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
              {firebaseMode === 'local' && (
                <button
                  className="firebase-mode-btn"
                  onClick={handleToggleFirebaseMode}
                  title="Switch to PROD mode"
                  style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}
                >
                  {firebaseMode.toUpperCase()}
                </button>
              )}
            </div>
          </div>
        )}
        
        {/* Version info in footer */}
        <FooterVersion />
      </div>
    </AppContext.Provider>
  );
}
