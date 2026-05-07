/**
 * Automation Handlers - Bridge between Electron and Python Backend
 * 
 * This module handles IPC communication with the Python automation backend
 * via HTTP API calls to port 8765.
 */

const http = require('http');
const { spawn } = require('child_process');

// Backend API base URL
const API_BASE = 'http://localhost:8765';

/**
 * Make HTTP request to backend API
 */
function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(body);
        }
      });
    });

    req.on('error', (e) => reject(e));
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

/**
 * Get orchestrator status
 */
function getOrchestratorStatus() {
  return {
    running: false,
    lastUpdate: null,
    jobs: [],
  };
}

/**
 * Register automation IPC handlers
 */
function registerAutomationHandlers(ipcMain) {
  console.log('[Automation] Registering automation handlers');

  // Get automation status
  ipcMain.handle('automation:getStatus', async () => {
    try {
      const result = await makeRequest('/api/automation/status');
      return result;
    } catch (e) {
      console.error('[Automation] Status error:', e.message);
      return { running: false, error: e.message };
    }
  });

  // Start scheduler
  ipcMain.handle('automation:startScheduler', async () => {
    try {
      const result = await makeRequest('/api/automation/scheduler/start', 'POST');
      return result;
    } catch (e) {
      console.error('[Automation] Start error:', e.message);
      return { success: false, error: e.message };
    }
  });

  // Stop scheduler
  ipcMain.handle('automation:stopScheduler', async () => {
    try {
      const result = await makeRequest('/api/automation/scheduler/stop', 'POST');
      return result;
    } catch (e) {
      console.error('[Automation] Stop error:', e.message);
      return { success: false, error: e.message };
    }
  });

  // Run automation task
  ipcMain.handle('automation:runTask', async (event, taskName, args = {}) => {
    try {
      const result = await makeRequest(`/api/automation/run/${taskName}`, 'POST', args);
      return result;
    } catch (e) {
      console.error('[Automation] Task error:', e.message);
      return { success: false, error: e.message };
    }
  });

  // Get live matches
  ipcMain.handle('automation:getLiveMatches', async (event, sport = 'cricket') => {
    try {
      const result = await makeRequest(`/api/automation/live-matches?sport=${sport}`);
      return result;
    } catch (e) {
      console.error('[Automation] Live matches error:', e.message);
      return { matches: [], error: e.message };
    }
  });

  // Get match status
  ipcMain.handle('automation:getMatchStatus', async (event, matchId) => {
    try {
      const result = await makeRequest(`/api/automation/match/${matchId}/status`);
      return result;
    } catch (e) {
      console.error('[Automation] Match status error:', e.message);
      return { error: e.message };
    }
  });

  console.log('[Automation] Handlers registered');
}

module.exports = {
  registerAutomationHandlers,
  getOrchestratorStatus,
};