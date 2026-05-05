/**
 * Window Manager Module
 * Manages all Electron windows and their lifecycle
 */

const { BrowserWindow, globalShortcut, app } = require("electron");

const createWindowManager = (config, deps) => {
  const { 
    getWindowUrl, 
    commonWebPrefs, 
    DEFAULT_SETTINGS,
    saveSettingsToFile,
    loadSettings
  } = config;
  
  const { broadcastToClients } = deps;

  let controlWindow = null;
  let overlayWindow = null;
  let tickerWindow = null;
  let reactionWindow = null;
  let debugWindow = null;
  let settings = loadSettings();

  // ── Broadcast State ─────────────────────────────────────────────────────────
  const broadcastState = () => {
    if (controlWindow && !controlWindow.isDestroyed()) {
      controlWindow.webContents.send("settings:changed", settings);
    }
  };

  // ── Apply Overlay Flags ─────────────────────────────────────────────────────
  const applyOverlayFlags = () => {
    const currentMode = global.APP_MODE || settings.firebaseMode || config.APP_MODE;
    
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.setAlwaysOnTop(true, "screen-saver");
      overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      overlayWindow.setIgnoreMouseEvents(settings.clickThrough, { forward: true });
      overlayWindow.setOpacity(settings.opacity);
    }
    if (tickerWindow && !tickerWindow.isDestroyed()) {
      tickerWindow.setAlwaysOnTop(true, "screen-saver");
      tickerWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      tickerWindow.setIgnoreMouseEvents(settings.clickThrough, { forward: true });
      tickerWindow.setOpacity(settings.opacity);
    }
    if (reactionWindow && !reactionWindow.isDestroyed()) {
      reactionWindow.setAlwaysOnTop(true, "screen-saver");
      reactionWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      reactionWindow.setIgnoreMouseEvents(false);
      const reactOp = settings.reactionOpacity !== undefined ? settings.reactionOpacity : settings.opacity;
      reactionWindow.setOpacity(reactOp);
    }
  };

  // ── Persist Bounds ──────────────────────────────────────────────────────────
  const persistOverlayBounds = () => {
    if (!overlayWindow || overlayWindow.isDestroyed()) return;
    const bounds = overlayWindow.getBounds();
    settings.bounds = { width: bounds.width, height: bounds.height, x: bounds.x, y: bounds.y };
    saveSettingsToFile(settings);
    broadcastState();
  };

  const persistTickerBounds = () => {
    if (!tickerWindow || tickerWindow.isDestroyed()) return;
    const bounds = tickerWindow.getBounds();
    settings.tickerBounds = { width: bounds.width, height: bounds.height, x: bounds.x, y: bounds.y };
    saveSettingsToFile(settings);
    broadcastState();
  };

  const persistReactionBounds = () => {
    if (!reactionWindow || reactionWindow.isDestroyed()) return;
    const bounds = reactionWindow.getBounds();
    settings.reactionBounds = { width: bounds.width, height: bounds.height, x: bounds.x, y: bounds.y };
    saveSettingsToFile(settings);
    broadcastState();
  };

  // ── Update Window Titles ────────────────────────────────────────────────────
  const updateWindowTitles = (matchInfo) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.setTitle(`Overlay - ${matchInfo}`);
    }
    if (tickerWindow && !tickerWindow.isDestroyed()) {
      tickerWindow.setTitle(`Ticker - ${matchInfo}`);
    }
    if (reactionWindow && !reactionWindow.isDestroyed()) {
      reactionWindow.setTitle(`Reaction - ${matchInfo}`);
    }
  };

  // ── Window Creation ─────────────────────────────────────────────────────────
  const ensureOverlayWindow = () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) return overlayWindow;
    const currentMode = global.APP_MODE || settings.firebaseMode || config.APP_MODE;
    overlayWindow = new BrowserWindow({
      ...settings.bounds, show: false, frame: false, transparent: true, hasShadow: false,
      title: "Overlay", darkTheme: true, roundedCorners: false, autoHideMenuBar: true,
      resizable: true, movable: true, fullscreenable: false, skipTaskbar: false,
      backgroundColor: "#00000000", webPreferences: commonWebPrefs
    });
    overlayWindow.loadURL(getWindowUrl("overlay", currentMode, settings));
    overlayWindow.setMenuBarVisibility(false);
    overlayWindow.removeMenu();
    overlayWindow.on("page-title-updated", (e) => e.preventDefault());
    overlayWindow.once("ready-to-show", () => {
      applyOverlayFlags();
      if (settings.overlayVisible) overlayWindow.showInactive();
    });
    overlayWindow.on("move", persistOverlayBounds);
    overlayWindow.on("resize", persistOverlayBounds);
    overlayWindow.on("closed", () => { overlayWindow = null; });
    return overlayWindow;
  };

  const ensureTickerWindow = () => {
    if (tickerWindow && !tickerWindow.isDestroyed()) return tickerWindow;
    const currentMode = global.APP_MODE || settings.firebaseMode || config.APP_MODE;
    tickerWindow = new BrowserWindow({
      ...settings.tickerBounds, show: false, frame: false, transparent: true, hasShadow: false,
      title: " ", darkTheme: true, roundedCorners: false, autoHideMenuBar: true,
      resizable: true, movable: true, focusable: true, fullscreenable: false, skipTaskbar: false,
      backgroundColor: "#00000000", webPreferences: commonWebPrefs
    });
    tickerWindow.loadURL(getWindowUrl("ticker", currentMode, settings));
    tickerWindow.setMenuBarVisibility(false);
    tickerWindow.removeMenu();
    tickerWindow.on("page-title-updated", (e) => e.preventDefault());
    tickerWindow.once("ready-to-show", () => {
      applyOverlayFlags();
      if (settings.tickerVisible) tickerWindow.showInactive();
    });
    tickerWindow.on("move", persistTickerBounds);
    tickerWindow.on("resize", persistTickerBounds);
    tickerWindow.on("closed", () => { tickerWindow = null; });
    return tickerWindow;
  };

  const ensureReactionWindow = () => {
    if (reactionWindow && !reactionWindow.isDestroyed()) return reactionWindow;
    const currentMode = global.APP_MODE || settings.firebaseMode || config.APP_MODE;
    reactionWindow = new BrowserWindow({
      ...settings.reactionBounds, show: false, frame: false, transparent: true, hasShadow: false,
      title: " ", darkTheme: true, roundedCorners: false, autoHideMenuBar: true,
      resizable: true, movable: true, focusable: true, fullscreenable: false, skipTaskbar: false,
      minWidth: 150, minHeight: 178, backgroundColor: "#00000000", webPreferences: commonWebPrefs
    });
    reactionWindow.loadURL(getWindowUrl("reaction", currentMode, settings));
    reactionWindow.setMenuBarVisibility(false);
    reactionWindow.removeMenu();
    reactionWindow.on("page-title-updated", (e) => e.preventDefault());
    let resizing = false;
    reactionWindow.on("resize", () => {
      if (resizing) return;
      resizing = true;
      const [w, h] = reactionWindow.getSize();
      const targetH = w + 28;
      if (Math.abs(h - targetH) > 2) reactionWindow.setSize(w, targetH);
      resizing = false;
    });
    reactionWindow.once("ready-to-show", () => {
      applyOverlayFlags();
      if (settings.reactionVisible) reactionWindow.showInactive();
    });
    reactionWindow.on("move", persistReactionBounds);
    reactionWindow.on("resize", persistReactionBounds);
    reactionWindow.on("closed", () => { reactionWindow = null; });
    return reactionWindow;
  };

  const ensureDebugWindow = () => {
    if (debugWindow && !debugWindow.isDestroyed()) {
      debugWindow.focus();
      return debugWindow;
    }
    const currentMode = global.APP_MODE || settings.firebaseMode || config.APP_MODE;
    debugWindow = new BrowserWindow({
      width: 980, height: 720,
      minWidth: 760,
      minHeight: 520,
      title: "System Debug Log",
      autoHideMenuBar: true,
      backgroundColor: "#020617",
      webPreferences: commonWebPrefs
    });
    debugWindow.loadURL(getWindowUrl("debug", currentMode, settings));
    debugWindow.on("closed", () => { debugWindow = null; });
    return debugWindow;
  };

  const ensureControlWindow = () => {
    if (controlWindow && !controlWindow.isDestroyed()) { 
      controlWindow.focus(); 
      return controlWindow; 
    }
    const currentMode = global.APP_MODE || settings.firebaseMode || config.APP_MODE;
    controlWindow = new BrowserWindow({
      width: 800, height: 760, minWidth: 680, minHeight: 720,
      autoHideMenuBar: true, backgroundColor: "#08121e", webPreferences: commonWebPrefs
    });
    controlWindow.loadURL(getWindowUrl("control", currentMode, settings));
    controlWindow.on("closed", () => {
      if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.destroy();
      if (tickerWindow && !tickerWindow.isDestroyed()) tickerWindow.destroy();
      if (reactionWindow && !reactionWindow.isDestroyed()) reactionWindow.destroy();
      controlWindow = null;
    });
    return controlWindow;
  };

  // ── Settings Management ─────────────────────────────────────────────────────
  const updateSettings = (partial) => {
    settings = {
      ...settings,
      ...partial,
      bounds: { ...settings.bounds, ...(partial.bounds || {}) }
    };
    saveSettingsToFile(settings);
    applyOverlayFlags();
    broadcastState();
    return settings;
  };

  const getSettings = () => settings;

  // ── Shortcuts ───────────────────────────────────────────────────────────────
  const registerShortcuts = () => {
    globalShortcut.register("CommandOrControl+Shift+X", () => {
      updateSettings({ clickThrough: !settings.clickThrough });
    });
    globalShortcut.register("CommandOrControl+Shift+O", () => {
      const win = ensureOverlayWindow();
      settings.overlayVisible = true;
      saveSettingsToFile(settings);
      win.showInactive();
      broadcastState();
    });
  };

  const unregisterShortcuts = () => {
    globalShortcut.unregisterAll();
  };

  // ── Window Getters ──────────────────────────────────────────────────────────
  const getControlWindow = () => controlWindow;
  const getOverlayWindow = () => overlayWindow;
  const getTickerWindow = () => tickerWindow;
  const getReactionWindow = () => reactionWindow;
  const getDebugWindow = () => debugWindow;

  return {
    // Window creation
    ensureControlWindow,
    ensureOverlayWindow,
    ensureTickerWindow,
    ensureReactionWindow,
    ensureDebugWindow,
    // Settings
    updateSettings,
    getSettings,
    // Window state
    applyOverlayFlags,
    broadcastState,
    // Window titles
    updateWindowTitles,
    // Shortcuts
    registerShortcuts,
    unregisterShortcuts,
    // Getters
    getControlWindow,
    getOverlayWindow,
    getTickerWindow,
    getReactionWindow,
    getDebugWindow
  };
};

module.exports = {
  createWindowManager
};
