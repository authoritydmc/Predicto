import { useState, useRef, useEffect } from 'react';
import { STORAGE_KEYS } from '../../config/constants';
import PasscodeViewer from '../Auth/PasscodeViewer';
import { getTeamLogoUrl, getTeamColor } from '../../utils/teamLogos';
import './AppHeader.css';

interface AppHeaderProps {
  username: string | null;
  isAuthed: boolean;
  passkey: string | null;
  favoriteTeam: string | null;
  teamChangeCount: number;
  onLoginClick?: () => void;
  onRotatePasskey?: () => Promise<void>;
  onSelectFavoriteTeam?: (team: string) => void;
}

export default function AppHeader({ 
  username, 
  isAuthed, 
  passkey, 
  favoriteTeam,
  teamChangeCount,
  onLoginClick,
  onRotatePasskey,
  onSelectFavoriteTeam
}: AppHeaderProps) {
  console.log('[AppHeader] Props received:', { username, isAuthed, passkey, favoriteTeam });
  const [showDropdown, setShowDropdown] = useState(false);
  const [showPasscodeViewer, setShowPasscodeViewer] = useState(false);
  const [showTeamSelector, setShowTeamSelector] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const teamColors = favoriteTeam ? getTeamColor(favoriteTeam) : { primary: '#6366f1', secondary: '#8b5cf6' };

  const handleLoginClick = () => {
    // Dispatch custom event that App.tsx can listen for
    window.dispatchEvent(new CustomEvent('trigger-login'));
    onLoginClick?.();
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    if (confirm('Are you sure you want to logout? This will clear your session.')) {
      localStorage.removeItem(STORAGE_KEYS.CLIENT_ID);
      window.location.reload();
    }
  };

  const handleViewPasscode = () => {
    console.log('[AppHeader] handleViewPasscode called', { username, passkey });
    setShowDropdown(false);
    setShowPasscodeViewer(true);
    console.log('[AppHeader] showPasscodeViewer set to true');
  };

  const handleSelectTeam = () => {
    setShowDropdown(false);
    setShowTeamSelector(true);
  };

  const handleTeamSelect = (team: string) => {
    onSelectFavoriteTeam?.(team);
    setShowTeamSelector(false);
  };

  return (
    <>
      <header 
        className="app-header"
        style={{
          background: `linear-gradient(135deg, ${teamColors.primary}22 0%, ${teamColors.secondary}22 100%)`,
        }}
      >
        <div className="app-header-content">
          <div className="app-header-brand">
            <h1 className="app-header-title">Predicto</h1>
            <span className="app-header-subtitle">Live Sports Chat</span>
          </div>

          <div className="app-header-actions">
            {isAuthed ? (
              <div className="user-menu" ref={dropdownRef}>
                <button
                  className="user-menu-button"
                  onClick={() => setShowDropdown(!showDropdown)}
                  aria-label="User menu"
                >
                  <div className="user-avatar">
                    {username?.charAt(0).toUpperCase()}
                  </div>
                  <span className="user-name">{username}</span>
                  <svg className="dropdown-arrow" width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                {showDropdown && (
                  <div className="user-dropdown">
                    <div className="dropdown-header">
                      <span className="dropdown-username">{username}</span>
                      <span className="dropdown-status">Online</span>
                    </div>
                    <div className="dropdown-divider"></div>
                    {favoriteTeam && (
                      <>
                        <div className="dropdown-team-section">
                          <span className="dropdown-team-label">Supporting</span>
                          <div className="dropdown-team-display">
                            {getTeamLogoUrl(favoriteTeam) && (
                              <img src={getTeamLogoUrl(favoriteTeam)!} alt={favoriteTeam} className="dropdown-team-logo" />
                            )}
                            <span className="dropdown-team-name">{favoriteTeam}</span>
                          </div>
                        </div>
                        <div className="dropdown-divider"></div>
                      </>
                    )}
                    <button
                      className="dropdown-item"
                      onClick={handleSelectTeam}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M8 2C4.69 2 2 4.69 2 8C2 11.31 4.69 14 8 14C11.31 14 14 11.31 14 8C14 4.69 11.31 2 8 2ZM8 12.5C5.52 12.5 3.5 10.48 3.5 8C3.5 5.52 5.52 3.5 8 3.5C10.48 3.5 12.5 5.52 12.5 8C12.5 10.48 10.48 12.5 8 12.5ZM8.5 5H7.5V8.5L10.5 10.25L11 9.4L8.5 7.9V5Z" fill="currentColor"/>
                      </svg>
                      {favoriteTeam ? 'Change Team' : 'Select Team'}
                    </button>
                    <button
                      className="dropdown-item"
                      onClick={handleViewPasscode}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M8 2C5.79 2 4 3.79 4 6V8H3C2.45 8 2 8.45 2 9V14C2 14.55 2.45 15 3 15H13C13.55 15 14 14.55 14 14V9C14 8.45 13.55 8 13 8H12V6C12 3.79 10.21 2 8 2ZM8 4C9.1 4 10 4.9 10 6V8H6V6C6 4.9 6.9 4 8 4Z" fill="currentColor"/>
                      </svg>
                      View Passcode
                    </button>
                    <button
                      className="dropdown-item dropdown-item-danger"
                      onClick={handleLogout}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M8 2C4.69 2 2 4.69 2 8C2 11.31 4.69 14 8 14C11.31 14 14 11.31 14 8C14 4.69 11.31 2 8 2ZM8 12.5C5.52 12.5 3.5 10.48 3.5 8C3.5 5.52 5.52 3.5 8 3.5C10.48 3.5 12.5 5.52 12.5 8C12.5 10.48 10.48 12.5 8 12.5ZM8.5 5H7.5V8.5L10.5 10.25L11 9.4L8.5 7.9V5Z" fill="currentColor"/>
                      </svg>
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button className="login-button" onClick={handleLoginClick}>
                Login
              </button>
            )}
          </div>
        </div>
      </header>

      {showPasscodeViewer && username && passkey && (
        <>
          {console.log('[AppHeader] Rendering PasscodeViewer', { showPasscodeViewer, username, passkey })}
          <PasscodeViewer
            username={username}
            passkey={passkey}
            onClose={() => {
              console.log('[AppHeader] PasscodeViewer onClose called');
              setShowPasscodeViewer(false);
            }}
            onResetPasskey={onRotatePasskey || (async () => {})}
          />
        </>
      )}

      {showTeamSelector && (
        <div className="modal-overlay">
          <div className="modal-content team-selector-modal">
            <div className="modal-header">
              <h2>{favoriteTeam ? 'Change Your Team' : 'Select Your Team'}</h2>
              <p>
                {teamChangeCount >= 3 
                  ? 'You have reached the maximum limit of 3 team changes.'
                  : `Select your favorite IPL team (${3 - teamChangeCount} change${3 - teamChangeCount !== 1 ? 's' : ''} remaining)`
                }
              </p>
            </div>
            <div className="team-grid">
              {["CSK", "MI", "RCB", "KKR", "DC", "PBKS", "RR", "SRH", "LSG", "GT"].map((team) => {
                const logoUrl = getTeamLogoUrl(team);
                return (
                  <button 
                    key={team} 
                    className="team-btn" 
                    onClick={() => handleTeamSelect(team)}
                    disabled={teamChangeCount >= 3 && favoriteTeam !== team}
                  >
                    {logoUrl && (
                      <img 
                        src={logoUrl} 
                        alt={team} 
                        className="team-logo"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    <span className="team-name">{team}</span>
                  </button>
                );
              })}
            </div>
            <button
              className="secondary-btn"
              onClick={() => setShowTeamSelector(false)}
              style={{ marginTop: '16px' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
