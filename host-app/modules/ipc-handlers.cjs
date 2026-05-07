// IPC Handlers Module for Predicto Host App
// This module handles Inter-Process Communication between main and renderer processes

function registerIpcHandlers(config, windowManager, scheduler, eventHandlers) {
  const { ipcMain } = require('electron');
  const { broadcastToClients } = eventHandlers || {};
  
  // Handle settings updates from renderer process
  ipcMain.handle('settings:get', (event) => {
    return windowManager.getSettings();
  });
  
  ipcMain.handle('settings:update', (event, newSettings) => {
    windowManager.updateSettings(newSettings);
    // Emit settings changed event for listeners
    event.sender.send('settings:changed', newSettings);
    return { success: true };
  });
  
  ipcMain.handle('settings:set-window-visibility', (event, visibility) => {
    windowManager.updateSettings(visibility);
    return { success: true };
  });
  
  // Handle window control commands
  ipcMain.handle('window-show-control', (event) => {
    windowManager.ensureControlWindow();
    return { success: true };
  });
  
  ipcMain.handle('window-hide-control', (event) => {
    // Implementation would hide the control window
    return { success: true };
  });
  
  // Handle scheduler commands
  ipcMain.handle('scheduler-start', (event) => {
    if (scheduler && typeof scheduler.startScheduler === 'function') {
      scheduler.startScheduler();
    }
    return { success: true };
  });
  
  ipcMain.handle('scheduler-stop', (event) => {
    if (scheduler && typeof scheduler.stopScheduler === 'function') {
      scheduler.stopScheduler();
    }
    return { success: true };
  });
  
  // Handle broadcast to WebSocket clients
  ipcMain.handle('broadcast-to-clients', (event, message) => {
    if (broadcastToClients && typeof broadcastToClients === 'function') {
      broadcastToClients(message);
    }
    return { success: true };
  });
  
  // Handle overlay control
  ipcMain.handle('overlay:show', (event) => {
    windowManager.updateSettings({ overlayVisible: true });
    return { success: true };
  });
  
  ipcMain.handle('overlay:hide', (event) => {
    windowManager.updateSettings({ overlayVisible: false });
    return { success: true };
  });
  
  ipcMain.handle('overlay:reload', (event) => {
    const overlayWindow = windowManager.getOverlayWindow();
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.reload();
    }
    return { success: true };
  });
  
  // Handle external links
  ipcMain.handle('external:open', (event, url) => {
    const { shell } = require('electron');
    shell.openExternal(url);
    return { success: true };
  });
  
  // Handle clipboard operations
  ipcMain.handle('clipboard:write-text', (event, text) => {
    const { clipboard } = require('electron');
    clipboard.writeText(text);
    return { success: true };
  });
  
  // Handle debug window
  ipcMain.handle('debug:show', (event) => {
    windowManager.ensureDebugWindow();
    return { success: true };
  });
  
  // Handle Firebase mode
  ipcMain.handle('firebase:set-mode', (event, mode) => {
    // Store mode in settings or environment
    windowManager.updateSettings({ firebaseMode: mode });
    return { success: true };
  });
  
  // Handle scheduler operations
  ipcMain.handle('scheduler:get-status', (event) => {
    if (scheduler && typeof scheduler.getSchedulerStatus === 'function') {
      return scheduler.getSchedulerStatus();
    }
    return { running: false };
  });
  
  ipcMain.handle('scheduler:trigger-task', (event, taskId) => {
    if (scheduler && typeof scheduler.triggerTask === 'function') {
      return scheduler.triggerTask(taskId);
    }
    return { success: false, error: 'Scheduler not available' };
  });
  
  ipcMain.handle('scheduler:update-task', (event, taskId, config) => {
    if (scheduler && typeof scheduler.updateTask === 'function') {
      return scheduler.updateTask(taskId, config);
    }
    return { success: false, error: 'Scheduler not available' };
  });
  
    
  // Handle CSV operations
  ipcMain.handle('csv:get-schedule', (event) => {
    // This would typically read from a file or database
    // For now, return a mock CSV
    return 'Date,Time,Team A,Team B,Tournament,Match ID\n2024-01-01,10:00,Team1,Team2,Tournament1,match1';
  });
  
  // Handle Discord notifications
  ipcMain.handle('automation:test-discord', (event) => {
    // Mock implementation
    return { success: true, message: 'Test Discord notification sent' };
  });
  
  // Handle push notifications
  ipcMain.handle('push:test-notification', (event) => {
    // Mock implementation
    return { success: true, message: 'Test push notification sent' };
  });
  
  // Handle application info requests
  ipcMain.handle('app-info-get', (event) => {
    const { APP_MODE, isDev, VITE_DEV_SERVER_URL, APP_VERSION } = config;
    return {
      mode: APP_MODE,
      isDev: isDev,
      devServerUrl: VITE_DEV_SERVER_URL,
      version: APP_VERSION
    };
  });
  
  console.log('[IPC] Handlers registered');
}

module.exports = {
  registerIpcHandlers
};