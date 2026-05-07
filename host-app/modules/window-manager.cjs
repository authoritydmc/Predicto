// Window Manager Module for Predicto Host App
// This module manages the creation and control of Electron windows

function createWindowManager(config, eventHandlers) {
  const { APP_MODE, isDev, APP_VERSION } = config;
  const { broadcastToClients } = eventHandlers || {};
  
  // Store window references
  let controlWindow = null;
  let overlayWindow = null;
  let tickerWindow = null;
  let reactionWindow = null;
  let debugWindow = null;
  
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
    const { route = '/' } = options; // Extract route from options
    
    const windowOptions = {
      width: options.width || 1200,
      height: options.height || 800,
      show: false,
      frame: true,
      transparent: false,
      backgroundColor: '#000000',
      vibrancy: false,
      hasShadow: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        webSecurity: true,
        preload: `${__dirname}/../preload.cjs`,
        // Performance optimizations
        backgroundThrottling: false,
        offscreen: false,
        experimentalFeatures: {
          canvas: true,
          webgl: true,
          webgpu: true
        },
        // Enable devTools in development
        devTools: isDev || false
      },
      ...options
    };
    
    const win = new BrowserWindow(windowOptions);
    
    // Add page loading event handlers for debugging
    win.webContents.on('did-start-loading', () => {
      console.log('Page started loading...');
    });
    
    win.webContents.on('did-finish-load', () => {
      console.log('Page finished loading successfully');
    });
    
    win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Page failed to load:', errorCode, errorDescription);
    });
    
    win.webContents.on('dom-ready', () => {
      console.log('DOM is ready - content should be visible');
    });
    
    // Load React app - use Vite dev server in dev mode, file in prod
    console.log(`[WindowManager] isDev: ${isDev}, route: ${route}, options:`, options);
    if (isDev) {
      const port = 5174; // Use the same port as vite.config.ts
      const devUrl = `http://localhost:${port}/#${route}`;
      console.log(`[WindowManager] Loading from Vite dev server: ${devUrl}`);
      
      // Wait a bit for Vite to be ready
      setTimeout(() => {
        win.loadURL(devUrl).then(() => {
          console.log(`[WindowManager] React app loaded from dev server for route: ${route}`);
        }).catch(err => {
          console.error('[WindowManager] Failed to load from dev server:', err);
        });
      }, 2000);
    } else {
      // Load built files with hash route
      const indexPath = `${__dirname}/../index.html#${route}`;
      console.log(`Loading React app: ${indexPath}`);
      win.loadFile(indexPath, { hash: route }).then(() => {
        console.log(`React app loaded successfully for route: ${route}`);
      }).catch(err => {
        console.error('Failed to load React app:', err);
      });
    }
    
    // DevTools can be opened manually by user in development mode
    // Removed automatic opening to allow manual control
    
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
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [WindowManager] ensureControlWindow called`);
    
    // Check if window already exists and is not destroyed
    if (controlWindow && !controlWindow.isDestroyed()) {
      console.log(`[${timestamp}] [WindowManager] Control window already exists, ID: ${controlWindow.id}, returning existing instance`);
      return controlWindow;
    }
    
    console.log(`[${timestamp}] [WindowManager] Creating new control window`);
    controlWindow = createWindow({
      title: `Predicto Control v${APP_VERSION}`,
      width: 650,
      height: 900,
      minWidth: 650,
      minHeight: 500,
      isDev: isDev,
      route: '/'
    });
    
    // Show the window when ready
    controlWindow.once('ready-to-show', () => {
      console.log(`[${timestamp}] [WindowManager] Control window ready to show, ID: ${controlWindow.id}`);
      controlWindow.show();
      // Try to maximize to fill screen
      controlWindow.maximize();
    });
    
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
        skipTaskbar: true, // Don't show in taskbar
        route: '/overlay'
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
        skipTaskbar: true, // Don't show in taskbar
        route: '/ticker'
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
        skipTaskbar: true, // Don't show in taskbar
        route: '/reaction'
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
  
  // Ensure debug window exists
  function ensureDebugWindow() {
    if (!debugWindow || debugWindow.isDestroyed()) {
      console.log('[WindowManager] Creating debug window...');
      debugWindow = createWindow({
        title: 'Predicto Debug',
        width: 1200,
        height: 800,
        isDev: isDev,
        route: '/debug'
      });
      
      // Show window when ready
      debugWindow.once('ready-to-show', () => {
        console.log('[WindowManager] Debug window ready to show');
        debugWindow.show();
      });
      
      // Load debug route after window is ready
      debugWindow.webContents.once('did-finish-load', () => {
        console.log('[WindowManager] Debug window finished loading, navigating to debug route');
        // Navigate to debug route
        debugWindow.webContents.executeJavaScript(`
          window.location.hash = '#/debug';
        `);
      });
    } else {
      console.log('[WindowManager] Debug window already exists');
    }
    
    return debugWindow;
  }
  
  // Return public API
  return {
    createWindow,
    ensureControlWindow,
    ensureOverlayWindow,
    ensureTickerWindow,
    ensureReactionWindow,
    ensureDebugWindow,
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