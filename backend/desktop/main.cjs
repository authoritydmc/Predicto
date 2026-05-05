/**
 * Main Entry Point - Modular Electron Desktop Application
 * 
 * This file serves as the entry point that imports and initializes
 * all modular components of the desktop application.
 */

const { app, globalShortcut } = require("electron");

// ── Import Modules ────────────────────────────────────────────────────────────
const config = require("./modules/config.cjs");
const { initLogServer, broadcastToClients } = require("./modules/websocket-server.cjs");
const { createScheduler } = require("./modules/scheduler.cjs");
const { createWindowManager } = require("./modules/window-manager.cjs");
const { registerIpcHandlers } = require("./modules/ipc-handlers.cjs");
const { registerAutomationHandlers, getOrchestratorStatus } = require("./modules/automation-handlers.cjs");
const { registerNotificationHandlers } = require("./modules/notification-handlers.cjs");
const { registerScraperHandlers } = require("./modules/scraper-handlers.cjs");
const { registerSetupGuideHandlers } = require("./modules/setup-guide-handlers.cjs");
const { registerResolutionHandlers } = require("./modules/resolution-handlers.cjs");

// Extract configuration
const { APP_MODE, isDev, VITE_DEV_SERVER_URL, APP_VERSION } = config;

// ── Initialize WebSocket Server ──────────────────────────────────────────────
initLogServer();

// ── Initialize Scheduler ─────────────────────────────────────────────────────
const scheduler = createScheduler(APP_MODE);
if (APP_MODE === 'prod') {
  scheduler.startScheduler();
}

// ── Initialize Window Manager ────────────────────────────────────────────────
const windowManager = createWindowManager(config, { broadcastToClients });

// ── Register IPC Handlers ─────────────────────────────────────────────────────
registerIpcHandlers(config, windowManager, scheduler, { broadcastToClients });
registerAutomationHandlers(APP_MODE);
registerNotificationHandlers();
registerScraperHandlers();
registerSetupGuideHandlers();
registerResolutionHandlers(config, { getOrchestratorStatus });

// ── Application Event Handlers ───────────────────────────────────────────────
app.whenReady().then(() => {
  windowManager.ensureControlWindow();
  const settings = windowManager.getSettings();
  if (settings.overlayVisible) windowManager.ensureOverlayWindow();
  if (settings.tickerVisible) windowManager.ensureTickerWindow();
  if (settings.reactionVisible) windowManager.ensureReactionWindow();
  windowManager.registerShortcuts();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  windowManager.ensureControlWindow();
});

app.on("will-quit", () => {
  windowManager.unregisterShortcuts();
});

console.log(`[System] Desktop application initialized successfully`);

