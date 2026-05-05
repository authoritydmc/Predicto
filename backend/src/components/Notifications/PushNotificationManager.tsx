import React, { useState, useEffect } from 'react';
import { Toggle } from '../ui/Toggle';

interface UserDevice {
  device_id: string;
  device_type: string;
  platform: string;
  enabled: boolean;
  last_active: string;
  created_at: string;
}

interface UserNotificationSettings {
  user_id: string;
  global_preference: 'all' | 'important' | 'matches' | 'none';
  enabled: boolean;
  quiet_hours: {
    enabled: boolean;
    start: string;
    end: string;
    timezone: string;
  };
  notification_types: Record<string, boolean>;
  devices: string[];
}

interface PushNotificationManagerProps {
  userId: string;
}

export const PushNotificationManager: React.FC<PushNotificationManagerProps> = ({ userId }) => {
  const [userSettings, setUserSettings] = useState<UserNotificationSettings | null>(null);
  const [userDevices, setUserDevices] = useState<UserDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(null);

  useEffect(() => {
    loadUserNotificationData();
  }, [userId]);

  const loadUserNotificationData = async () => {
    try {
      setLoading(true);
      
      // Load user settings
      // @ts-ignore
      const settingsResponse = await window.overlayDesktop.getUserNotificationSettings(userId);
      if (settingsResponse.success) {
        setUserSettings(settingsResponse.settings);
      }

      // Load user devices
      // @ts-ignore
      const devicesResponse = await window.overlayDesktop.getUserDevices(userId);
      if (devicesResponse.success) {
        setUserDevices(devicesResponse.devices);
      }

      // Get VAPID public key for web push
      // @ts-ignore
      const vapidResponse = await window.overlayDesktop.getVapidPublicKey();
      if (vapidResponse.success) {
        setVapidPublicKey(vapidResponse.publicKey);
      }
    } catch (error) {
      console.error('Error loading notification data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateNotificationSetting = async (key: string, value: any) => {
    if (!userSettings) return;

    try {
      setSaving(true);
      
      const updatedSettings = { ...userSettings, [key]: value };
      
      // @ts-ignore
      const response = await window.overlayDesktop.updateUserNotificationSettings(userId, updatedSettings);
      
      if (response.success) {
        setUserSettings(updatedSettings);
      } else {
        console.error('Failed to update settings:', response.error);
      }
    } catch (error) {
      console.error('Error updating settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateNotificationType = async (type: string, enabled: boolean) => {
    if (!userSettings) return;

    try {
      setSaving(true);
      
      const updatedSettings = {
        ...userSettings,
        notification_types: {
          ...userSettings.notification_types,
          [type]: enabled
        }
      };
      
      // @ts-ignore
      const response = await window.overlayDesktop.updateUserNotificationSettings(userId, updatedSettings);
      
      if (response.success) {
        setUserSettings(updatedSettings);
      } else {
        console.error('Failed to update notification type:', response.error);
      }
    } catch (error) {
      console.error('Error updating notification type:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateQuietHours = async (quietHours: any) => {
    if (!userSettings) return;

    try {
      setSaving(true);
      
      const updatedSettings = {
        ...userSettings,
        quiet_hours: {
          ...userSettings.quiet_hours,
          ...quietHours
        }
      };
      
      // @ts-ignore
      const response = await window.overlayDesktop.updateUserNotificationSettings(userId, updatedSettings);
      
      if (response.success) {
        setUserSettings(updatedSettings);
      } else {
        console.error('Failed to update quiet hours:', response.error);
      }
    } catch (error) {
      console.error('Error updating quiet hours:', error);
    } finally {
      setSaving(false);
    }
  };

  const registerWebPushDevice = async () => {
    if (!vapidPublicKey) {
      alert('VAPID public key not available');
      return;
    }

    try {
      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('Notification permission denied');
        return;
      }

      // Register for push notifications
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidPublicKey
      });

      // Register device with server
      // @ts-ignore
      const response = await window.overlayDesktop.registerPushDevice(userId, {
        device_type: 'web',
        platform: navigator.platform.toLowerCase(),
        subscription: subscription
      });

      if (response.success) {
        alert('Push notifications enabled!');
        loadUserNotificationData(); // Reload devices
      } else {
        alert('Failed to register device: ' + response.error);
      }
    } catch (error) {
      console.error('Error registering device:', error);
      alert('Failed to register for push notifications');
    }
  };

  const unregisterDevice = async (deviceId: string) => {
    if (!confirm('Are you sure you want to remove this device?')) return;

    try {
      // @ts-ignore
      const response = await window.overlayDesktop.unregisterPushDevice(userId, deviceId);
      
      if (response.success) {
        alert('Device removed successfully');
        loadUserNotificationData(); // Reload devices
      } else {
        alert('Failed to remove device: ' + response.error);
      }
    } catch (error) {
      console.error('Error unregistering device:', error);
      alert('Failed to remove device');
    }
  };

  const testNotification = async () => {
    try {
      setTestResult('Sending test notification...');
      
      // @ts-ignore
      const response = await window.overlayDesktop.testPushNotification(userId);
      
      if (response.success) {
        setTestResult('Test notification sent successfully!');
      } else {
        setTestResult('Failed to send test notification: ' + response.error);
      }
    } catch (error) {
      console.error('Error testing notification:', error);
      setTestResult('Failed to send test notification');
    }
  };

  if (loading) {
    return <div>Loading notification settings...</div>;
  }

  if (!userSettings) {
    return <div>No notification settings found.</div>;
  }

  return (
    <div className="push-notification-manager">
      <div className="notification-section">
        <h3>Notification Preferences</h3>
        
        {/* Global Settings */}
        <div className="form-group">
          <label className="toggle-row">
            <span>Enable Push Notifications</span>
            <Toggle 
              checked={userSettings.enabled} 
              onChange={(enabled) => updateNotificationSetting('enabled', enabled)} 
            />
          </label>
        </div>

        <div className="form-group">
          <label>Global Preference</label>
          <select 
            value={userSettings.global_preference}
            onChange={(e) => updateNotificationSetting('global_preference', e.target.value)}
            className="form-select"
          >
            <option value="all">All Notifications</option>
            <option value="important">Important Only</option>
            <option value="matches">Match Events Only</option>
            <option value="none">None</option>
          </select>
        </div>

        {/* Quiet Hours */}
        <div className="form-group">
          <label className="toggle-row">
            <span>Quiet Hours</span>
            <Toggle 
              checked={userSettings.quiet_hours.enabled} 
              onChange={(enabled) => updateQuietHours({ enabled })} 
            />
          </label>
        </div>

        {userSettings.quiet_hours.enabled && (
          <div className="quiet-hours-config">
            <div className="form-row">
              <label>Start Time</label>
              <input 
                type="time" 
                value={userSettings.quiet_hours.start}
                onChange={(e) => updateQuietHours({ start: e.target.value })}
                className="form-input"
              />
            </div>
            <div className="form-row">
              <label>End Time</label>
              <input 
                type="time" 
                value={userSettings.quiet_hours.end}
                onChange={(e) => updateQuietHours({ end: e.target.value })}
                className="form-input"
              />
            </div>
          </div>
        )}

        {/* Notification Types */}
        <h4>Notification Types</h4>
        <div className="notification-types">
          {Object.entries(userSettings.notification_types).map(([type, enabled]) => (
            <div key={type} className="form-group">
              <label className="toggle-row">
                <span>{formatNotificationType(type)}</span>
                <Toggle 
                  checked={enabled} 
                  onChange={(value) => updateNotificationType(type, value)} 
                />
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Device Management */}
      <div className="notification-section">
        <h3>Registered Devices</h3>
        
        {userDevices.length === 0 ? (
          <div className="no-devices">
            <p>No devices registered for push notifications.</p>
            <button className="btn-primary" onClick={registerWebPushDevice}>
              Enable Push Notifications
            </button>
          </div>
        ) : (
          <div className="device-list">
            {userDevices.map((device) => (
              <div key={device.device_id} className="device-item">
                <div className="device-info">
                  <div className="device-name">
                    {formatDeviceName(device)}
                  </div>
                  <div className="device-details">
                    {device.platform} • Last active: {formatDate(device.last_active)}
                  </div>
                </div>
                <div className="device-actions">
                  <span className={`device-status ${device.enabled ? 'active' : 'inactive'}`}>
                    {device.enabled ? 'Active' : 'Inactive'}
                  </span>
                  <button 
                    className="btn-danger btn-small"
                    onClick={() => unregisterDevice(device.device_id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {userDevices.length > 0 && (
          <div className="device-actions">
            <button className="btn-primary" onClick={registerWebPushDevice}>
              Add Another Device
            </button>
            <button className="btn-secondary" onClick={testNotification}>
              Test Notification
            </button>
          </div>
        )}
      </div>

      {/* Test Result */}
      {testResult && (
        <div className={`test-result ${testResult.includes('successfully') ? 'success' : 'error'}`}>
          {testResult}
        </div>
      )}
    </div>
  );
};

// Helper functions
const formatNotificationType = (type: string): string => {
  const typeMap: Record<string, string> = {
    'match.created': 'Match Created',
    'match.started': 'Match Started',
    'match.completed': 'Match Completed',
    'match.score_updated': 'Score Updates',
    'automation.error': 'Automation Errors',
    'automation.started': 'Automation Started',
    'automation.stopped': 'Automation Stopped',
    'scraper.error': 'Scraper Errors',
    'scoring.completed': 'Scoring Completed',
    'system.alert': 'System Alerts'
  };
  return typeMap[type] || type;
};

const formatDeviceName = (device: UserDevice): string => {
  const platformMap: Record<string, string> = {
    'chrome': 'Chrome',
    'firefox': 'Firefox',
    'safari': 'Safari',
    'android': 'Android',
    'ios': 'iOS'
  };
  
  const platform = platformMap[device.platform.toLowerCase()] || device.platform;
  return `${platform} (${device.device_type})`;
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  
  if (diffHours < 1) {
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return diffMinutes <= 1 ? 'Just now' : `${diffMinutes} minutes ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hours ago`;
  } else {
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} days ago`;
  }
};
