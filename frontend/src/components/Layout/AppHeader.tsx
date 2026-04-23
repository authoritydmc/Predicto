import { useState, useRef, useEffect } from 'react';
import { STORAGE_KEYS } from '../../config/constants';
import PasscodeViewer from '../Auth/PasscodeViewer';
import './AppHeader.css';

interface AppHeaderProps {
  username: string | null;
  isAuthed: boolean;
  passkey: string | null;
  onLoginClick?: () => void;
  onRotatePasskey?: () => Promise<void>;
}

export default function AppHeader({ 
  username, 
  isAuthed, 
  passkey, 
  onLoginClick,
  onRotatePasskey 
}: AppHeaderProps) {
  console.log('[AppHeader] Props received:', { username, isAuthed, passkey });
  const [showDropdown, setShowDropdown] = useState(false);
  const [showPasscodeViewer, setShowPasscodeViewer] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  return (
    <>
      <header className="app-header">
        <div className="app-header-content">
          <div className="app-header-brand">
            <h1 className="app-header-title">OverlayChat</h1>
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
    </>
  );
}
