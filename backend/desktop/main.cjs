const { app, BrowserWindow, clipboard, globalShortcut, ipcMain, shell } = require("electron");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");
const { spawn } = require("child_process");
const { version: APP_VERSION } = require("../package.json");
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// ── Environment Detection ───────────────────────────────────────────────────
const getAppModeFromArgs = () => {
  const modeArg = process.argv.find(arg => arg.startsWith('--mode='));
  if (modeArg) return modeArg.split('=')[1].toLowerCase();
  return null;
};

const rawAppMode = getAppModeFromArgs() || process.env.APP_MODE || process.env.NODE_ENV || "prod";
const APP_MODE = (() => {
  if (rawAppMode === "local" || rawAppMode === "dev") return "local";
  return "prod";
})();

const isDev = process.env.NODE_ENV === "development";
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || "http://localhost:5174";

console.log(`[System] Initializing in ${APP_MODE.toUpperCase()} mode`);
console.log(`[System] Version: ${APP_VERSION}`);

// ── WebSocket Log Server ──────────────────────────────────────────────────────
let wss = null;
const initLogServer = () => {
  wss = new WebSocketServer({ port: 9222 });
  wss.on("connection", (ws) => {
    ws.on("message", (data) => {
      // Broadcast to all other clients
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === 1) {
          client.send(data.toString());
        }
      });
    });
  });
};
initLogServer();

// ── Scheduler Process ───────────────────────────────────────────────────────────
let schedulerProcess = null;

const startScheduler = () => {
  if (schedulerProcess) {
    console.log('[Scheduler] Already running');
    return;
  }
  
  const pythonPath = process.platform === 'win32' ? 'python' : 'python3';
  const scriptPath = path.join(__dirname, "..", "automation", "scheduler", "main.py");
  
  console.log('[Scheduler] Starting scheduler process...');
  
  schedulerProcess = spawn(pythonPath, [scriptPath], {
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      PYTHONPATH: path.join(__dirname, "..")
    }
  });
  
  schedulerProcess.stdout.on('data', (data) => {
    console.log(`[Scheduler] ${data.toString()}`);
  });
  
  schedulerProcess.stderr.on('data', (data) => {
    console.error(`[Scheduler] Error: ${data.toString()}`);
  });
  
  schedulerProcess.on('close', (code) => {
    console.log(`[Scheduler] Process exited with code ${code}`);
    schedulerProcess = null;
    // Auto-restart after delay
    setTimeout(() => {
      if (APP_MODE === 'prod') {
        console.log('[Scheduler] Auto-restarting...');
        startScheduler();
      }
    }, 5000);
  });
  
  schedulerProcess.on('error', (error) => {
    console.error(`[Scheduler] Failed to start: ${error}`);
    schedulerProcess = null;
  });
};

// Start scheduler in production mode
if (APP_MODE === 'prod') {
  startScheduler();
}

const DEFAULT_SETTINGS = {
  appVersion: APP_VERSION,
  roomId: "ipl",
  sport: "cricket",
  clickThrough: false,
  overlayVisible: true,
  opacity: 1,
  reactionOpacity: 1,
  bounds: { width: 462, height: 924, x: 80, y: 60 },
  tickerVisible: false,
  tickerBounds: { width: 1200, height: 60, x: 100, y: 800 },
  reactionVisible: true,
  reactionBounds: { width: 320, height: 350, x: 50, y: 50 }
};

let controlWindow = null;
let overlayWindow = null;
let tickerWindow = null;
let reactionWindow = null;
let debugWindow = null;

const settingsPath = () => path.join(app.getPath("userData"), "settings.json");

const loadSettings = () => {
  try {
    const raw = fs.readFileSync(settingsPath(), "utf8");
    const parsed = JSON.parse(raw);
    if (parsed.appVersion !== APP_VERSION) return { ...DEFAULT_SETTINGS };
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      bounds: { ...DEFAULT_SETTINGS.bounds, ...(parsed.bounds || {}) },
      tickerBounds: { ...DEFAULT_SETTINGS.tickerBounds, ...(parsed.tickerBounds || {}) },
      reactionBounds: { ...DEFAULT_SETTINGS.reactionBounds, ...(parsed.reactionBounds || {}) }
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
};

let settings = loadSettings();

const saveSettings = () => {
  settings.appVersion = APP_VERSION;
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2));
};

const getWindowUrl = (winName) => {
  const currentMode = global.APP_MODE || settings.firebaseMode || APP_MODE;
  const baseParams = `appMode=${currentMode}&room=${settings.roomId}&sport=${settings.sport || 'cricket'}`;
  if (isDev) return `${VITE_DEV_SERVER_URL}/#/${winName}?${baseParams}`;
  return `file://${path.join(__dirname, "../dist/index.html")}#/${winName}?${baseParams}`;
};

const commonWebPrefs = {
  preload: path.join(__dirname, "preload.cjs"),
  contextIsolation: true,
  nodeIntegration: false
};

const broadcastState = () => {
  if (controlWindow && !controlWindow.isDestroyed()) {
    controlWindow.webContents.send("settings:changed", settings);
  }
};

