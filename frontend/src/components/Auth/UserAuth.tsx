import { useState } from 'react';
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
              <input
                type="text"
                value={passkey}
                onChange={(e) => setPasskey(e.target.value)}
                placeholder="Enter 6-digit passkey..."
                required
                maxLength={6}
                pattern="[0-9]{6}"
                title="Enter 6-digit passkey"
              />
            </label>
            {error && <p className="error-text">{error}</p>}
            <button type="submit" className="primary-btn" disabled={loading}>
              {loading ? 'Verifying...' : 'Login'}
            </button>
            <button
              type="button"
              onClick={() => setMode('check')}
              className="secondary-btn"
              style={{ marginTop: '8px' }}
            >
              Use different username
            </button>
          </form>
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
