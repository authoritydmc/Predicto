import React from 'react';
import { Toggle } from './Toggle';

interface PushNotificationsProps {
  wsConnection: boolean;
  onTestPush: () => Promise<void>;
  onSaveConfig: () => void;
  onViewSetupGuide: () => void;
  onManageUsers: () => void;
}

export const PushNotifications: React.FC<PushNotificationsProps> = ({
  wsConnection,
  onTestPush,
  onSaveConfig,
  onViewSetupGuide,
  onManageUsers
}) => {
  return (
    <div className="cp-glass-card">
      {/* Push Notification Status */}
      <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: '#10b981', fontWeight: 600 }}>
            Push Notification System
          </span>
          <span className={`cp-dot ${wsConnection ? 'active' : 'inactive'}`} />
        </div>
        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
          {wsConnection ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      {/* User Statistics */}
      <div className="cp-section-header">
        <span>User Statistics</span>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
        <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: '600', color: '#10b981' }}>0</div>
          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Total Users</div>
        </div>
        <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: '600', color: '#3b82f6' }}>0</div>
          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Active Devices</div>
        </div>
        <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: '600', color: '#f59e0b' }}>0</div>
          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Sent Today</div>
        </div>
      </div>

      {/* Push Notification Configuration */}
      <div className="cp-section-header">
        <span>Push Notification Configuration</span>
      </div>
      
      <div className="cp-form-row">
        <label className="cp-toggle-row">
          <span>Enable Push Notifications</span>
          <Toggle checked={true} onChange={(v) => {
            console.log('Enable push notifications:', v);
          }} />
        </label>
      </div>

      <div className="cp-form-row">
        <label>Firebase Project ID</label>
        <input 
          type="text" 
          placeholder="your-project-id"
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
            console.log('Firebase project ID:', e.target.value);
          }}
        />
      </div>

      <div className="cp-form-row">
        <label>Service Account Key (JSON)</label>
        <textarea 
          placeholder="Paste Firebase service account key JSON..."
          rows={4}
          style={{ 
            background: 'rgba(0,0,0,0.2)', 
            border: '1px solid var(--panel-border)', 
            borderRadius: '6px', 
            color: 'var(--text)',
            padding: '8px 12px',
            fontSize: '12px',
            width: '100%',
            fontFamily: 'monospace'
          }}
          onChange={(e) => {
            console.log('Service account key updated');
          }}
        />
      </div>

      <div className="cp-form-row">
        <label>VAPID Public Key</label>
        <input 
          type="text" 
          placeholder="Generated automatically"
          readOnly
          style={{ 
            background: 'rgba(0,0,0,0.1)', 
            border: '1px solid var(--panel-border)', 
            borderRadius: '6px', 
            color: 'var(--muted)',
            padding: '8px 12px',
            fontSize: '12px',
            width: '100%',
            fontFamily: 'monospace'
          }}
          value="Generated when Web Push is configured"
        />
      </div>

      <div className="cp-divider" />

      {/* Notification Types */}
      <div className="cp-section-header">
        <span>Default Notification Types</span>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '16px' }}>
        <label className="cp-toggle-row" style={{ fontSize: '12px' }}>
          <span>Match Created</span>
          <Toggle checked={true} onChange={(v) => console.log('Push match created:', v)} />
        </label>
        <label className="cp-toggle-row" style={{ fontSize: '12px' }}>
          <span>Match Started</span>
          <Toggle checked={true} onChange={(v) => console.log('Push match started:', v)} />
        </label>
        <label className="cp-toggle-row" style={{ fontSize: '12px' }}>
          <span>Match Completed</span>
          <Toggle checked={true} onChange={(v) => console.log('Push match completed:', v)} />
        </label>
        <label className="cp-toggle-row" style={{ fontSize: '12px' }}>
          <span>Score Updates</span>
          <Toggle checked={false} onChange={(v) => console.log('Push score updates:', v)} />
        </label>
        <label className="cp-toggle-row" style={{ fontSize: '12px' }}>
          <span>Automation Errors</span>
          <Toggle checked={true} onChange={(v) => console.log('Push automation errors:', v)} />
        </label>
        <label className="cp-toggle-row" style={{ fontSize: '12px' }}>
          <span>System Alerts</span>
          <Toggle checked={true} onChange={(v) => console.log('Push system alerts:', v)} />
        </label>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
        <button 
          className="cp-action-btn cp-small"
          onClick={onTestPush}
        >
          Test Push Notification
        </button>
        <button 
          className="cp-primary-btn cp-small"
          onClick={onSaveConfig}
        >
          Save Configuration
        </button>
      </div>

      <div className="cp-divider" />

      {/* User Management */}
      <div className="cp-section-header">
        <span>User Management</span>
      </div>
      
      <div style={{ marginBottom: '16px' }}>
        <input 
          type="text" 
          placeholder="Search users by ID or email..."
          style={{ 
            background: 'rgba(0,0,0,0.2)', 
            border: '1px solid var(--panel-border)', 
            borderRadius: '6px', 
            color: 'var(--text)',
            padding: '8px 12px',
            fontSize: '13px',
            width: '100%',
            marginBottom: '8px'
          }}
          onChange={(e) => {
            console.log('Search users:', e.target.value);
          }}
        />
        <button 
          className="cp-action-btn cp-small"
          onClick={onManageUsers}
        >
          Manage Users
        </button>
      </div>

      {/* Setup Guide Link */}
      <div style={{ 
        padding: '12px', 
        background: 'rgba(255,255,255,0.02)', 
        borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#10b981' }}>
          📱 Push Notification Setup
        </h4>
        <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '0 0 8px 0' }}>
          Configure Firebase Cloud Messaging and Web Push API to deliver notifications directly to users' devices.
        </p>
        <button 
          className="cp-action-btn cp-small"
          onClick={onViewSetupGuide}
        >
          View Setup Guide
        </button>
      </div>

      <p className="cp-panel-note" style={{ marginTop: '12px' }}>
        Push notifications deliver messages directly to individual users' devices based on their preferences. Unlike Discord, users can control exactly what they receive.
      </p>
    </div>
  );
};
