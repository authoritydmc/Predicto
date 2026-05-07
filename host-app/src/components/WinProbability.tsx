import React from 'react';

interface WinProbabilityProps {
  googleUrl: string;
  setGoogleUrl: (url: string) => void;
  autoFetch: boolean;
  setAutoFetch: (value: boolean) => void;
  showWinProb: boolean;
  setShowWinProb: (value: boolean) => void;
  fetchStatus: string;
  onFetch: () => void;
  onSaveUrl: () => void;
}

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
  <label className="cp-toggle">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span className="cp-toggle-track" />
  </label>
);

export const WinProbability: React.FC<WinProbabilityProps> = ({
  googleUrl,
  setGoogleUrl,
  autoFetch,
  setAutoFetch,
  showWinProb,
  setShowWinProb,
  fetchStatus,
  onFetch,
  onSaveUrl,
}) => {
  const handleSolveCaptcha = () => {
    if (!googleUrl.trim()) {
      alert('Please paste the Google Match URL first.');
      return;
    }
    // @ts-ignore
    window.overlayDesktop?.openScraperSolver?.(googleUrl);
  };

  const handleViewDebug = () => {
    // @ts-ignore
    window.overlayDesktop?.viewScraperDebug?.();
  };

  return (
    <div className="cp-glass-card cp-stack">
      <div className="cp-form-row">
        <label>Google Match URL</label>
        <div className="cp-input-action-group">
          <input
            type="text"
            value={googleUrl}
            onChange={(e) => setGoogleUrl(e.target.value)}
            onBlur={onSaveUrl}
            placeholder="Paste Google URL here..."
          />
          <button className="cp-action-btn" type="button" onClick={onFetch}>
            Fetch Now
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <span className="cp-panel-note" style={{ marginTop: 0 }}>{fetchStatus}</span>
          <button
            className="cp-glass-btn cp-small"
            title="View screenshot of what the scraper sees"
            style={{ padding: '4px 8px', fontSize: 10 }}
            onClick={handleViewDebug}
          >
            View Debug
          </button>
          <button
            className="cp-action-btn cp-small"
            title="Solve Google CAPTCHA"
            style={{ padding: '4px 8px', fontSize: 10 }}
            onClick={handleSolveCaptcha}
          >
            Solve CAPTCHA
          </button>
        </div>
      </div>

      <div className="cp-form-row">
        <label className="cp-toggle-row">
          <span>Auto-Fetch (30s)</span>
          <Toggle checked={autoFetch} onChange={setAutoFetch} />
        </label>
      </div>

      <div className="cp-form-row">
        <label className="cp-toggle-row">
          <span>Show on Overlay</span>
          <Toggle checked={showWinProb} onChange={setShowWinProb} />
        </label>
      </div>

      <div className="cp-divider" />
      <p className="cp-panel-note">
        Slider updates automatically if Auto-Fetch is on. You can also fetch manually.
      </p>
    </div>
  );
};