const applyOverlayFlags = () => {
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

const persistOverlayBounds = () => {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  const bounds = overlayWindow.getBounds();
  settings.bounds = { width: bounds.width, height: bounds.height, x: bounds.x, y: bounds.y };
  saveSettings();
  broadcastState();
};

const persistTickerBounds = () => {
  if (!tickerWindow || tickerWindow.isDestroyed()) return;
  const bounds = tickerWindow.getBounds();
  settings.tickerBounds = { width: bounds.width, height: bounds.height, x: bounds.x, y: bounds.y };
  saveSettings();
  broadcastState();
};

const persistReactionBounds = () => {
  if (!reactionWindow || reactionWindow.isDestroyed()) return;
  const bounds = reactionWindow.getBounds();
  settings.reactionBounds = { width: bounds.width, height: bounds.height, x: bounds.x, y: bounds.y };
  saveSettings();
  broadcastState();
};

const ensureOverlayWindow = () => {
  if (overlayWindow && !overlayWindow.isDestroyed()) return overlayWindow;
  overlayWindow = new BrowserWindow({
    ...settings.bounds, show: false, frame: false, transparent: true, hasShadow: false,
    title: " ", darkTheme: true, roundedCorners: false, autoHideMenuBar: true,
    resizable: true, movable: true, fullscreenable: false, skipTaskbar: false,
    backgroundColor: "#00000000", webPreferences: commonWebPrefs
  });
  overlayWindow.loadURL(getWindowUrl("overlay"));
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
  tickerWindow = new BrowserWindow({
    ...settings.tickerBounds, show: false, frame: false, transparent: true, hasShadow: false,
    title: " ", darkTheme: true, roundedCorners: false, autoHideMenuBar: true,
    resizable: true, movable: true, focusable: true, fullscreenable: false, skipTaskbar: false,
    backgroundColor: "#00000000", webPreferences: commonWebPrefs
  });
  tickerWindow.loadURL(getWindowUrl("ticker"));
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
  reactionWindow = new BrowserWindow({
    ...settings.reactionBounds, show: false, frame: false, transparent: true, hasShadow: false,
    title: " ", darkTheme: true, roundedCorners: false, autoHideMenuBar: true,
    resizable: true, movable: true, focusable: true, fullscreenable: false, skipTaskbar: false,
    minWidth: 150, minHeight: 178, backgroundColor: "#00000000", webPreferences: commonWebPrefs
  });
  reactionWindow.loadURL(getWindowUrl("reaction"));
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
  debugWindow = new BrowserWindow({
    width: 600, height: 800,
    title: "System Debug Log",
    autoHideMenuBar: true,
    backgroundColor: "#020617",
    webPreferences: commonWebPrefs
  });
  debugWindow.loadURL(getWindowUrl("debug"));
  debugWindow.on("closed", () => { debugWindow = null; });
  return debugWindow;
};

const ensureControlWindow = () => {
  if (controlWindow && !controlWindow.isDestroyed()) { controlWindow.focus(); return controlWindow; }
  controlWindow = new BrowserWindow({
    width: 800, height: 760, minWidth: 680, minHeight: 720,
    autoHideMenuBar: true, backgroundColor: "#08121e", webPreferences: commonWebPrefs
  });
  controlWindow.loadURL(getWindowUrl("control"));
  controlWindow.on("closed", () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.destroy();
    if (tickerWindow && !tickerWindow.isDestroyed()) tickerWindow.destroy();
    if (reactionWindow && !reactionWindow.isDestroyed()) reactionWindow.destroy();
    controlWindow = null;
  });
  return controlWindow;
};

const updateSettings = (partial) => {
  settings = {
    ...settings,
    ...partial,
    bounds: { ...settings.bounds, ...(partial.bounds || {}) }
  };
  saveSettings();
  applyOverlayFlags();
  broadcastState();
  return settings;
};

const registerShortcuts = () => {
  globalShortcut.register("CommandOrControl+Shift+X", () => {
    updateSettings({ clickThrough: !settings.clickThrough });
  });
  globalShortcut.register("CommandOrControl+Shift+O", () => {
    const win = ensureOverlayWindow();
    settings.overlayVisible = true;
    saveSettings();
    win.showInactive();
    broadcastState();
  });
};

