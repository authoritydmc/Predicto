/**
 * IPC Handlers Module
 * Registers all IPC handlers for the Electron main process
 */

const { ipcMain, clipboard, shell } = require("electron");
const path = require("path");
const fs = require("fs");

const registerIpcHandlers = (config, windowManager, scheduler, deps) => {
  const { 
    APP_MODE, 
    DEFAULT_SETTINGS,
    saveSettingsToFile,
    getWindowUrl
  } = config;

  // ── Settings Handlers ──────────────────────────────────────────────────────
  ipcMain.handle("settings:get", () => windowManager.getSettings());
  ipcMain.handle("settings:update", (_event, partial) => windowManager.updateSettings(partial));
  
  ipcMain.handle("settings:set-window-visibility", (_event, visibility) => {
    const settings = windowManager.getSettings();
    console.log('[Settings] Setting window visibility defaults:', visibility);
    settings.overlayVisible = visibility.overlayVisible;
    settings.tickerVisible = visibility.tickerVisible;
    settings.reactionVisible = visibility.reactionVisible;
    saveSettingsToFile(settings);
    return settings;
  });

  ipcMain.handle("firebase:set-mode", (_event, mode) => {
    console.log(`[Firebase] Switching mode to: ${mode}`);
    const settings = windowManager.getSettings();
    settings.firebaseMode = mode;
    saveSettingsToFile(settings);
    windowManager.broadcastState();
    return settings;
  });

  const currentMode = () => global.APP_MODE || windowManager.getSettings().firebaseMode || APP_MODE;

  const windowActions = {
    overlay: {
      ensure: windowManager.ensureOverlayWindow,
      get: windowManager.getOverlayWindow,
      visibleKey: "overlayVisible",
      boundsKey: "bounds",
      defaultBounds: DEFAULT_SETTINGS.bounds
    },
    ticker: {
      ensure: windowManager.ensureTickerWindow,
      get: windowManager.getTickerWindow,
      visibleKey: "tickerVisible",
      boundsKey: "tickerBounds",
      defaultBounds: DEFAULT_SETTINGS.tickerBounds
    },
    reaction: {
      ensure: windowManager.ensureReactionWindow,
      get: windowManager.getReactionWindow,
      visibleKey: "reactionVisible",
      boundsKey: "reactionBounds",
      defaultBounds: DEFAULT_SETTINGS.reactionBounds
    }
  };

  const showManagedWindow = (key) => {
    const config = windowActions[key];
    const win = config.ensure();
    const settings = windowManager.getSettings();
    settings[config.visibleKey] = true;
    saveSettingsToFile(settings); 
    windowManager.applyOverlayFlags(); 
    win.showInactive(); 
    windowManager.broadcastState();
    return settings;
  };

  const hideManagedWindow = (key) => {
    const config = windowActions[key];
    const win = config.get();
    if (win && !win.isDestroyed()) win.hide();
    const settings = windowManager.getSettings();
    settings[config.visibleKey] = false;
    saveSettingsToFile(settings); 
    windowManager.broadcastState();
    return settings;
  };

  const reloadManagedWindow = (key) => {
    const config = windowActions[key];
    const win = config.ensure();
    const settings = windowManager.getSettings();
    win.loadURL(getWindowUrl(key, currentMode(), settings));
    return settings;
  };

  const resetManagedWindowBounds = (key) => {
    const config = windowActions[key];
    const settings = windowManager.getSettings();
    settings[config.boundsKey] = { ...config.defaultBounds };
    saveSettingsToFile(settings);
    const win = config.ensure();
    win.setBounds(settings[config.boundsKey]);
    windowManager.broadcastState();
    return settings;
  };

  Object.keys(windowActions).forEach((key) => {
    ipcMain.handle(`${key}:show`, () => showManagedWindow(key));
    ipcMain.handle(`${key}:hide`, () => hideManagedWindow(key));
    ipcMain.handle(`${key}:reload`, () => reloadManagedWindow(key));
  });

  ipcMain.handle("overlay:reset-bounds", () => resetManagedWindowBounds("overlay"));
  ipcMain.handle("ticker:reset-bounds", () => resetManagedWindowBounds("ticker"));
  ipcMain.handle("reaction:reset-bounds", () => resetManagedWindowBounds("reaction"));
  
  ipcMain.handle("overlay:toggle-click-through", () => {
    const settings = windowManager.getSettings();
    return windowManager.updateSettings({ clickThrough: !settings.clickThrough });
  });
  
  ipcMain.handle("overlay:open-controls", () => { 
    windowManager.ensureControlWindow(); 
    return true; 
  });

  // ── Debug Window Handlers ────────────────────────────────────────────────────
  ipcMain.handle("debug:show", () => {
    windowManager.ensureDebugWindow();
    return true;
  });

  // ── External/Clipboard Handlers ──────────────────────────────────────────────
  ipcMain.handle("external:open", (_event, url) => shell.openExternal(url));
  ipcMain.handle("clipboard:write-text", (_event, value) => { 
    clipboard.writeText(value || ""); 
    return true; 
  });

  // ── CSV Handler ─────────────────────────────────────────────────────────────
  ipcMain.handle("csv:get-schedule", () => {
    try { 
      return fs.readFileSync(path.join(__dirname, "../..", "schedule_2026_ipl.csv"), "utf8"); 
    }
    catch { 
      return null; 
    }
  });

  console.log('[IPC] Core handlers registered');
};

module.exports = {
  registerIpcHandlers
};
