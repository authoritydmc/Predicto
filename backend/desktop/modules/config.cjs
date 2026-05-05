/**
 * Configuration Module
 * Environment detection and application settings
 */

const path = require("path");
const fs = require("fs");
const { app } = require("electron");
const { version: APP_VERSION } = require("../../package.json");
require('dotenv').config({ path: path.join(__dirname, '../..', '.env') });

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

// ── Default Settings ─────────────────────────────────────────────────────────
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

const saveSettingsToFile = (settings) => {
  settings.appVersion = APP_VERSION;
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2));
};

const getWindowUrl = (winName, currentMode, settings) => {
  const baseParams = `appMode=${currentMode}&room=${settings.roomId}&sport=${settings.sport || 'cricket'}`;
  if (isDev) return `${VITE_DEV_SERVER_URL}/#/${winName}?${baseParams}`;
  return `file://${path.join(__dirname, "../../dist/index.html")}#/${winName}?${baseParams}`;
};

const commonWebPrefs = {
  preload: path.join(__dirname, "../preload.cjs"),
  contextIsolation: true,
  nodeIntegration: false
};

module.exports = {
  APP_VERSION,
  APP_MODE,
  isDev,
  VITE_DEV_SERVER_URL,
  DEFAULT_SETTINGS,
  settingsPath,
  loadSettings,
  saveSettingsToFile,
  getWindowUrl,
  commonWebPrefs
};
