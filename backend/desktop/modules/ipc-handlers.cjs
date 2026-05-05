/**
 * IPC Handlers Module
 * Registers all IPC handlers for the Electron main process
 */

const { ipcMain, clipboard, shell, BrowserWindow, app } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const registerIpcHandlers = (config, windowManager, scheduler, deps) => {
  const { 
    APP_MODE, 
    isDev, 
    VITE_DEV_SERVER_URL, 
    DEFAULT_SETTINGS,
    saveSettingsToFile,
    getWindowUrl,
    commonWebPrefs
  } = config;
  
  const { broadcastToClients } = deps;

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

  // ── Overlay Window Handlers ──────────────────────────────────────────────────
  ipcMain.handle("overlay:show", () => {
    const win = windowManager.ensureOverlayWindow();
    const settings = windowManager.getSettings();
    settings.overlayVisible = true; 
    saveSettingsToFile(settings); 
    windowManager.applyOverlayFlags(); 
    win.showInactive(); 
    windowManager.broadcastState();
    return settings;
  });
  
  ipcMain.handle("overlay:hide", () => {
    const overlayWindow = windowManager.getOverlayWindow();
    if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.hide();
    const settings = windowManager.getSettings();
    settings.overlayVisible = false; 
    saveSettingsToFile(settings); 
    windowManager.broadcastState();
    return settings;
  });
  
  ipcMain.handle("overlay:reload", () => {
    const win = windowManager.ensureOverlayWindow();
    const settings = windowManager.getSettings();
    const currentMode = global.APP_MODE || settings.firebaseMode || APP_MODE;
    win.loadURL(getWindowUrl("overlay", currentMode, settings));
    return settings;
  });
  
  ipcMain.handle("overlay:reset-bounds", () => {
    const settings = windowManager.getSettings();
    settings.bounds = { ...DEFAULT_SETTINGS.bounds }; 
    saveSettingsToFile(settings);
    const win = windowManager.ensureOverlayWindow(); 
    win.setBounds(settings.bounds); 
    windowManager.broadcastState();
    return settings;
  });
  
  ipcMain.handle("overlay:toggle-click-through", () => {
    const settings = windowManager.getSettings();
    return windowManager.updateSettings({ clickThrough: !settings.clickThrough });
  });
  
  ipcMain.handle("overlay:open-controls", () => { 
    windowManager.ensureControlWindow(); 
    return true; 
  });

  // ── Ticker Window Handlers ───────────────────────────────────────────────────
  ipcMain.handle("ticker:show", () => {
    const win = windowManager.ensureTickerWindow();
    const settings = windowManager.getSettings();
    settings.tickerVisible = true; 
    saveSettingsToFile(settings); 
    windowManager.applyOverlayFlags(); 
    win.showInactive(); 
    windowManager.broadcastState();
    return settings;
  });
  
  ipcMain.handle("ticker:hide", () => {
    const tickerWindow = windowManager.getTickerWindow();
    if (tickerWindow && !tickerWindow.isDestroyed()) tickerWindow.hide();
    const settings = windowManager.getSettings();
    settings.tickerVisible = false; 
    saveSettingsToFile(settings); 
    windowManager.broadcastState();
    return settings;
  });
  
  ipcMain.handle("ticker:reload", () => {
    const win = windowManager.ensureTickerWindow();
    const settings = windowManager.getSettings();
    const currentMode = global.APP_MODE || settings.firebaseMode || APP_MODE;
    win.loadURL(getWindowUrl("ticker", currentMode, settings));
    return settings;
  });
  
  ipcMain.handle("ticker:reset-bounds", () => {
    const settings = windowManager.getSettings();
    settings.tickerBounds = { ...DEFAULT_SETTINGS.tickerBounds }; 
    saveSettingsToFile(settings);
    const win = windowManager.ensureTickerWindow(); 
    win.setBounds(settings.tickerBounds); 
    windowManager.broadcastState();
    return settings;
  });

  // ── Reaction Window Handlers ─────────────────────────────────────────────────
  ipcMain.handle("reaction:show", () => {
    const win = windowManager.ensureReactionWindow();
    const settings = windowManager.getSettings();
    settings.reactionVisible = true; 
    saveSettingsToFile(settings); 
    windowManager.applyOverlayFlags(); 
    win.showInactive(); 
    windowManager.broadcastState();
    return settings;
  });
  
  ipcMain.handle("reaction:hide", () => {
    const reactionWindow = windowManager.getReactionWindow();
    if (reactionWindow && !reactionWindow.isDestroyed()) reactionWindow.hide();
    const settings = windowManager.getSettings();
    settings.reactionVisible = false; 
    saveSettingsToFile(settings); 
    windowManager.broadcastState();
    return settings;
  });
  
  ipcMain.handle("reaction:reload", () => {
    const win = windowManager.ensureReactionWindow();
    const settings = windowManager.getSettings();
    const currentMode = global.APP_MODE || settings.firebaseMode || APP_MODE;
    win.loadURL(getWindowUrl("reaction", currentMode, settings));
    return settings;
  });
  
  ipcMain.handle("reaction:reset-bounds", () => {
    const settings = windowManager.getSettings();
    settings.reactionBounds = { ...DEFAULT_SETTINGS.reactionBounds }; 
    saveSettingsToFile(settings);
    const win = windowManager.ensureReactionWindow(); 
    win.setBounds(settings.reactionBounds); 
    windowManager.broadcastState();
    return settings;
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
