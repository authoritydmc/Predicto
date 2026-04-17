const { app, BrowserWindow, clipboard, globalShortcut, ipcMain, shell } = require("electron");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");
const { version: APP_VERSION } = require("../../package.json");

// Enable hot reload in dev/local mode
const isDev = process.env.NODE_ENV === "development";
if (isDev) {
  try {
    require("electron-reload")(__dirname, {
      electron: path.resolve(__dirname, "../../node_modules/.bin/electron"),
      awaitWriteFinish: {
        stabilityWaitTime: 500,
        pollInterval: 100
      },
      // Watch both frontend folders and HTML files
      glob: [
        path.join(__dirname, "**/*.{js,html,css}"),
        path.join(__dirname, "..", "assets", "**/*.{js,html,css}")
      ]
    });
  } catch (e) {
    console.warn("electron-reload not available (only for development):", e.message);
  }
}

const rawAppMode = process.env.APP_MODE || process.env.NODE_ENV || "production";
const APP_MODE = (() => {
  const normalized = rawAppMode.toLowerCase();
  if (normalized === "local") return "local";
  if (normalized === "dev" || normalized === "development") return "dev";
  return "prod";
})();

const DEFAULT_SETTINGS = {
  appVersion: APP_VERSION,
  roomId: "ipl",
  overlayBaseUrl: APP_MODE === "local" ? "http://localhost:4173/overlay.html" : "https://overlaychat-6f3c1.web.app/o",
  clickThrough: false,
  overlayVisible: true,
  opacity: 1,
  reactionOpacity: 1,
  bounds: {
    width: 462,
    height: 924,
    x: 80,
    y: 60
  },
  tickerVisible: false,
  tickerBounds: {
    width: 1200,
    height: 60,
    x: 100,
    y: 800
  },
  reactionVisible: true,
  reactionBounds: {
    width: 320,
    height: 350,
    x: 50,
    y: 50
  }
};

// === WEBSOCKET SERVER FOR CROSS-WINDOW LOGGING ===
const WS_PORT = 9999;
let wss = null;
let wsClients = new Set();
let wsLogBuffer = [];
const WS_MAX_LOGS = 1000;

const initWebSocketServer = () => {
  try {
    wss = new WebSocket.Server({ port: WS_PORT });
    
    wss.on("connection", (ws) => {
      wsClients.add(ws);
      console.log(`[WebSocket] Client connected. Total clients: ${wsClients.size}`);
      
      // Send existing logs to the newly connected client
      ws.send(JSON.stringify({ type: "logs-batch", data: wsLogBuffer }));
      
      ws.on("message", (message) => {
        try {
          const parsed = JSON.parse(message);
          
          if (parsed.type === "log") {
            // Store and broadcast log to all clients
            const logEntry = {
              level: parsed.level,
              message: parsed.message,
              timestamp: parsed.timestamp,
              window: parsed.window || "Unknown"
            };
            
            wsLogBuffer.unshift(logEntry);
            if (wsLogBuffer.length > WS_MAX_LOGS) {
              wsLogBuffer.pop();
            }
            
            // Broadcast to all connected clients
            const broadcastMsg = JSON.stringify({ type: "log", data: logEntry });
            wsClients.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(broadcastMsg);
              }
            });
          }
        } catch (err) {
          console.error("[WebSocket] Error processing message:", err.message);
        }
      });
      
      ws.on("close", () => {
        wsClients.delete(ws);
        console.log(`[WebSocket] Client disconnected. Total clients: ${wsClients.size}`);
      });
      
      ws.on("error", (err) => {
        console.error("[WebSocket] Client error:", err.message);
      });
    });
    
    console.log(`[WebSocket] Server started on ws://localhost:${WS_PORT}`);
  } catch (err) {
    console.error("[WebSocket] Failed to start server:", err.message);
  }
};

let controlWindow = null;
let overlayWindow = null;
let tickerWindow = null;
let reactionWindow = null;
let debugWindow = null;
let debugWindowLogs = [];

const settingsPath = () => path.join(app.getPath("userData"), "settings.json");