app.whenReady().then(() => {
  ensureControlWindow();
  if (settings.overlayVisible) ensureOverlayWindow();
  if (settings.tickerVisible) ensureTickerWindow();
  if (settings.reactionVisible) ensureReactionWindow();
  registerShortcuts();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => { ensureControlWindow(); });
app.on("will-quit", () => { globalShortcut.unregisterAll(); });

// ── IPC Handlers ──────────────────────────────────────────────────────────────
ipcMain.handle("settings:get", () => settings);
ipcMain.handle("settings:update", (_event, partial) => updateSettings(partial));

ipcMain.handle("overlay:show", () => {
  const win = ensureOverlayWindow();
  settings.overlayVisible = true; saveSettings(); applyOverlayFlags(); win.showInactive(); broadcastState();
  return settings;
});
ipcMain.handle("overlay:hide", () => {
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.hide();
  settings.overlayVisible = false; saveSettings(); broadcastState();
  return settings;
});
ipcMain.handle("overlay:reload", () => {
  const win = ensureOverlayWindow();
  win.loadURL(getWindowUrl("overlay"));
  return settings;
});
ipcMain.handle("overlay:reset-bounds", () => {
  settings.bounds = { ...DEFAULT_SETTINGS.bounds }; saveSettings();
  const win = ensureOverlayWindow(); win.setBounds(settings.bounds); broadcastState();
  return settings;
});
ipcMain.handle("overlay:toggle-click-through", () => updateSettings({ clickThrough: !settings.clickThrough }));
ipcMain.handle("overlay:open-controls", () => { ensureControlWindow(); return true; });

ipcMain.handle("ticker:show", () => {
  const win = ensureTickerWindow();
  settings.tickerVisible = true; saveSettings(); applyOverlayFlags(); win.showInactive(); broadcastState();
  return settings;
});
ipcMain.handle("ticker:hide", () => {
  if (tickerWindow && !tickerWindow.isDestroyed()) tickerWindow.hide();
  settings.tickerVisible = false; saveSettings(); broadcastState();
  return settings;
});
ipcMain.handle("ticker:reload", () => {
  const win = ensureTickerWindow();
  win.loadURL(getWindowUrl("ticker"));
  return settings;
});
ipcMain.handle("ticker:reset-bounds", () => {
  settings.tickerBounds = { ...DEFAULT_SETTINGS.tickerBounds }; saveSettings();
  const win = ensureTickerWindow(); win.setBounds(settings.tickerBounds); broadcastState();
  return settings;
});

ipcMain.handle("reaction:show", () => {
  const win = ensureReactionWindow();
  settings.reactionVisible = true; saveSettings(); applyOverlayFlags(); win.showInactive(); broadcastState();
  return settings;
});
ipcMain.handle("reaction:hide", () => {
  if (reactionWindow && !reactionWindow.isDestroyed()) reactionWindow.hide();
  settings.reactionVisible = false; saveSettings(); broadcastState();
  return settings;
});
ipcMain.handle("reaction:reload", () => {
  const win = ensureReactionWindow();
  win.loadURL(getWindowUrl("reaction"));
  return settings;
});
ipcMain.handle("reaction:reset-bounds", () => {
  settings.reactionBounds = { ...DEFAULT_SETTINGS.reactionBounds }; saveSettings();
  const win = ensureReactionWindow(); win.setBounds(settings.reactionBounds); broadcastState();
  return settings;
});

ipcMain.handle("debug:show", () => {
  ensureDebugWindow();
  return true;
});

ipcMain.handle("settings:set-window-visibility", (_event, visibility) => {
  console.log('[Settings] Setting window visibility defaults:', visibility);
  settings.overlayVisible = visibility.overlayVisible;
  settings.tickerVisible = visibility.tickerVisible;
  settings.reactionVisible = visibility.reactionVisible;
  saveSettings();
  return settings;
});

ipcMain.handle("external:open", (_event, url) => shell.openExternal(url));
ipcMain.handle("clipboard:write-text", (_event, value) => { clipboard.writeText(value || ""); return true; });

ipcMain.handle("google:fetch-win-prob", async (_event, url) => {
  if (!url) return null;
  const scraperWindow = new BrowserWindow({
    width: 1280, height: 800, show: false,
    webPreferences: { offscreen: true, webSecurity: false, contextIsolation: false }
  });
  const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  try {
    await scraperWindow.loadURL(url, { userAgent });
    const script = `
      new Promise(resolve => {
        let attempts = 0;
        const interval = setInterval(() => {
          const findInFrame = (win) => {
            try {
              const doc = win.document;
              const selectors = [
                ['.liveresults-sports-immersive__lr-imso-ss-wp-ft', '.liveresults-sports-immersive__lr-imso-ss-wp-st'],
                ['.imso_mh__win-pr-p', '.imso_mh__win-pr-p']
              ];
              for (const [selA, selB] of selectors) {
                const els = Array.from(doc.querySelectorAll(selA + ',' + selB));
                if (els.length >= 2) {
                  const valA = els[0].innerText.match(/\\d+/);
                  const valB = els[1].innerText.match(/\\d+/);
                  if (valA && valB) return { probA: valA[0] + '%', probB: valB[0] + '%' };
                }
              }
              const bodyText = doc.body.innerText;
              const matches = bodyText.match(/(\\d+)%/g);
              if (matches && matches.length >= 2) {
                for (let i = 0; i < matches.length - 1; i++) {
                  const v1 = parseInt(matches[i]); const v2 = parseInt(matches[i+1]);
                  if (v1 + v2 === 100 || (v1 + v2 > 98 && v1 + v2 < 102)) return { probA: v1 + '%', probB: v2 + '%' };
                }
              }
            } catch(e) { return null; }
            return null;
          };
          const searchAllFrames = (win) => {
            let res = findInFrame(win); if (res) return res;
            for (let i = 0; i < win.frames.length; i++) {
              try { const r = searchAllFrames(win.frames[i]); if (r) return r; } catch(e) {}
            }
            return null;
          };
          const finalResult = searchAllFrames(window);
          if (finalResult || attempts > 25) { clearInterval(interval); resolve(finalResult || null); }
          attempts++;
        }, 1000);
      });
    `;
    const result = await scraperWindow.webContents.executeJavaScript(script);
    const image = await scraperWindow.webContents.capturePage();
    const debugPath = path.join(app.getPath("userData"), "scraper_debug.png");
    fs.writeFileSync(debugPath, image.toPNG());
    scraperWindow.destroy();
    return result;
  } catch (error) {
    console.error("Scraper Error:", error);
    if (!scraperWindow.isDestroyed()) {
      try {
        const image = await scraperWindow.webContents.capturePage();
        fs.writeFileSync(path.join(app.getPath("userData"), "scraper_debug.png"), image.toPNG());
      } catch {}
      scraperWindow.destroy();
    }
    return null;
  }
});

ipcMain.handle("scraper:view-debug", () => {
  const debugPath = path.join(app.getPath("userData"), "scraper_debug.png");
  if (fs.existsSync(debugPath)) { shell.openPath(debugPath); return true; }
  return false;
});

ipcMain.handle("scraper:open-solver", (_event, url) => {
  if (!url) return false;
  const solverWindow = new BrowserWindow({
    width: 600, height: 700, show: true, title: "Google CAPTCHA Solver",
    autoHideMenuBar: true, webPreferences: { webSecurity: false }
  });
  solverWindow.loadURL(url, { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" });
  return true;
});

ipcMain.handle("csv:get-schedule", () => {
  try { return fs.readFileSync(path.join(__dirname, "..", "schedule_2026_ipl.csv"), "utf8"); }
  catch { return null; }
});

ipcMain.handle("firebase:set-mode", (_event, mode) => {
  const newMode = mode === 'local' ? 'local' : 'prod';
  console.log(`[System] Switching Firebase mode to: ${newMode.toUpperCase()}`);
  
  // Update APP_MODE globally
  global.APP_MODE = newMode;
  
  // Save to settings
  settings.firebaseMode = newMode;
  saveSettings();
  
  // Reload all windows with new mode
  const reloadAllWindows = () => {
    if (controlWindow && !controlWindow.isDestroyed()) {
      controlWindow.loadURL(getWindowUrl("control"));
    }
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.loadURL(getWindowUrl("overlay"));
    }
    if (tickerWindow && !tickerWindow.isDestroyed()) {
      tickerWindow.loadURL(getWindowUrl("ticker"));
    }
    if (reactionWindow && !reactionWindow.isDestroyed()) {
      reactionWindow.loadURL(getWindowUrl("reaction"));
    }
  };
  
  reloadAllWindows();
  return true;
});

ipcMain.handle("scraper:run", async (_event, sport, matchId, teamA, teamB, scraperOrder) => {
  return new Promise((resolve) => {
    console.log(`[Scraper] Running ${sport} scraper for ${teamA} vs ${teamB}`);
    
    const pythonPath = process.platform === 'win32' ? 'python' : 'python3';
    const scriptPath = path.join(__dirname, "..", "scraper", "live_score_scraper.py");
    
    const args = [scriptPath, sport, matchId, teamA, teamB];
    if (scraperOrder) {
      args.push(scraperOrder);
    }
    
    const pythonProcess = spawn(pythonPath, args);
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          console.log(`[Scraper] Success:`, result);
          resolve({ success: true, data: result });
        } catch (e) {
          console.error(`[Scraper] JSON parse error:`, e);
          resolve({ success: false, error: 'Failed to parse scraper output', stderr });
        }
      } else {
        console.error(`[Scraper] Process exited with code ${code}:`, stderr);
        resolve({ success: false, error: `Scraper failed with code ${code}`, stderr });
      }
    });
    
    pythonProcess.on('error', (error) => {
      console.error(`[Scraper] Failed to start Python process:`, error);
      resolve({ success: false, error: 'Failed to start scraper', details: error.message });
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Enhanced Automation Orchestrator IPC Handlers
// ─────────────────────────────────────────────────────────────────────────────

let enhancedOrchestratorProcess = null;

const startEnhancedOrchestrator = () => {
  if (enhancedOrchestratorProcess) {
    console.log('[Enhanced Orchestrator] Already running');
    return;
  }
  
  const pythonPath = process.platform === 'win32' ? 'python' : 'python3';
  const scriptPath = path.join(__dirname, "..", "automation", "orchestrator", "main.py");
  
  console.log('[Enhanced Orchestrator] Starting enhanced orchestrator process...');
  
  enhancedOrchestratorProcess = spawn(pythonPath, [scriptPath], {
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      PYTHONPATH: path.join(__dirname, "..")
    }
  });
  
  enhancedOrchestratorProcess.stdout.on('data', (data) => {
    console.log(`[Enhanced Orchestrator] ${data.toString()}`);
  });
  
  enhancedOrchestratorProcess.stderr.on('data', (data) => {
    console.error(`[Enhanced Orchestrator] Error: ${data.toString()}`);
  });
  
  enhancedOrchestratorProcess.on('close', (code) => {
    console.log(`[Enhanced Orchestrator] Process exited with code ${code}`);
    enhancedOrchestratorProcess = null;
    // Auto-restart in production mode
    if (APP_MODE === 'prod') {
      setTimeout(() => {
        console.log('[Enhanced Orchestrator] Auto-restarting...');
        startEnhancedOrchestrator();
      }, 5000);
    }
  });
  
  enhancedOrchestratorProcess.on('error', (error) => {
    console.error(`[Enhanced Orchestrator] Failed to start: ${error}`);
    enhancedOrchestratorProcess = null;
  });
};

// Start enhanced orchestrator in production mode
if (APP_MODE === 'prod') {
  startEnhancedOrchestrator();
}

// Enhanced Orchestrator IPC Handlers
ipcMain.handle("automation:get-status", async () => {
  return {
    running: enhancedOrchestratorProcess !== null,
    pid: enhancedOrchestratorProcess ? enhancedOrchestratorProcess.pid : null
  };
});

ipcMain.handle("automation:trigger-task", async (_event, taskId) => {
  console.log(`[Automation] Triggering task: ${taskId}`);
  
  const pythonPath = process.platform === 'win32' ? 'python' : 'python3';
  const scriptPath = path.join(__dirname, "..", "automation", "orchestrator", "main.py");
  
  return new Promise((resolve) => {
    const pythonProcess = spawn(pythonPath, [scriptPath, '--trigger-task', taskId], {
      cwd: path.join(__dirname, ".."),
      env: {
        ...process.env,
        PYTHONPATH: path.join(__dirname, "..")
      }
    });
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`[Automation] Task ${taskId} completed successfully`);
        resolve({ success: true, taskId, status: 'success' });
      } else {
        console.error(`[Automation] Task ${taskId} failed with code ${code}:`, stderr);
        resolve({ success: false, error: `Task failed with code ${code}`, taskId });
      }
    });
    
    pythonProcess.on('error', (error) => {
      console.error(`[Automation] Failed to start task ${taskId}:`, error);
      resolve({ success: false, error: 'Failed to start task', taskId, details: error.message });
    });
  });
});

