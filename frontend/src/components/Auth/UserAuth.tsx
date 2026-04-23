import { useState, useEffect, useRef } from 'react';
import React from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { checkUsernameAvailability, createUserWithPasskey, verifyUserPasskey } from '../../firebase/services';

interface UserAuthProps {
  clientId: string;
  onAuthSuccess: (username: string, clientId: string) => void;
}

export default function UserAuth({ clientId, onAuthSuccess }: UserAuthProps) {
  const [username, setUsername] = useState('');
  const [passkey, setPasskey] = useState('');
  const [mode, setMode] = useState<'check' | 'create' | 'login'>('check');
  const [loading, setLoading] = useState(false);
  const [generatedPasskey, setGeneratedPasskey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showQRScanner, setShowQRScanner] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  // Cleanup QR scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
    };
  }, []);

  const handleScanSuccess = async (decodedText: string) => {
    try {
      console.log('[UserAuth] QR scanned:', decodedText);
      
      // Parse URL format: ?login=username:passkey
      const url = new URL(decodedText);
      const loginParam = url.searchParams.get('login');
      
      if (loginParam) {
        const [scannedUsername, scannedPasskey] = loginParam.split(':');
        if (scannedUsername && scannedPasskey) {
          // Auto-fill and login
          setUsername(scannedUsername);
          setPasskey(scannedPasskey);
          setMode('login');
          setShowQRScanner(false);
          
          // Auto-submit login
          const result = await verifyUserPasskey(scannedUsername, scannedPasskey);
          if (result.valid) {
            onAuthSuccess(scannedUsername, result.clientId);
          } else {
            setError('Invalid passkey from QR code');
          }
          return;
        }
      }
      
      setError('Invalid QR code format');
    } catch (err) {
      console.error('[UserAuth] Error processing QR:', err);
      setError('Error processing QR code');
    }
  };

  const handleStartQRScan = () => {
    setShowQRScanner(true);
    // Initialize QR scanner after modal is rendered
    setTimeout(() => {
      if (!scannerRef.current) {
        scannerRef.current = new Html5QrcodeScanner(
          "qr-reader",
          { fps: 10, qrbox: { width: 250, height: 250 } },
          false
        );
        scannerRef.current.render(handleScanSuccess, (error) => {
          console.error('[UserAuth] QR scan error:', error);
        });
      }
    }, 100);
  };

  const handleCloseQRScanner = () => {
    setShowQRScanner(false);
    if (scannerRef.current) {
      scannerRef.current.clear().catch(console.error);
    }
  };

  const handleCheckUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const isAvailable = await checkUsernameAvailability(username);
      if (isAvailable) {
        setMode('create');
      } else {
        setMode('login');
      }
    } catch (err) {
      setError('Error checking username. Please try again.');
      console.error('[UserAuth] Error checking username:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const passkey = await createUserWithPasskey(username, clientId);
      setGeneratedPasskey(passkey);
      // Auto-login after creation
      setTimeout(() => {
        onAuthSuccess(username, clientId);
      }, 3000);
    } catch (err) {
      setError('Error creating account. Please try again.');
      console.error('[UserAuth] Error creating user:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passkey.trim()) {
      setError('Please enter your passkey');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await verifyUserPasskey(username, passkey);
      if (result.valid) {
        onAuthSuccess(username, result.clientId);
      } else {
        setError('Invalid passkey. Please try again.');
        setPasskey(''); // Clear all fields on invalid passkey
      }
    } catch (err) {
      setError('Error logging in. Please try again.');
      console.error('[UserAuth] Error logging in:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content user-auth-modal">
        <div className="modal-header">
          <h2>Welcome</h2>
          <p>Enter your username to get started</p>
        </div>

        {mode === 'check' && (
          <form onSubmit={handleCheckUsername} className="stack-form">
            <label>
              Username
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username..."
                required
                minLength={3}
                maxLength={20}
                pattern="[a-zA-Z0-9_]+"
                title="Only letters, numbers, and underscores allowed"
              />
            </label>
            {error && <p className="error-text">{error}</p>}
            <button type="submit" className="primary-btn" disabled={loading}>
              {loading ? 'Checking...' : 'Continue'}
            </button>
          </form>
        )}

        {mode === 'create' && (
          <form onSubmit={handleCreateUser} className="stack-form">
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <p style={{ color: 'var(--muted)', marginBottom: '8px' }}>
                Username <strong>{username}</strong> is available!
              </p>
              <p style={{ fontSize: '0.9rem', color: 'var(--text)' }}>
                We'll generate a passkey for you. Save it securely to login on other devices.
              </p>
            </div>
            {error && <p className="error-text">{error}</p>}
            <button type="submit" className="primary-btn" disabled={loading}>
              {loading ? 'Creating...' : 'Create Account & Generate Passkey'}
            </button>
            <button
              type="button"
              onClick={() => setMode('check')}
              className="secondary-btn"
              style={{ marginTop: '8px' }}
            >
              Back
            </button>
          </form>
        )}

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="stack-form">
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <p style={{ color: 'var(--muted)', marginBottom: '8px' }}>
                Welcome back, <strong>{username}</strong>
              </p>
              <p style={{ fontSize: '0.9rem', color: 'var(--text)' }}>
                Enter your passkey to login
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '8px' }}>
                💡 Your passkey is shown at the bottom of the page when you're logged in
              </p>
            </div>
            <label>
              Passkey
              <div className="passkey-input-container">
                {[...Array(8)].map((_, index) => (
                  <React.Fragment key={index}>
                    <input
                      type="text"
                      maxLength={1}
                      value={passkey[index] || ''}
                      onChange={(e) => {
                        const value = e.target.value.toUpperCase();
                        const newPasskey = passkey.split('');
                        newPasskey[index] = value;
                        setPasskey(newPasskey.join(''));
                        
                        // Auto-focus next input
                        if (value && index < 7) {
                          const nextInput = document.querySelectorAll('.passkey-input')[index + 1] as HTMLInputElement;
                          nextInput?.focus();
                        }
                      }}
                      onKeyDown={(e) => {
                        // Handle backspace: clear current and go to previous if empty
                        if (e.key === 'Backspace') {
                          if (passkey[index]) {
                            // Has value - clear it but stay in this field
                            const newPasskey = passkey.split('');
                            newPasskey[index] = '';
                            setPasskey(newPasskey.join(''));
                          } else if (index > 0) {
                            // Empty - go to previous field
                            const prevInput = document.querySelectorAll('.passkey-input')[index - 1] as HTMLInputElement;
                            prevInput?.focus();
                          }
                        }
                      }}
                      className="passkey-input"
                      ref={(el) => {
                        if (el && index === 0 && !passkey) {
                          el.focus();
                        }
                      }}
                    />
                    {index === 3 && <span className="passkey-separator">-</span>}
                  </React.Fragment>
                ))}
              </div>
            </label>
            {error && <p className="error-text">{error}</p>}
            <button type="submit" className="primary-btn" disabled={loading}>
              {loading ? 'Verifying...' : 'Login'}
            </button>
            <button
              type="button"
              onClick={handleStartQRScan}
              className="secondary-btn"
              style={{ marginTop: '8px' }}
            >
              📷 Scan QR Code
            </button>
            <button
              type="button"
              onClick={() => setMode('check')}
              className="ghost-btn"
              style={{ marginTop: '8px' }}
            >
              Use different username
            </button>
          </form>
        )}

        {showQRScanner && (
          <div className="qr-scanner-overlay">
            <div className="qr-scanner-modal">
              <div className="qr-scanner-header">
                <h3>Scan QR Code</h3>
                <button onClick={handleCloseQRScanner} className="close-btn">×</button>
              </div>
              <div id="qr-reader" className="qr-reader-container"></div>
              <p style={{ fontSize: '0.85rem', color: 'var(--muted)', textAlign: 'center', marginTop: '12px' }}>
                Point your camera at the QR code from another device
              </p>
            </div>
          </div>
        )}

        {generatedPasskey && (
          <div className="passkey-display">
            <h3>Your Passkey</h3>
            <div className="passkey-value">{generatedPasskey}</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: '12px' }}>
              Save this passkey securely. You'll need it to login on other devices.
            </p>
            <p style={{ fontSize: '0.85rem', color: 'var(--accent-blue)', marginTop: '8px' }}>
              Logging you in automatically...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