const loadSettings = () => {
  try {
    const raw = fs.readFileSync(settingsPath(), "utf8");
    const parsed = JSON.parse(raw);

    if (parsed.appVersion !== APP_VERSION) {
      return { ...DEFAULT_SETTINGS };
    }

    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      bounds: {
        ...DEFAULT_SETTINGS.bounds,
        ...(parsed.bounds || {})
      },
      tickerBounds: {
        ...DEFAULT_SETTINGS.tickerBounds,
        ...(parsed.tickerBounds || {})
      },
      reactionBounds: {
        ...DEFAULT_SETTINGS.reactionBounds,
        ...(parsed.reactionBounds || {})
      }
    };
  } catch (error) {
    return { ...DEFAULT_SETTINGS };
  }
};

let settings = loadSettings();

const saveSettings = () => {
  settings.appVersion = APP_VERSION;
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2));
};

const getOverlayQuery = () => ({
  room: settings.roomId,
  mode: "desktop",
  appMode: APP_MODE
});

const loadOverlayPage = (window) => {
  window.loadFile(path.join(__dirname, "..", "overlay.html"), {
    query: getOverlayQuery()
  });
};

const loadTickerPage = (window) => {
  window.loadFile(path.join(__dirname, "..", "ticker.html"), {
    query: getOverlayQuery()
  });
};

const loadReactionPage = (window) => {
  window.loadFile(path.join(__dirname, "..", "reaction.html"), {
    query: getOverlayQuery()
  });
};

const broadcastState = () => {
  if (controlWindow && !controlWindow.isDestroyed()) {
    controlWindow.webContents.send("settings:changed", settings);
  }
};

const applyOverlayFlags = () => {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    return;
  }

  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setIgnoreMouseEvents(settings.clickThrough, { forward: true });
  overlayWindow.setOpacity(settings.opacity);

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

const persistTickerBounds = () => {
  if (!tickerWindow || tickerWindow.isDestroyed()) {
    return;
  }

  const bounds = tickerWindow.getBounds();
  settings.tickerBounds = {
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y
  };
  saveSettings();
  broadcastState();
};

const persistReactionBounds = () => {
  if (!reactionWindow || reactionWindow.isDestroyed()) {
    return;
  }

  const bounds = reactionWindow.getBounds();
  settings.reactionBounds = {
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y
  };
  saveSettings();
  broadcastState();
};

const persistOverlayBounds = () => {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    return;
  }

  const bounds = overlayWindow.getBounds();
  settings.bounds = {
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y
  };
  saveSettings();
  broadcastState();
};