ipcMain.handle("automation:update-config", async (_event, component, updates) => {
  console.log(`[Automation] Updating config for ${component}:`, updates);
  
  const pythonPath = process.platform === 'win32' ? 'python' : 'python3';
  const scriptPath = path.join(__dirname, "..", "automation", "orchestrator", "main.py");
  
  return new Promise((resolve) => {
    const pythonProcess = spawn(pythonPath, [
      scriptPath, '--update-config', component, JSON.stringify(updates)
    ], {
      cwd: path.join(__dirname, ".."),
      env: {
        ...process.env,
        PYTHONPATH: path.join(__dirname, "..")
      }
    });
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          console.log(`[Automation] Config updated successfully:`, result);
          resolve(result);
        } catch (e) {
          console.error(`[Automation] Failed to parse config update result:`, e);
          resolve({ success: false, error: 'Failed to parse result' });
        }
      } else {
        console.error(`[Automation] Config update failed with code ${code}:`, stderr);
        resolve({ success: false, error: `Config update failed with code ${code}` });
      }
    });
  });
});

ipcMain.handle("automation:test-scraper", async (_event, scraperName, testMatch) => {
  console.log(`[Automation] Testing scraper: ${scraperName}`);
  
  const pythonPath = process.platform === 'win32' ? 'python' : 'python3';
  const scriptPath = path.join(__dirname, "..", "automation", "orchestrator", "main.py");
  
  return new Promise((resolve) => {
    const pythonProcess = spawn(pythonPath, [
      scriptPath, '--test-scraper', scraperName, JSON.stringify(testMatch)
    ], {
      cwd: path.join(__dirname, ".."),
      env: {
        ...process.env,
        PYTHONPATH: path.join(__dirname, "..")
      }
    });
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          console.log(`[Automation] Scraper test completed:`, result);
          resolve(result);
        } catch (e) {
          console.error(`[Automation] Failed to parse scraper test result:`, e);
          resolve({ success: false, error: 'Failed to parse result' });
        }
      } else {
        console.error(`[Automation] Scraper test failed with code ${code}:`, stderr);
        resolve({ success: false, error: `Scraper test failed with code ${code}` });
      }
    });
  });
});

