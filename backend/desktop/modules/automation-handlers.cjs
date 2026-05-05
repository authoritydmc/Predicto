/**
 * Automation & Scraper IPC Handlers Module
 * Handles all automation-related IPC calls
 */

const { ipcMain, app } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const { getBackendRoot, getPythonEnv, getPythonPath } = require("./python-runtime.cjs");

let enhancedOrchestratorProcess = null;

const startEnhancedOrchestrator = (APP_MODE) => {
  if (enhancedOrchestratorProcess) {
    console.log('[Enhanced Orchestrator] Already running');
    return;
  }
  
  const pythonPath = getPythonPath();
  const scriptPath = path.join(__dirname, "../..", "automation", "orchestrator", "main.py");
  
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
    
    const pythonPath = getPythonPath();
    const scriptPath = path.join(__dirname, "../..", "automation", "orchestrator", "main.py");
    
    return new Promise((resolve) => {
      const pythonProcess = spawn(pythonPath, [scriptPath, '--trigger-task', taskId], {
        cwd: getBackendRoot(),
        env: getPythonEnv()
      });
      
      let stdout = '';
      let stderr = '';
      
      pythonProcess.stdout.on('data', (data) => { stdout += data.toString(); });
      pythonProcess.stderr.on('data', (data) => { stderr += data.toString(); });
      
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
    
    const pythonPath = getPythonPath();
    const scriptPath = path.join(__dirname, "../..", "automation", "orchestrator", "main.py");
    
    return new Promise((resolve) => {
      const pythonProcess = spawn(pythonPath, [
        scriptPath, '--update-config', component, JSON.stringify(updates)
      ], {
        cwd: getBackendRoot(),
        env: getPythonEnv()
      });
      
      let stdout = '';
      let stderr = '';
      
      pythonProcess.stdout.on('data', (data) => { stdout += data.toString(); });
      pythonProcess.stderr.on('data', (data) => { stderr += data.toString(); });
      
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try { resolve(JSON.parse(stdout)); } 
          catch (e) { resolve({ success: false, error: 'Failed to parse result' }); }
        } else {
          resolve({ success: false, error: `Config update failed with code ${code}` });
        }
      });
    });
  });

  ipcMain.handle("automation:test-scraper", async (_event, scraperName, testMatch) => {
    console.log(`[Automation] Testing scraper: ${scraperName}`);
    
    const pythonPath = getPythonPath();
    const scriptPath = path.join(__dirname, "../..", "automation", "orchestrator", "main.py");
    
    return new Promise((resolve) => {
      const pythonProcess = spawn(pythonPath, [
        scriptPath, '--test-scraper', scraperName, JSON.stringify(testMatch)
      ], {
        cwd: getBackendRoot(),
        env: getPythonEnv()
      });
      
      let stdout = '';
      let stderr = '';
      
      pythonProcess.stdout.on('data', (data) => { stdout += data.toString(); });
      pythonProcess.stderr.on('data', (data) => { stderr += data.toString(); });
      
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try { resolve(JSON.parse(stdout)); } 
          catch (e) { resolve({ success: false, error: 'Failed to parse result' }); }
        } else {
          resolve({ success: false, error: `Scraper test failed with code ${code}` });
        }
      });
    });
  });

  ipcMain.handle("automation:get-logs", async (_event, component, level, limit) => {
    console.log(`[Automation] Getting logs for ${component}, level: ${level}, limit: ${limit}`);
    
    const pythonPath = getPythonPath();
    const scriptPath = path.join(__dirname, "../..", "automation", "orchestrator", "main.py");
    
    return new Promise((resolve) => {
      const pythonProcess = spawn(pythonPath, [
        scriptPath, '--get-logs', component || 'all', level || 'all', limit || '100'
      ], {
        cwd: getBackendRoot(),
        env: getPythonEnv()
      });
      
      let stdout = '';
      pythonProcess.stdout.on('data', (data) => { stdout += data.toString(); });
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try { resolve(JSON.parse(stdout)); } 
          catch (e) { resolve({ success: false, error: 'Failed to parse logs' }); }
        } else {
          resolve({ success: false, error: `Failed to get logs with code ${code}` });
        }
      });
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