const ensureOverlayWindow = () => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    return overlayWindow;
  }

  overlayWindow = new BrowserWindow({
    ...settings.bounds,
    show: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    title: " ",
    minimizable: true,
    darkTheme: true,
    roundedCorners: false,
    autoHideMenuBar: true,
    resizable: true,
    movable: true,
    fullscreenable: false,
    skipTaskbar: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  loadOverlayPage(overlayWindow);
  overlayWindow.setMenuBarVisibility(false);
  overlayWindow.removeMenu();
  overlayWindow.on("page-title-updated", (e) => e.preventDefault());
  
  overlayWindow.once("ready-to-show", () => {
    applyOverlayFlags();
    if (settings.overlayVisible) {
      overlayWindow.showInactive();
    }
  });

  overlayWindow.on("move", persistOverlayBounds);
  overlayWindow.on("resize", persistOverlayBounds);
  overlayWindow.on("closed", () => {
    overlayWindow = null;
  });

  return overlayWindow;
};

const ensureTickerWindow = () => {
  if (tickerWindow && !tickerWindow.isDestroyed()) {
    return tickerWindow;
  }

  tickerWindow = new BrowserWindow({
    ...settings.tickerBounds,
    show: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    title: " ",
    minimizable: true,
    darkTheme: true,
    roundedCorners: false,
    autoHideMenuBar: true,
    resizable: true,
    movable: true,
    focusable: true,
    fullscreenable: false,
    skipTaskbar: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  loadTickerPage(tickerWindow);
  tickerWindow.setMenuBarVisibility(false);
  tickerWindow.removeMenu();
  tickerWindow.on("page-title-updated", (e) => e.preventDefault());
  
  tickerWindow.once("ready-to-show", () => {
    applyOverlayFlags();
    if (settings.tickerVisible) {
      tickerWindow.showInactive();
    }
  });

  tickerWindow.on("move", persistTickerBounds);
  tickerWindow.on("resize", persistTickerBounds);
  tickerWindow.on("closed", () => {
    tickerWindow = null;
  });

  return tickerWindow;
};

const ensureReactionWindow = () => {
  if (reactionWindow && !reactionWindow.isDestroyed()) {
    return reactionWindow;
  }

  reactionWindow = new BrowserWindow({
    ...settings.reactionBounds,
    show: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    title: " ",
    minimizable: true,
    darkTheme: true,
    roundedCorners: false,
    autoHideMenuBar: true,
    resizable: true,
    movable: true,
    focusable: true,
    fullscreenable: false,
    skipTaskbar: false,
    minWidth: 150,
    minHeight: 178,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  loadReactionPage(reactionWindow);
  reactionWindow.setMenuBarVisibility(false);
  reactionWindow.removeMenu();
  reactionWindow.on("page-title-updated", (e) => e.preventDefault());
  
  // Enforce square aspect ratio on resize (width = height - 28 for the from bar)
  let resizing = false;
  reactionWindow.on("resize", () => {
    if (resizing) return;
    resizing = true;
    const [w, h] = reactionWindow.getSize();
    const targetH = w + 28;
    if (Math.abs(h - targetH) > 2) {
      reactionWindow.setSize(w, targetH);
    }
    resizing = false;
  });

  reactionWindow.once("ready-to-show", () => {
    applyOverlayFlags();
    if (settings.reactionVisible) {
      reactionWindow.showInactive();
    }
  });

  reactionWindow.on("move", persistReactionBounds);
  reactionWindow.on("resize", persistReactionBounds);
  reactionWindow.on("closed", () => {
    reactionWindow = null;
  });

  return reactionWindow;
};

const ensureControlWindow = () => {
  if (controlWindow && !controlWindow.isDestroyed()) {
    controlWindow.focus();
    return controlWindow;
  }

  controlWindow = new BrowserWindow({
    width: 560,
    height: 760,
    minWidth: 420,
    minHeight: 720,
    minimizable: true,
    autoHideMenuBar: true,
    backgroundColor: "#08121e",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  controlWindow.loadFile(path.join(__dirname, "control.html"), {
    query: { appMode: APP_MODE }
  });
  controlWindow.on("closed", () => {
    // Destroy all associated windows when the control panel is closed
    if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.destroy();
    if (tickerWindow && !tickerWindow.isDestroyed()) tickerWindow.destroy();
    if (reactionWindow && !reactionWindow.isDestroyed()) reactionWindow.destroy();
    controlWindow = null;
  });

  return controlWindow;
};

const ensureDebugWindow = () => {
  if (debugWindow && !debugWindow.isDestroyed()) {
    debugWindow.focus();
    return debugWindow;
  }

  debugWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 400,
    minHeight: 300,
    show: true,
    minimizable: true,
    autoHideMenuBar: true,
    backgroundColor: "#0a0e27",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });

  debugWindow.loadFile(path.join(__dirname, "..", "debug.html"));
  
  if (isDev || process.env.DEBUG) {
    debugWindow.webContents.openDevTools();
  }

  debugWindow.on("closed", () => {
    debugWindow = null;
  });

  return debugWindow;
};

const updateSettings = (partial) => {
  settings = {
    ...settings,
    ...partial,
    bounds: {
      ...settings.bounds,
      ...(partial.bounds || {})
    }
  };

  saveSettings();
  applyOverlayFlags();

  if (overlayWindow && !overlayWindow.isDestroyed()) {
    loadOverlayPage(overlayWindow);
  }

  if (tickerWindow && !tickerWindow.isDestroyed()) {
    loadTickerPage(tickerWindow);
  }

  if (reactionWindow && !reactionWindow.isDestroyed()) {
    loadReactionPage(reactionWindow);
  }

  broadcastState();
  return settings;
};

const registerShortcuts = () => {
  globalShortcut.register("CommandOrControl+Shift+X", () => {
    updateSettings({ clickThrough: !settings.clickThrough });
  });

  globalShortcut.register("CommandOrControl+Shift+O", () => {
    const window = ensureOverlayWindow();
    settings.overlayVisible = true;
    saveSettings();
    window.showInactive();
    broadcastState();
  });
};

app.whenReady().then(() => {
  initWebSocketServer();
  ensureControlWindow();
  if (settings.overlayVisible) {
    ensureOverlayWindow();
  }
  if (settings.tickerVisible) {
    ensureTickerWindow();
  }
  if (settings.reactionVisible) {
    ensureReactionWindow();
  }
  registerShortcuts();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  ensureControlWindow();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

ipcMain.handle("settings:get", () => settings);
ipcMain.handle("settings:update", (_event, partial) => updateSettings(partial));

ipcMain.handle("overlay:show", () => {
  const window = ensureOverlayWindow();
  settings.overlayVisible = true;
  saveSettings();
  applyOverlayFlags();
  window.showInactive();
  broadcastState();
  return settings;
});

ipcMain.handle("overlay:hide", () => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.hide();
  }
  settings.overlayVisible = false;
  saveSettings();
  broadcastState();
  return settings;
});

ipcMain.handle("overlay:reload", () => {
  const window = ensureOverlayWindow();
  loadOverlayPage(window);
  return settings;
});

ipcMain.handle("ticker:show", () => {
  const window = ensureTickerWindow();
  settings.tickerVisible = true;
  saveSettings();
  applyOverlayFlags();
  window.showInactive();
  broadcastState();
  return settings;
});

ipcMain.handle("ticker:hide", () => {
  if (tickerWindow && !tickerWindow.isDestroyed()) {
    tickerWindow.hide();
  }
  settings.tickerVisible = false;
  saveSettings();
  broadcastState();
  return settings;
});

ipcMain.handle("ticker:reload", () => {
  const window = ensureTickerWindow();
  loadTickerPage(window);
  return settings;
});

ipcMain.handle("reaction:show", () => {
  const window = ensureReactionWindow();
  settings.reactionVisible = true;
  saveSettings();
  applyOverlayFlags();
  window.showInactive();
  broadcastState();
  return settings;
});

ipcMain.handle("reaction:hide", () => {
  if (reactionWindow && !reactionWindow.isDestroyed()) {
    reactionWindow.hide();
  }
  settings.reactionVisible = false;
  saveSettings();
  broadcastState();
  return settings;
});

ipcMain.handle("reaction:reload", () => {
  const window = ensureReactionWindow();
  loadReactionPage(window);
  return settings;
});

ipcMain.handle("reaction:reset-bounds", () => {
  settings.reactionBounds = { ...DEFAULT_SETTINGS.reactionBounds };
  saveSettings();
  const window = ensureReactionWindow();
  window.setBounds(settings.reactionBounds);
  broadcastState();
  return settings;
});

ipcMain.handle("ticker:reset-bounds", () => {
  settings.tickerBounds = { ...DEFAULT_SETTINGS.tickerBounds };
  saveSettings();
  const window = ensureTickerWindow();
  window.setBounds(settings.tickerBounds);
  broadcastState();
  return settings;
});

ipcMain.handle("debug:toggle", () => {
  if (debugWindow && !debugWindow.isDestroyed()) {
    if (debugWindow.isVisible()) {
      debugWindow.hide();
    } else {
      debugWindow.show();
    }
  } else {
    ensureDebugWindow();
  }
});

ipcMain.on("debug:log", (event, { level, message, timestamp }) => {
  // Store log
  debugWindowLogs.unshift({ level, message, timestamp });
  if (debugWindowLogs.length > 1000) {
    debugWindowLogs.pop();
  }

  // Forward to debug window if it's open
  if (debugWindow && !debugWindow.isDestroyed()) {
    debugWindow.webContents.send("debug:log", { level, message, timestamp });
  }
});

ipcMain.on("debug:request-logs", (event) => {
  if (debugWindow && !debugWindow.isDestroyed()) {
    debugWindow.webContents.send("debug:logs-batch", debugWindowLogs);
  }
});

ipcMain.on("debug:clear", (event) => {
  debugWindowLogs = [];
});

ipcMain.handle("overlay:reset-bounds", () => {
  settings.bounds = { ...DEFAULT_SETTINGS.bounds };
  saveSettings();
  const window = ensureOverlayWindow();
  window.setBounds(settings.bounds);
  broadcastState();
  return settings;
});

ipcMain.handle("overlay:toggle-click-through", () => {
  return updateSettings({ clickThrough: !settings.clickThrough });
});

ipcMain.handle("overlay:open-controls", () => {
  ensureControlWindow();
  return true;
});

ipcMain.handle("external:open", (_event, url) => shell.openExternal(url));

ipcMain.handle("clipboard:write-text", (_event, value) => {
  clipboard.writeText(value || "");
  return true;
});

ipcMain.handle("google:fetch-win-prob", async (_event, url) => {
  if (!url) return null;
  
  const scraperWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      offscreen: true,
      webSecurity: false, // Allows the scraper to see inside cross-origin iframes
      contextIsolation: false // Simplifies cross-frame DOM access for scraping
    }
  });

  // Set a real User-Agent to make it look like a regular browser
  const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  try {
    await scraperWindow.loadURL(url, { userAgent });
    
    // Scraper script to recursively search ALL frames (iframes)
    const script = `
      new Promise(resolve => {
        let attempts = 0;
        const interval = setInterval(() => {
          const findInFrame = (win) => {
            try {
              const doc = win.document;
              
              // 1. Try Specific Selectors (Immersive & Standard)
              const selectors = [
                ['.liveresults-sports-immersive__lr-imso-ss-wp-ft', '.liveresults-sports-immersive__lr-imso-ss-wp-st'],
                ['.imso_mh__win-pr-p', '.imso_mh__win-pr-p'] // Note: Standard often uses dual results for same class
              ];

              for (const [selA, selB] of selectors) {
                const els = Array.from(doc.querySelectorAll(selA + ',' + selB));
                if (els.length >= 2) {
                  const valA = els[0].innerText.match(/\\d+/);
                  const valB = els[1].innerText.match(/\\d+/);
                  if (valA && valB) {
                    return { probA: valA[0] + '%', probB: valB[0] + '%' };
                  }
                }
              }

              // 2. Smart Pattern Fallback: Search for any text like "51%" and "49%"
              const bodyText = doc.body.innerText;
              const matches = bodyText.match(/(\\d+)%/g);
              if (matches && matches.length >= 2) {
                // If we found multiple percentages, try to find the pair most likely to be Win Prob
                // Usually the pair that adds to ~100
                for (let i = 0; i < matches.length - 1; i++) {
                  const v1 = parseInt(matches[i]);
                  const v2 = parseInt(matches[i+1]);
                  if (v1 + v2 === 100 || (v1 + v2 > 98 && v1 + v2 < 102)) {
                    return { probA: v1 + '%', probB: v2 + '%' };
                  }
                }
              }
            } catch (e) { return null; }
            return null;
          };

          const searchAllFrames = (win) => {
            let res = findInFrame(win);
            if (res) return res;
            
            for (let i = 0; i < win.frames.length; i++) {
              try {
                const frameRes = searchAllFrames(win.frames[i]);
                if (frameRes) return frameRes;
              } catch (e) {}
            }
            return null;
          };

          const finalResult = searchAllFrames(window);

          if (finalResult || attempts > 25) {
            clearInterval(interval);
            resolve(finalResult || null);
          }
          attempts++;
        }, 1000); // 1 second intervals for reliability
      });
    `;

    const result = await scraperWindow.webContents.executeJavaScript(script);

    // Save debug screenshot
    const image = await scraperWindow.webContents.capturePage();
    const debugPath = path.join(app.getPath("userData"), "scraper_debug.png");
    fs.writeFileSync(debugPath, image.toPNG());

    scraperWindow.destroy();
    return result;
  } catch (error) {
    console.error("Scraper Error:", error);
    if (!scraperWindow.isDestroyed()) {
      const image = await scraperWindow.webContents.capturePage();
      const debugPath = path.join(app.getPath("userData"), "scraper_debug.png");
      fs.writeFileSync(debugPath, image.toPNG());
      scraperWindow.destroy();
    }
    return null;
  }
});

ipcMain.handle("scraper:view-debug", () => {
  const debugPath = path.join(app.getPath("userData"), "scraper_debug.png");
  if (fs.existsSync(debugPath)) {
    shell.openPath(debugPath);
    return true;
  }
  return false;
});

ipcMain.handle("scraper:open-solver", (_event, url) => {
  if (!url) return false;
  
  const solverWindow = new BrowserWindow({
    width: 600,
    height: 700,
    show: true,
    title: "Google CAPTCHA Solver",
    autoHideMenuBar: true,
    webPreferences: {
      webSecurity: false
    }
  });

  solverWindow.loadURL(url, {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  });

  return true;
});

ipcMain.handle("csv:get-schedule", () => {
  try {
    return fs.readFileSync(path.join(__dirname, "..", "..", "schedule_2026_ipl.csv"), "utf8");
  } catch (err) {
    return null;
  }
});