ipcMain.handle("automation:get-logs", async (_event, component, level, limit) => {
  console.log(`[Automation] Getting logs for ${component}, level: ${level}, limit: ${limit}`);
  
  const pythonPath = process.platform === 'win32' ? 'python' : 'python3';
  const scriptPath = path.join(__dirname, "..", "automation", "orchestrator", "main.py");
  
  return new Promise((resolve) => {
    const pythonProcess = spawn(pythonPath, [
      scriptPath, '--get-logs', component || 'all', level || 'all', limit || '100'
    ], {
      cwd: path.join(__dirname, ".."),
      env: {
        ...process.env,
        PYTHONPATH: path.join(__dirname, "..")
      }
    });
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (e) {
          resolve({ success: false, error: 'Failed to parse logs' });
        }
      } else {
        resolve({ success: false, error: `Failed to get logs with code ${code}` });
      }
    });
  });
});
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`[Automation] Task ${taskId} completed successfully`);
        resolve({ success: true, taskId, status: 'success' });
      } else {
        console.error(`[Automation] Task ${taskId} failed with code ${code}:`, stderr);
        resolve({ success: false, error: `Task failed with code ${code}`, taskId });
      }
    });
    
    pythonProcess.on('error', (error) => {
      console.error(`[Automation] Failed to start task ${taskId}:`, error);
      resolve({ success: false, error: 'Failed to start task', taskId, details: error.message });
    });
  });
});

// Discord notification handlers
ipcMain.handle("automation:test-discord", async () => {
  console.log('[Discord] Testing Discord notification');
  
  const pythonPath = process.platform === 'win32' ? 'python' : 'python3';
  const scriptPath = path.join(__dirname, "..", "automation", "orchestrator", "main.py");
  
  return new Promise((resolve) => {
    const pythonProcess = spawn(pythonPath, [
      scriptPath, '--test-discord'
    ], {
      cwd: path.join(__dirname, ".."),
      env: {
        ...process.env,
        PYTHONPATH: path.join(__dirname, "..")
      }
    });
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          console.log('[Discord] Test result:', result);
          resolve(result);
        } catch (e) {
          console.error('[Discord] Failed to parse test result:', e);
          resolve({ success: false, error: 'Failed to parse test result' });
        }
      } else {
        console.error(`[Discord] Test failed with code ${code}:`, stderr);
        resolve({ success: false, error: `Test failed with code ${code}` });
      }
    });
    
    pythonProcess.on('error', (error) => {
      console.error('[Discord] Failed to run test:', error);
      resolve({ success: false, error: 'Failed to run test', details: error.message });
    });
  });
});

ipcMain.handle("automation:update-discord-config", async (_event, config) => {
  console.log('[Discord] Updating Discord configuration:', config);
  
  const pythonPath = process.platform === 'win32' ? 'python' : 'python3';
  const scriptPath = path.join(__dirname, "..", "automation", "orchestrator", "main.py");
  
  return new Promise((resolve) => {
    const pythonProcess = spawn(pythonPath, [
      scriptPath, '--update-discord-config', JSON.stringify(config)
    ], {
      cwd: path.join(__dirname, ".."),
      env: {
        ...process.env,
        PYTHONPATH: path.join(__dirname, "..")
      }
    });
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          console.log('[Discord] Config update result:', result);
          resolve(result);
        } catch (e) {
          console.error('[Discord] Failed to parse config update result:', e);
          resolve({ success: false, error: 'Failed to parse result' });
        }
      } else {
        console.error(`[Discord] Config update failed with code ${code}:`, stderr);
        resolve({ success: false, error: `Config update failed with code ${code}` });
      }
    });
    
    pythonProcess.on('error', (error) => {
      console.error('[Discord] Failed to update config:', error);
      resolve({ success: false, error: 'Failed to update config', details: error.message });
    });
  });
});

