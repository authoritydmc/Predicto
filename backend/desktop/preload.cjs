const { contextBridge, ipcRenderer } = require("electron");

// Expose APP_MODE to renderer process
const APP_MODE = process.env.APP_MODE || (process.argv.find(arg => arg.startsWith('--mode='))?.split('=')[1]?.toLowerCase()) || "prod";

contextBridge.exposeInMainWorld("overlayDesktop", {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  updateSettings: (partial) => ipcRenderer.invoke("settings:update", partial),
  showOverlay: () => ipcRenderer.invoke("overlay:show"),
  hideOverlay: () => ipcRenderer.invoke("overlay:hide"),
  reloadOverlay: () => ipcRenderer.invoke("overlay:reload"),
  resetBounds: () => ipcRenderer.invoke("overlay:reset-bounds"),
  toggleClickThrough: () => ipcRenderer.invoke("overlay:toggle-click-through"),
  openControls: () => ipcRenderer.invoke("overlay:open-controls"),
  openExternal: (url) => ipcRenderer.invoke("external:open", url),
  copyText: (value) => ipcRenderer.invoke("clipboard:write-text", value),
  showTicker: () => ipcRenderer.invoke("ticker:show"),
  hideTicker: () => ipcRenderer.invoke("ticker:hide"),
  reloadTicker: () => ipcRenderer.invoke("ticker:reload"),
  resetTickerBounds: () => ipcRenderer.invoke("ticker:reset-bounds"),
  showReaction: () => ipcRenderer.invoke("reaction:show"),
  hideReaction: () => ipcRenderer.invoke("reaction:hide"),
  reloadReaction: () => ipcRenderer.invoke("reaction:reload"),
  resetReactionBounds: () => ipcRenderer.invoke("reaction:reset-bounds"),
  onSettingsChanged: (callback) => {
    ipcRenderer.on("settings:changed", (_event, value) => callback(value));
  },
  onOverlayUrl: (callback) => {
    ipcRenderer.on("overlay:url", (_event, value) => callback(value));
  },
  fetchWinProbability: (url) => ipcRenderer.invoke("google:fetch-win-prob", url),
  viewScraperDebug: () => ipcRenderer.invoke("scraper:view-debug"),
  openScraperSolver: (url) => ipcRenderer.invoke("scraper:open-solver", url),
  getScheduleCsv: () => ipcRenderer.invoke("csv:get-schedule"),
  showDebug: () => ipcRenderer.invoke("debug:show"),
  setFirebaseMode: (mode) => ipcRenderer.invoke("firebase:set-mode", mode),
  runScraper: (sport, matchId, teamA, teamB, scraperOrder) => ipcRenderer.invoke("scraper:run", sport, matchId, teamA, teamB, scraperOrder),
  triggerSchedulerTask: (taskId) => ipcRenderer.invoke("scheduler:trigger-task", taskId),
  toggleSchedulerTask: (taskId) => ipcRenderer.invoke("scheduler:toggle-task", taskId),
  updateSchedulerTask: (taskId, config) => ipcRenderer.invoke("scheduler:update-task", taskId, config),
  getSchedulerStatus: () => ipcRenderer.invoke("scheduler:get-status"),
  processMatchResolution: (sport, tournamentId, matchId, innings = 'both', force = false, firebaseMode = 'prod') => ipcRenderer.invoke("resolution:process-match", sport, tournamentId, matchId, innings, force, firebaseMode),
  setWindowVisibilityDefaults: (visibility) => ipcRenderer.invoke("settings:set-window-visibility", visibility),
});

// Expose APP_MODE directly on window
contextBridge.exposeInMainWorld("APP_MODE", APP_MODE);
