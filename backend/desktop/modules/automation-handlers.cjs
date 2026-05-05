/**
 * Automation & Scraper IPC Handlers Module
 * Handles all automation-related IPC calls
 */

const { ipcMain } = require("electron");
const { spawn } = require("child_process");
const { getBackendRoot, getPythonEnv, getPythonPath } = require("./python-runtime.cjs");
const { getBackendPath, runPython, runPythonJson } = require("./process-runner.cjs");

let enhancedOrchestratorProcess = null;

const startEnhancedOrchestrator = (APP_MODE) => {
  if (enhancedOrchestratorProcess) {
    console.log('[Enhanced Orchestrator] Already running');
    return;
  }
  
  const pythonPath = getPythonPath();
  const scriptPath = getBackendPath("automation", "orchestrator", "main.py");
  
  console.log('[Enhanced Orchestrator] Starting enhanced orchestrator process...');
  
  enhancedOrchestratorProcess = spawn(pythonPath, [scriptPath], {
    cwd: getBackendRoot(),
    env: getPythonEnv()
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
    if (APP_MODE === 'prod') {
      setTimeout(() => {
        console.log('[Enhanced Orchestrator] Auto-restarting...');
        startEnhancedOrchestrator(APP_MODE);
      }, 5000);
    }
  });
  
  enhancedOrchestratorProcess.on('error', (error) => {
    console.error(`[Enhanced Orchestrator] Failed to start:`, error);
    enhancedOrchestratorProcess = null;
  });
};

const registerAutomationHandlers = (APP_MODE) => {
  // Start enhanced orchestrator in production mode
  if (APP_MODE === 'prod') {
    startEnhancedOrchestrator(APP_MODE);
  }

  // ── Enhanced Orchestrator Handlers ──────────────────────────────────────────
  ipcMain.handle("automation:get-status", async () => ({
    running: enhancedOrchestratorProcess !== null,
    pid: enhancedOrchestratorProcess ? enhancedOrchestratorProcess.pid : null
  }));

  ipcMain.handle("automation:trigger-task", async (_event, taskId) => {
    console.log(`[Automation] Triggering task: ${taskId}`);
    
    const scriptPath = getBackendPath("automation", "orchestrator", "main.py");
    const result = await runPython([scriptPath, '--trigger-task', taskId]);

    if (result.success) {
      console.log(`[Automation] Task ${taskId} completed successfully`);
      return { success: true, taskId, status: 'success' };
    }

    if (result.error) {
      console.error(`[Automation] Failed to start task ${taskId}:`, result.error);
      return { success: false, error: 'Failed to start task', taskId, details: result.error.message };
    }

    console.error(`[Automation] Task ${taskId} failed with code ${result.code}:`, result.stderr);
    return { success: false, error: `Task failed with code ${result.code}`, taskId, stderr: result.stderr };
  });

  ipcMain.handle("automation:update-config", async (_event, component, updates) => {
    console.log(`[Automation] Updating config for ${component}:`, updates);
    
    const scriptPath = getBackendPath("automation", "orchestrator", "main.py");
    return runPythonJson([scriptPath, '--update-config', component, JSON.stringify(updates)], {
      parseError: 'Failed to parse result',
      exitError: 'Config update failed'
    });
  });

  ipcMain.handle("automation:test-scraper", async (_event, scraperName, testMatch) => {
    console.log(`[Automation] Testing scraper: ${scraperName}`);
    
    const scriptPath = getBackendPath("automation", "orchestrator", "main.py");
    return runPythonJson([scriptPath, '--test-scraper', scraperName, JSON.stringify(testMatch)], {
      parseError: 'Failed to parse result',
      exitError: 'Scraper test failed'
    });
  });

  ipcMain.handle("automation:get-logs", async (_event, component, level, limit) => {
    console.log(`[Automation] Getting logs for ${component}, level: ${level}, limit: ${limit}`);
    
    const scriptPath = getBackendPath("automation", "orchestrator", "main.py");
    return runPythonJson([scriptPath, '--get-logs', component || 'all', level || 'all', limit || '100'], {
      parseError: 'Failed to parse logs',
      exitError: 'Failed to get logs'
    });
  });

  console.log('[IPC] Automation handlers registered');
};

module.exports = {
  registerAutomationHandlers,
  startEnhancedOrchestrator,
  getOrchestratorStatus: () => ({
    running: enhancedOrchestratorProcess !== null,
    pid: enhancedOrchestratorProcess ? enhancedOrchestratorProcess.pid : null
  })
};