ipcMain.handle("automation:get-notification-status", async () => {
  console.log('[Discord] Getting notification status');
  
  const pythonPath = process.platform === 'win32' ? 'python' : 'python3';
  const scriptPath = path.join(__dirname, "..", "automation", "orchestrator", "main.py");
  
  return new Promise((resolve) => {
    const pythonProcess = spawn(pythonPath, [
      scriptPath, '--notification-status'
    ], {
      cwd: path.join(__dirname, ".."),
      env: {
        ...process.env,
        PYTHONPATH: path.join(__dirname, "..")
      }
    });
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (e) {
          console.error('[Discord] Failed to parse status result:', e);
          resolve({ success: false, error: 'Failed to parse status' });
        }
      } else {
        console.error(`[Discord] Status check failed with code ${code}:`, stderr);
        resolve({ success: false, error: `Status check failed with code ${code}` });
      }
    });
    
    pythonProcess.on('error', (error) => {
      console.error('[Discord] Failed to get status:', error);
      resolve({ success: false, error: 'Failed to get status', details: error.message });
    });
  });
});

// Push notification handlers
ipcMain.handle("push:register-device", async (_event, userId, deviceInfo) => {
  console.log(`[Push] Registering device for user ${userId}`);
  
  const pythonPath = process.platform === 'win32' ? 'python' : 'python3';
  const scriptPath = path.join(__dirname, "..", "automation", "orchestrator", "main.py");
  
  return new Promise((resolve) => {
    const pythonProcess = spawn(pythonPath, [
      scriptPath, '--register-device', userId, JSON.stringify(deviceInfo)
    ], {
      cwd: path.join(__dirname, ".."),
      env: {
        ...process.env,
        PYTHONPATH: path.join(__dirname, "..")
      }
    });
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          console.log('[Push] Device registration result:', result);
          resolve(result);
        } catch (e) {
          console.error('[Push] Failed to parse registration result:', e);
          resolve({ success: false, error: 'Failed to parse result' });
        }
      } else {
        console.error(`[Push] Device registration failed with code ${code}:`, stderr);
        resolve({ success: false, error: `Registration failed with code ${code}` });
      }
    });
    
    pythonProcess.on('error', (error) => {
      console.error('[Push] Failed to register device:', error);
      resolve({ success: false, error: 'Failed to register device', details: error.message });
    });
  });
});

ipcMain.handle("push:unregister-device", async (_event, userId, deviceId) => {
  console.log(`[Push] Unregistering device ${deviceId} for user ${userId}`);
  
  const pythonPath = process.platform === 'win32' ? 'python' : 'python3';
  const scriptPath = path.join(__dirname, "..", "automation", "orchestrator", "main.py");
  
  return new Promise((resolve) => {
    const pythonProcess = spawn(pythonPath, [
      scriptPath, '--unregister-device', userId, deviceId
    ], {
      cwd: path.join(__dirname, ".."),
      env: {
        ...process.env,
        PYTHONPATH: path.join(__dirname, "..")
      }
    });
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          console.log('[Push] Device unregistration result:', result);
          resolve(result);
        } catch (e) {
          console.error('[Push] Failed to parse unregistration result:', e);
          resolve({ success: false, error: 'Failed to parse result' });
        }
      } else {
        console.error(`[Push] Device unregistration failed with code ${code}:`, stderr);
        resolve({ success: false, error: `Unregistration failed with code ${code}` });
      }
    });
    
    pythonProcess.on('error', (error) => {
      console.error('[Push] Failed to unregister device:', error);
      resolve({ success: false, error: 'Failed to unregister device', details: error.message });
    });
  });
});

ipcMain.handle("push:get-user-settings", async (_event, userId) => {
  console.log(`[Push] Getting notification settings for user ${userId}`);
  
  const pythonPath = process.platform === 'win32' ? 'python' : 'python3';
  const scriptPath = path.join(__dirname, "..", "automation", "orchestrator", "main.py");
  
  return new Promise((resolve) => {
    const pythonProcess = spawn(pythonPath, [
      scriptPath, '--get-user-settings', userId
    ], {
      cwd: path.join(__dirname, ".."),
      env: {
        ...process.env,
        PYTHONPATH: path.join(__dirname, "..")
      }
    });
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (e) {
          console.error('[Push] Failed to parse user settings:', e);
          resolve({ success: false, error: 'Failed to parse settings' });
        }
      } else {
        console.error(`[Push] Failed to get user settings with code ${code}:`, stderr);
        resolve({ success: false, error: `Failed to get settings with code ${code}` });
      }
    });
    
    pythonProcess.on('error', (error) => {
      console.error('[Push] Failed to get user settings:', error);
      resolve({ success: false, error: 'Failed to get settings', details: error.message });
    });
  });
});

ipcMain.handle("push:update-user-settings", async (_event, userId, settings) => {
  console.log(`[Push] Updating notification settings for user ${userId}`);
  
  const pythonPath = process.platform === 'win32' ? 'python' : 'python3';
  const scriptPath = path.join(__dirname, "..", "automation", "orchestrator", "main.py");
  
  return new Promise((resolve) => {
    const pythonProcess = spawn(pythonPath, [
      scriptPath, '--update-user-settings', userId, JSON.stringify(settings)
    ], {
      cwd: path.join(__dirname, ".."),
      env: {
        ...process.env,
        PYTHONPATH: path.join(__dirname, "..")
      }
    });
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          console.log('[Push] User settings update result:', result);
          resolve(result);
        } catch (e) {
          console.error('[Push] Failed to parse settings update result:', e);
          resolve({ success: false, error: 'Failed to parse result' });
        }
      } else {
        console.error(`[Push] Settings update failed with code ${code}:`, stderr);
        resolve({ success: false, error: `Settings update failed with code ${code}` });
      }
    });
    
    pythonProcess.on('error', (error) => {
      console.error('[Push] Failed to update user settings:', error);
      resolve({ success: false, error: 'Failed to update settings', details: error.message });
    });
  });
});

