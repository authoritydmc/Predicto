// IPC Handlers Module for Predicto Host App
// This module handles Inter-Process Communication between main and renderer processes

function registerIpcHandlers(config, windowManager, scheduler, eventHandlers) {
  const { ipcMain } = require('electron');
  const { broadcastToClients } = eventHandlers || {};
  
  // Handle settings updates from renderer process
  ipcMain.handle('settings-get', (event) => {
    return windowManager.getSettings();
  });
  
  ipcMain.handle('settings-update', (event, newSettings) => {
    windowManager.updateSettings(newSettings);
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