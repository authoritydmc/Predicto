import React from 'react';

interface UserData {
  username?: string;
  passkey?: string;
  role?: string;
  isBlocked?: boolean;
  blockedAt?: number;
  predictions?: Record<string, any>;
}

interface UserManagementProps {
  searchUsername: string;
  setSearchUsername: (value: string) => void;
  searchResult: UserData | null;
  searchLoading: boolean;
  searchError: string;
  onSearch: () => void;
  onResetPasskey: (username: string) => void;
  onBlockUser: (username: string, blocked: boolean) => void;
  onSetRole: (username: string, role: string) => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({
  searchUsername,
  setSearchUsername,
  searchResult,
  searchLoading,
  searchError,
  onSearch,
  onResetPasskey,
  onBlockUser,
  onSetRole,
}) => {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSearch();
    }
  };

  return (
    <div className="cp-glass-card">
      {/* Search */}
      <div className="cp-form-row">
        <label>Search User</label>
        <div className="cp-input-action-group">
          <input
            type="text"
            value={searchUsername}
            onChange={(e) => setSearchUsername(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter username..."
            disabled={searchLoading}
          />
          <button
            className="cp-action-btn"
            onClick={onSearch}
            disabled={searchLoading || !searchUsername.trim()}
          >
            {searchLoading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {/* Error */}
      {searchError && (
        <div
          style={{
            padding: '10px',
            background: 'rgba(255, 59, 48, 0.1)',
            borderRadius: '6px',
            border: '1px solid rgba(255, 59, 48, 0.3)',
            color: '#ff3b30',
            fontSize: '13px',
            marginTop: '10px',
          }}
        >
          {searchError}
        </div>
      )}

      {/* Results */}
      {searchResult && (
        <div
          style={{
            marginTop: '16px',
            padding: '16px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '16px' }}>{searchResult.username || searchUsername}</h3>
            {searchResult.isBlocked && (
              <span
                style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  background: 'rgba(255, 59, 48, 0.2)',
                  borderRadius: '4px',
                  color: '#ff3b30',
                }}
              >
                Blocked
              </span>
            )}
          </div>

          <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '12px' }}>
            <div>Role: <span style={{ color: '#fff' }}>{searchResult.role || 'user'}</span></div>
            {searchResult.passkey && (
              <div>Passkey: <span style={{ color: '#fff', fontFamily: 'monospace' }}>{searchResult.passkey}</span></div>
            )}
            {searchResult.isBlocked && searchResult.blockedAt && (
              <div>
                Blocked since: {new Date(searchResult.blockedAt).toLocaleString()}
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              className="cp-action-btn cp-small"
              onClick={() => onResetPasskey(searchResult.username || searchUsername)}
            >
              Reset Passkey
            </button>
            <button
              className={`cp-action-btn cp-small ${searchResult.isBlocked ? 'cp-success' : 'cp-danger'}`}
              onClick={() => onBlockUser(searchResult.username || searchUsername, !searchResult.isBlocked)}
            >
              {searchResult.isBlocked ? 'Unblock User' : 'Block User'}
            </button>
            <select
              className="cp-select cp-small"
              value={searchResult.role || 'user'}
              onChange={(e) => onSetRole(searchResult.username || searchUsername, e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                background: 'rgba(255,255,255,0.1)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)',
                fontSize: '12px',
              }}
            >
              <option value="user">User</option>
              <option value="moderator">Moderator</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {/* Predictions Summary */}
          {searchResult.predictions && Object.keys(searchResult.predictions).length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px' }}>
                Predictions: {Object.keys(searchResult.predictions).length} matches
              </div>
            </div>
          )}
        </div>
      )}

      <p className="cp-panel-note">
        Search for users by username to manage their account settings, reset passkeys, or block/unblock access.
      </p>
    </div>
  );
};