ipcMain.handle("push:get-user-devices", async (_event, userId) => {
  console.log(`[Push] Getting devices for user ${userId}`);
  
  const pythonPath = process.platform === 'win32' ? 'python' : 'python3';
  const scriptPath = path.join(__dirname, "..", "automation", "orchestrator", "main.py");
  
  return new Promise((resolve) => {
    const pythonProcess = spawn(pythonPath, [
      scriptPath, '--get-user-devices', userId
    ], {
      cwd: path.join(__dirname, ".."),
      env: {
        ...process.env,
        PYTHONPATH: path.join(__dirname, "..")
      }
    });
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (e) {
          console.error('[Push] Failed to parse user devices:', e);
          resolve({ success: false, error: 'Failed to parse devices' });
        }
      } else {
        console.error(`[Push] Failed to get user devices with code ${code}:`, stderr);
        resolve({ success: false, error: `Failed to get devices with code ${code}` });
      }
    });
    
    pythonProcess.on('error', (error) => {
      console.error('[Push] Failed to get user devices:', error);
      resolve({ success: false, error: 'Failed to get devices', details: error.message });
    });
  });
});

ipcMain.handle("push:test-notification", async (_event, userId) => {
  console.log(`[Push] Testing push notification for user ${userId}`);
  
  const pythonPath = process.platform === 'win32' ? 'python' : 'python3';
  const scriptPath = path.join(__dirname, "..", "automation", "orchestrator", "main.py");
  
  return new Promise((resolve) => {
    const pythonProcess = spawn(pythonPath, [
      scriptPath, '--test-push-notification', userId || 'test'
    ], {
      cwd: path.join(__dirname, ".."),
      env: {
        ...process.env,
        PYTHONPATH: path.join(__dirname, "..")
      }
    });
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          console.log('[Push] Test notification result:', result);
          resolve(result);
        } catch (e) {
          console.error('[Push] Failed to parse test result:', e);
          resolve({ success: false, error: 'Failed to parse test result' });
        }
      } else {
        console.error(`[Push] Test notification failed with code ${code}:`, stderr);
        resolve({ success: false, error: `Test failed with code ${code}` });
      }
    });
    
    pythonProcess.on('error', (error) => {
      console.error('[Push] Failed to test push notification:', error);
      resolve({ success: false, error: 'Failed to test notification', details: error.message });
    });
  });
});

ipcMain.handle("push:get-vapid-key", async () => {
  console.log('[Push] Getting VAPID public key');
  
  const pythonPath = process.platform === 'win32' ? 'python' : 'python3';
  const scriptPath = path.join(__dirname, "..", "automation", "orchestrator", "main.py");
  
  return new Promise((resolve) => {
    const pythonProcess = spawn(pythonPath, [
      scriptPath, '--get-vapid-key'
    ], {
      cwd: path.join(__dirname, ".."),
      env: {
        ...process.env,
        PYTHONPATH: path.join(__dirname, "..")
      }
    });
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (e) {
          console.error('[Push] Failed to parse VAPID key:', e);
          resolve({ success: false, error: 'Failed to parse VAPID key' });
        }
      } else {
        console.error(`[Push] Failed to get VAPID key with code ${code}:`, stderr);
        resolve({ success: false, error: `Failed to get VAPID key with code ${code}` });
      }
    });
    
    pythonProcess.on('error', (error) => {
      console.error('[Push] Failed to get VAPID key:', error);
      resolve({ success: false, error: 'Failed to get VAPID key', details: error.message });
    });
  });
});

// Setup guide handlers
ipcMain.handle("app:open-setup-guide", async (_event, guideType) => {
  console.log(`[App] Opening setup guide: ${guideType}`);
  
  const guidePaths = {
    'discord': path.join(__dirname, "..", "automation", "notifications", "DISCORD_SETUP_GUIDE.md"),
    'push': path.join(__dirname, "..", "automation", "notifications", "PUSH_NOTIFICATION_SETUP_GUIDE.md")
  };
  
  const guidePath = guidePaths[guideType];
  if (!guidePath) {
    return { success: false, error: 'Invalid guide type' };
  }
  
  try {
    // Check if file exists
    const fs = require('fs');
    if (!fs.existsSync(guidePath)) {
      return { success: false, error: 'Guide file not found' };
    }
    
    // Open with default application
    const { shell } = require('electron');
    await shell.openPath(guidePath);
    
    return { success: true, message: 'Setup guide opened' };
  } catch (error) {
    console.error('[App] Error opening setup guide:', error);
    return { success: false, error: 'Failed to open setup guide' };
  }
});

ipcMain.handle("app:get-setup-guide-content", async (_event, guideType) => {
  console.log(`[App] Getting setup guide content: ${guideType}`);
  
  const guidePaths = {
    'discord': path.join(__dirname, "..", "automation", "notifications", "DISCORD_SETUP_GUIDE.md"),
    'push': path.join(__dirname, "..", "automation", "notifications", "PUSH_NOTIFICATION_SETUP_GUIDE.md")
  };
  
  const guidePath = guidePaths[guideType];
  if (!guidePath) {
    return { success: false, error: 'Invalid guide type' };
  }
  
  try {
    const fs = require('fs');
    if (!fs.existsSync(guidePath)) {
      return { success: false, error: 'Guide file not found' };
    }
    
    const content = fs.readFileSync(guidePath, 'utf8');
    return { success: true, content };
  } catch (error) {
    console.error('[App] Error reading setup guide:', error);
    return { success: false, error: 'Failed to read setup guide' };
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Legacy Scheduler IPC Handlers (for backward compatibility)
// ─────────────────────────────────────────────────────────────────────────────

ipcMain.handle("scheduler:get-status", async () => {
  return {
    running: enhancedOrchestratorProcess !== null,
    pid: enhancedOrchestratorProcess ? enhancedOrchestratorProcess.pid : null
  };
});

ipcMain.handle("scheduler:trigger-task", async (_event, taskId) => {
  console.log(`[Scheduler] Triggering task: ${taskId}`);
  
  const pythonPath = process.platform === 'win32' ? 'python' : 'python3';
  let scriptPath = '';
  
  if (taskId === 'cricket_score_calc') {
    scriptPath = path.join(__dirname, "..", "automation", "cricket", "run_calculator.py");
  } else if (taskId === 'football_score_calc') {
    scriptPath = path.join(__dirname, "..", "automation", "football", "run_calculator.py");
  } else if (taskId === 'tournament_leaderboard') {
    scriptPath = path.join(__dirname, "..", "automation", "base", "run_leaderboard.py");
  } else {
    return { success: false, error: 'Unknown task ID' };
  }
  
  return new Promise((resolve) => {
    const pythonProcess = spawn(pythonPath, [scriptPath]);
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`[Scheduler] Task ${taskId} completed successfully`);
        resolve({ success: true, taskId, status: 'success' });
      } else {
        console.error(`[Scheduler] Task ${taskId} failed with code ${code}:`, stderr);
        resolve({ success: false, error: `Task failed with code ${code}`, taskId });
      }
    });
    
    pythonProcess.on('error', (error) => {
      console.error(`[Scheduler] Failed to start task ${taskId}:`, error);
      resolve({ success: false, error: 'Failed to start task', taskId, details: error.message });
    });
  });
});

