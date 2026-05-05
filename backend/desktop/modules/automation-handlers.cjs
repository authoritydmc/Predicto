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
  console.log(`[Enhanced Orchestrator] Python: ${pythonPath}`);
  console.log(`[Enhanced Orchestrator] Script: ${scriptPath}`);
  
  enhancedOrchestratorProcess = spawn(pythonPath, [scriptPath], {
    cwd: getBackendRoot(),
    env: getPythonEnv(),
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  // Track start time for uptime calculation
  enhancedOrchestratorProcess.startTime = Date.now();
  
  enhancedOrchestratorProcess.stdout.on('data', (data) => {
    const output = data.toString().trim();
    if (output) {
      console.log(`[Enhanced Orchestrator] ${output}`);
      
      // Broadcast to WebSocket clients for real-time monitoring
      try {
        broadcastToClients('automation:stdout', { data: output, timestamp: Date.now() });
      } catch (e) {
        // Ignore broadcast errors
      }
    }
  });
  
  enhancedOrchestratorProcess.stderr.on('data', (data) => {
    const output = data.toString().trim();
    if (output) {
      console.error(`[Enhanced Orchestrator] Error: ${output}`);
      
      // Broadcast errors to WebSocket clients
      try {
        broadcastToClients('automation:stderr', { data: output, timestamp: Date.now() });
      } catch (e) {
        // Ignore broadcast errors
      }
    }
  });
  
  enhancedOrchestratorProcess.on('close', (code, signal) => {
    console.log(`[Enhanced Orchestrator] Process exited with code ${code}, signal: ${signal}`);
    const uptime = enhancedOrchestratorProcess ? Date.now() - enhancedOrchestratorProcess.startTime : 0;
    console.log(`[Enhanced Orchestrator] Uptime: ${Math.round(uptime / 1000)}s`);
    
    // Broadcast process exit
    try {
      broadcastToClients('automation:exit', { code, signal, uptime, timestamp: Date.now() });
    } catch (e) {
      // Ignore broadcast errors
    }
    
    enhancedOrchestratorProcess = null;
    
    // Auto-restart in production mode (with exponential backoff)
    if (APP_MODE === 'prod') {
      const restartDelay = Math.min(30000, 5000 * Math.pow(2, startEnhancedOrchestrator.restartAttempts || 0));
      startEnhancedOrchestrator.restartAttempts = (startEnhancedOrchestrator.restartAttempts || 0) + 1;
      
      console.log(`[Enhanced Orchestrator] Auto-restarting in ${restartDelay}ms... (attempt ${startEnhancedOrchestrator.restartAttempts})`);
      
      setTimeout(() => {
        startEnhancedOrchestrator(APP_MODE);
      }, restartDelay);
    }
  });
  
  enhancedOrchestratorProcess.on('error', (error) => {
    console.error(`[Enhanced Orchestrator] Failed to start:`, error);
    
    // Broadcast error to clients
    try {
      broadcastToClients('automation:error', { error: error.message, timestamp: Date.now() });
    } catch (e) {
      // Ignore broadcast errors
    }
    
    enhancedOrchestratorProcess = null;
  });
  
  // Reset restart attempts on successful start
  setTimeout(() => {
    if (enhancedOrchestratorProcess && !enhancedOrchestratorProcess.killed) {
      startEnhancedOrchestrator.restartAttempts = 0;
      console.log('[Enhanced Orchestrator] Started successfully');
      
      // Broadcast successful start
      try {
        broadcastToClients('automation:start', { 
          pid: enhancedOrchestratorProcess.pid, 
          timestamp: Date.now() 
        });
      } catch (e) {
        // Ignore broadcast errors
      }
    }
  }, 3000);
};

const registerAutomationHandlers = (APP_MODE) => {
  // Start enhanced orchestrator in production mode
  if (APP_MODE === 'prod') {
    console.log('[Automation] Auto-starting enhanced orchestrator in production mode');
    startEnhancedOrchestrator(APP_MODE);
  } else {
    console.log('[Automation] Development mode - orchestrator not auto-started');
    console.log('[Automation] Use IPC "automation:start" to start manually');
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

  // Enhanced Orchestrator Control Handlers
  ipcMain.handle("automation:start", async () => {
    console.log('[Automation] Starting enhanced orchestrator...');
    if (enhancedOrchestratorProcess) {
      console.log('[Automation] Orchestrator already running');
      return { success: false, error: 'Orchestrator already running' };
    }
    
    try {
      startEnhancedOrchestrator('prod');
      return { success: true, message: 'Orchestrator started' };
    } catch (error) {
      console.error('[Automation] Failed to start orchestrator:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("automation:stop", async () => {
    console.log('[Automation] Stopping enhanced orchestrator...');
    if (!enhancedOrchestratorProcess) {
      console.log('[Automation] Orchestrator not running');
      return { success: false, error: 'Orchestrator not running' };
    }
    
    try {
      enhancedOrchestratorProcess.kill('SIGTERM');
      enhancedOrchestratorProcess = null;
      return { success: true, message: 'Orchestrator stopped' };
    } catch (error) {
      console.error('[Automation] Failed to stop orchestrator:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("automation:restart", async () => {
    console.log('[Automation] Restarting enhanced orchestrator...');
    
    try {
      // Stop if running
      if (enhancedOrchestratorProcess) {
        enhancedOrchestratorProcess.kill('SIGTERM');
        enhancedOrchestratorProcess = null;
        // Wait a moment for graceful shutdown
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Start again
      startEnhancedOrchestrator('prod');
      return { success: true, message: 'Orchestrator restarted' };
    } catch (error) {
      console.error('[Automation] Failed to restart orchestrator:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("automation:get-detailed-status", async () => {
    console.log('[Automation] Getting detailed orchestrator status...');
    
    const basicStatus = {
      running: enhancedOrchestratorProcess !== null,
      pid: enhancedOrchestratorProcess ? enhancedOrchestratorProcess.pid : null,
      uptime: enhancedOrchestratorProcess ? Date.now() - enhancedOrchestratorProcess.startTime : 0
    };

    // Try to get detailed status via WebSocket if available
    try {
      // This would require WebSocket client integration
      // For now, return basic status
      return {
        ...basicStatus,
        autoRestart: true,
        mode: 'prod'
      };
    } catch (error) {
      return {
        ...basicStatus,
        error: 'Failed to get detailed status',
        mode: 'prod'
      };
    }
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
