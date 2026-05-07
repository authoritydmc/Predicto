import React from 'react';
import { Toggle } from './Toggle'; // Assuming Toggle is exported or I should move it too

interface DiscordNotificationsProps {
  wsConnection: boolean;
  onTestNotification: () => Promise<void>;
  onSaveConfig: () => void;
  onViewSetupGuide: () => void;
}

export const DiscordNotifications: React.FC<DiscordNotificationsProps> = ({
  wsConnection,
  onTestNotification,
  onSaveConfig,
  onViewSetupGuide
}) => {
  return (
    <div className="cp-glass-card">
      {/* Discord Status */}
      <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(129, 140, 248, 0.1)', borderRadius: '8px', border: '1px solid rgba(129, 140, 248, 0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: '#818cf8', fontWeight: 600 }}>
            Discord Webhook System
          </span>
          <span className={`cp-dot ${wsConnection ? 'active' : 'inactive'}`} />
        </div>
        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
          {wsConnection ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      {/* Discord Configuration */}
      <div className="cp-section-header">
        <span>Webhook Configuration</span>
      </div>
      
      <div className="cp-form-row">
        <label>Webhook URL</label>
        <input 
          type="url" 
          placeholder="https://discord.com/api/webhooks/..."
          style={{ 
            background: 'rgba(0,0,0,0.2)', 
            border: '1px solid var(--panel-border)', 
            borderRadius: '6px', 
            color: 'var(--text)',
            padding: '8px 12px',
            fontSize: '13px',
            width: '100%'
          }}
          onChange={(e) => {
            console.log('Discord webhook URL:', e.target.value);
          }}
        />
      </div>

      <div className="cp-dual-row">
        <div className="cp-form-row">
          <label>Bot Username</label>
          <input 
            type="text" 
            placeholder="Automation Bot"
            maxLength={32}
            style={{ 
              background: 'rgba(0,0,0,0.2)', 
              border: '1px solid var(--panel-border)', 
              borderRadius: '6px', 
              color: 'var(--text)',
              padding: '8px 12px',
              fontSize: '13px'
            }}
            onChange={(e) => {
              console.log('Bot username:', e.target.value);
            }}
          />
        </div>
        <div className="cp-form-row">
          <label>Avatar URL (Optional)</label>
          <input 
            type="url" 
            placeholder="https://example.com/avatar.png"
            style={{ 
              background: 'rgba(0,0,0,0.2)', 
              border: '1px solid var(--panel-border)', 
              borderRadius: '6px', 
              color: 'var(--text)',
              padding: '8px 12px',
              fontSize: '13px'
            }}
            onChange={(e) => {
              console.log('Avatar URL:', e.target.value);
            }}
          />
        </div>
      </div>

      <div className="cp-form-row">
        <label className="cp-toggle-row">
          <span>Enable Rich Embeds</span>
          <Toggle checked={true} onChange={(v) => {
            console.log('Rich embeds:', v);
          }} />
        </label>
      </div>

      <div className="cp-form-row">
        <label className="cp-toggle-row">
          <span>Enable Notifications</span>
          <Toggle checked={true} onChange={(v) => {
            console.log('Enable notifications:', v);
          }} />
        </label>
      </div>

      <div className="cp-divider" />

      {/* Notification Types */}
      <div className="cp-section-header">
        <span>Notification Types</span>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '16px' }}>
        <label className="cp-toggle-row" style={{ fontSize: '12px' }}>
          <span>Match Created</span>
          <Toggle checked={true} onChange={(v) => console.log('Match created:', v)} />
        </label>
        <label className="cp-toggle-row" style={{ fontSize: '12px' }}>
          <span>Match Started</span>
          <Toggle checked={true} onChange={(v) => console.log('Match started:', v)} />
        </label>
        <label className="cp-toggle-row" style={{ fontSize: '12px' }}>
          <span>Match Completed</span>
          <Toggle checked={true} onChange={(v) => console.log('Match completed:', v)} />
        </label>
        <label className="cp-toggle-row" style={{ fontSize: '12px' }}>
          <span>Score Updates</span>
          <Toggle checked={false} onChange={(v) => console.log('Score updates:', v)} />
        </label>
        <label className="cp-toggle-row" style={{ fontSize: '12px' }}>
          <span>Automation Errors</span>
          <Toggle checked={true} onChange={(v) => console.log('Automation errors:', v)} />
        </label>
        <label className="cp-toggle-row" style={{ fontSize: '12px' }}>
          <span>System Alerts</span>
          <Toggle checked={true} onChange={(v) => console.log('System alerts:', v)} />
        </label>
      </div>

      {/* Rate Limiting */}
      <div className="cp-form-row">
        <label>Rate Limit (messages per minute)</label>
        <input 
          type="number" 
          min="1" 
          max="60" 
          defaultValue="10"
          style={{ 
            background: 'rgba(0,0,0,0.2)', 
            border: '1px solid var(--panel-border)', 
            borderRadius: '6px', 
            color: 'var(--text)',
            padding: '8px 12px',
            fontSize: '13px',
            width: '120px'
          }}
          onChange={(e) => {
            console.log('Rate limit:', e.target.value);
          }}
        />
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
        <button 
          className="cp-action-btn cp-small"
          onClick={onTestNotification}
        >
          Test Notification
        </button>
        <button 
          className="cp-primary-btn cp-small"
          onClick={onSaveConfig}
        >
          Save Configuration
        </button>
      </div>

      <div className="cp-divider" />

      {/* Setup Guide Link */}
      <div style={{ 
        padding: '12px', 
        background: 'rgba(255,255,255,0.02)', 
        borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#818cf8' }}>
          📖 Setup Guide
        </h4>
        <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '0 0 8px 0' }}>
          Need help setting up Discord notifications? Follow our comprehensive setup guide.
        </p>
        <button 
          className="cp-action-btn cp-small"
          onClick={onViewSetupGuide}
        >
          View Setup Guide
        </button>
      </div>

      <p className="cp-panel-note" style={{ marginTop: '12px' }}>
        Discord notifications provide real-time updates about match events, automation status, and system alerts directly to your Discord server.
      </p>
    </div>
  );
};