ipcMain.handle("scheduler:toggle-task", async (_event, taskId) => {
  console.log(`[Scheduler] Toggling task: ${taskId}`);
  return { success: true, taskId, enabled: true };
});

ipcMain.handle("scheduler:update-task", async (_event, taskId, config) => {
  console.log(`[Scheduler] Updating task: ${taskId}`, config);
  return { success: true, taskId };
});

ipcMain.handle("resolution:process-match", async (_event, sport, tournamentId, matchId, innings = 'both', force = false, firebaseMode = 'prod') => {
  console.log("=" * 80);
  console.log(`[Resolution] Starting match resolution process`);
  console.log(`[Resolution] Sport: ${sport}`);
  console.log(`[Resolution] Tournament ID: ${tournamentId}`);
  console.log(`[Resolution] Match ID: ${matchId}`);
  console.log(`[Resolution] Innings: ${innings}`);
  console.log(`[Resolution] Force: ${force} (type: ${typeof force})`);
  console.log(`[Resolution] Firebase Mode: ${firebaseMode}`);
  console.log("=" * 80);
  
  const pythonPath = process.platform === 'win32' ? 'python' : 'python3';
  let scriptPath = '';
  
  if (sport === 'cricket') {
    scriptPath = path.join(__dirname, "..", "automation", "cricket", "run_calculator.py");
  } else if (sport === 'football') {
    scriptPath = path.join(__dirname, "..", "automation", "football", "run_calculator.py");
  } else {
    console.error(`[Resolution] ERROR: Unsupported sport: ${sport}`);
    return { success: false, error: 'Unsupported sport' };
  }
  
  console.log(`[Resolution] Python path: ${pythonPath}`);
  console.log(`[Resolution] Script path: ${scriptPath}`);
  console.log(`[Resolution] Command: ${pythonPath} ${scriptPath} --tournament ${tournamentId} --match ${matchId} --innings ${innings} --env ${firebaseMode}${force ? ' --force' : ''}`);
  console.log(`[Resolution] Spawning Python process...`);

  // Firebase config from environment variables
  const firebaseEnv = {
    FIREBASE_API_KEY: process.env.FIREBASE_API_KEY,
    FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN,
    FIREBASE_DATABASE_URL: process.env.FIREBASE_DATABASE_URL,
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET,
    FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID,
    FIREBASE_APP_ID: process.env.FIREBASE_APP_ID,
    FIREBASE_MEASUREMENT_ID: process.env.FIREBASE_MEASUREMENT_ID,
    APP_MODE: firebaseMode
  };

  return new Promise((resolve) => {
    const pythonArgs = [scriptPath, '--tournament', tournamentId, '--match', matchId, '--innings', innings, '--env', firebaseMode];
    if (force) {
      pythonArgs.push('--force');
    }
    
    const pythonProcess = spawn(pythonPath, pythonArgs, {
      cwd: path.join(__dirname, ".."),
      env: {
        ...process.env,
        PYTHONPATH: path.join(__dirname, ".."),
        ...firebaseEnv
      }
    });
    
    let stdout = '';
    let stderr = '';
    let lineCount = 0;
    
    pythonProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          lineCount++;
          console.log(`[Resolution Output] ${line}`);
        }
      });
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          console.error(`[Resolution Error] ${line}`);
        }
      });
      stderr += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      console.log("=" * 80);
      console.log(`[Resolution] Python process exited with code: ${code}`);
      console.log(`[Resolution] Total output lines: ${lineCount}`);
      
      if (code === 0) {
        console.log(`[Resolution] SUCCESS: Match processed successfully`);
        console.log(`[Resolution] Output length: ${stdout.length} characters`);
        resolve({ success: true, sport, tournamentId, matchId, output: stdout, lineCount });
      } else {
        console.error(`[Resolution] ERROR: Match processing failed`);
        console.error(`[Resolution] Exit code: ${code}`);
        console.error(`[Resolution] Error output length: ${stderr.length} characters`);
        resolve({ success: false, error: `Processing failed with code ${code}`, stderr, stdout });
      }
      console.log("=" * 80);
    });
    
    pythonProcess.on('error', (error) => {
      console.error("=" * 80);
      console.error(`[Resolution] ERROR: Failed to start Python process`);
      console.error(`[Resolution] Error details: ${error.message}`);
      console.error(`[Resolution] Error code: ${error.code}`);
      console.error(`[Resolution] Error syscall: ${error.syscall}`);
      console.error("=" * 80);
      resolve({ success: false, error: 'Failed to start process', details: error.message });
    });
  });
});
