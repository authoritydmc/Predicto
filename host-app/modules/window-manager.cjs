// Window Manager Module for Predicto Host App
// This module manages the creation and control of Electron windows

function createWindowManager(config, eventHandlers) {
  const { APP_MODE, isDev, VITE_DEV_SERVER_URL, APP_VERSION } = config;
  const { broadcastToClients } = eventHandlers || {};
  
  // Store window references
  let controlWindow = null;
  let overlayWindow = null;
  let tickerWindow = null;
  let reactionWindow = null;
  
  // Store application settings
  let settings = {
    overlayVisible: false,
    tickerVisible: false,
    reactionVisible: false,
    controlVisible: true
  };
  
  // Create a new BrowserWindow
  function createWindow(options = {}) {
    const { BrowserWindow } = require('electron');
    
    const windowOptions = {
      width: 800,
      height: 600,
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        preload: `${__dirname}/../preload.cjs`
      },
      ...options
    };
    
    const win = new BrowserWindow(windowOptions);
    
    // Load appropriate URL based on environment
    if (isDev) {
      win.loadURL(VITE_DEV_SERVER_URL);
    } else {
      win.loadFile(`${__dirname}/../dist/index.html`);
    }
    
    // Open DevTools in development mode
    if (isDev && options.showDevTools !== false) {
      win.webContents.openDevTools();
    }
    
    // Handle window closing
    win.on('close', (event) => {
      // If the app is quitting, allow the window to close
      if (!win.isDestroyed()) {
        // For now, we'll just hide the window instead of closing it
        // In a real implementation, you might want to handle this differently
        if (!win.isClosable()) {
          event.preventDefault();
          win.hide();
        }
      }
    });
    
    return win;
  }
  
  // Ensure control window exists
  function ensureControlWindow() {
    if (!controlWindow || controlWindow.isDestroyed()) {
      controlWindow = createWindow({
        title: `Predicto Control v${APP_VERSION}`,
        width: 1000,
        height: 700,
        minWidth: 800,
        minHeight: 600
      });
      
      // Show the window when ready
      controlWindow.once('ready-to-show', () => {
        controlWindow.show();
      });
    }
    
    return controlWindow;
  }
  
  // Ensure overlay window exists
  function ensureOverlayWindow() {
    if (!overlayWindow || overlayWindow.isDestroyed()) {
      overlayWindow = createWindow({
        title: 'Predicto Overlay',
        width: 400,
        height: 300,
        frame: false, // No window frame
        transparent: true, // Transparent background
        alwaysOnTop: true, // Always on top of other windows
        skipTaskbar: true // Don't show in taskbar
      });
      
      // Show the window when ready
      overlayWindow.once('ready-to-show', () => {
        overlayWindow.show();
      });
    }
    
    return overlayWindow;
  }
  
  // Ensure ticker window exists
  function ensureTickerWindow() {
    if (!tickerWindow || tickerWindow.isDestroyed()) {
      tickerWindow = createWindow({
        title: 'Predicto Ticker',
        width: 300,
        height: 150,
        frame: false, // No window frame
        transparent: true, // Transparent background
        alwaysOnTop: true, // Always on top of other windows
        skipTaskbar: true // Don't show in taskbar
      });
      
      // Show the window when ready
      tickerWindow.once('ready-to-show', () => {
        tickerWindow.show();
      });
    }
    
    return tickerWindow;
  }
  
  // Ensure reaction window exists
  function ensureReactionWindow() {
    if (!reactionWindow || reactionWindow.isDestroyed()) {
      reactionWindow = createWindow({
        title: 'Predicto Reaction',
        width: 200,
        height: 200,
        frame: false, // No window frame
        transparent: true, // Transparent background
        alwaysOnTop: true, // Always on top of other windows
        skipTaskbar: true // Don't show in taskbar
      });
      
      // Show the window when ready
      reactionWindow.once('ready-to-show', () => {
        reactionWindow.show();
      });
    }
    
    return reactionWindow;
  }
  
  // Update window titles with match info
  function updateWindowTitles(matchInfo) {
    const windows = [controlWindow, overlayWindow, tickerWindow, reactionWindow];
    windows.forEach(win => {
      if (win && !win.isDestroyed()) {
        win.setTitle(`Predicto - ${matchInfo}`);
      }
    });
  }
  
  // Get current settings
  function getSettings() {
    return { ...settings };
  }
  
  // Update settings
  function updateSettings(newSettings) {
    settings = { ...settings, ...newSettings };
    
    // Show/hide windows based on settings
    if (settings.overlayVisible) {
      ensureOverlayWindow();
    } else if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.hide();
    }
    
    if (settings.tickerVisible) {
      ensureTickerWindow();
    } else if (tickerWindow && !tickerWindow.isDestroyed()) {
      tickerWindow.hide();
    }
    
    if (settings.reactionVisible) {
      ensureReactionWindow();
    } else if (reactionWindow && !reactionWindow.isDestroyed()) {
      reactionWindow.hide();
    }
    
    // Broadcast settings update to clients via WebSocket
    if (broadcastToClients) {
      broadcastToClients(JSON.stringify({
        type: 'settings-update',
        payload: settings
      }));
    }
  }
  
  // Register keyboard shortcuts
  function registerShortcuts() {
    const { globalShortcut } = require('electron');
    
    // Register shortcuts for toggling windows
    globalShortcut.register('Ctrl+Shift+O', () => {
      updateSettings({ overlayVisible: !settings.overlayVisible });
    });
    
    globalShortcut.register('Ctrl+Shift+T', () => {
      updateSettings({ tickerVisible: !settings.tickerVisible });
    });
    
    globalShortcut.register('Ctrl+Shift+R', () => {
      updateSettings({ reactionVisible: !settings.reactionVisible });
    });
    
    globalShortcut.register('Ctrl+Shift+C', () => {
      // Toggle control window visibility
      if (controlWindow && !controlWindow.isDestroyed()) {
        if (controlWindow.isVisible()) {
          controlWindow.hide();
        } else {
          controlWindow.show();
        }
      }
    });
  }
  
  // Unregister keyboard shortcuts
  function unregisterShortcuts() {
    const { globalShortcut } = require('electron');
    globalShortcut.unregisterAll();
  }
  
  // Return public API
  return {
    createWindow,
    ensureControlWindow,
    ensureOverlayWindow,
    ensureTickerWindow,
    ensureReactionWindow,
    updateWindowTitles,
    getSettings,
    updateSettings,
    registerShortcuts,
    unregisterShortcuts
  };
}

module.exports = {
  createWindowManager
};