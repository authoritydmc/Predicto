/**
 * Resolution & Legacy Scheduler Handlers Module
 * Match resolution and legacy scheduler IPC handlers
 */

const { ipcMain } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const { getBackendRoot, getPythonEnv, getPythonPath } = require("./python-runtime.cjs");

const registerResolutionHandlers = (config, automationHandlers) => {
  const pythonPath = getPythonPath();

  // ── Legacy Scheduler Handlers ──────────────────────────────────────────────
  ipcMain.handle("scheduler:get-status", async () => {
    const status = automationHandlers.getOrchestratorStatus();
    return {
      running: status.running,
      pid: status.pid
    };
  });

  ipcMain.handle("scheduler:trigger-task", async (_event, taskId) => {
    console.log(`[Scheduler] Triggering task: ${taskId}`);
    
    let scriptPath = '';
    
    if (taskId === 'cricket_score_calc') {
      scriptPath = path.join(__dirname, "../..", "automation", "cricket", "run_calculator.py");
    } else if (taskId === 'football_score_calc') {
      scriptPath = path.join(__dirname, "../..", "automation", "football", "run_calculator.py");
    } else if (taskId === 'tournament_leaderboard') {
      scriptPath = path.join(__dirname, "../..", "automation", "base", "run_leaderboard.py");
    } else {
      return { success: false, error: 'Unknown task ID' };
    }
    
    return new Promise((resolve) => {
      const pythonProcess = spawn(pythonPath, [scriptPath], {
        cwd: getBackendRoot(),
        env: getPythonEnv()
      });
      
      let stdout = '';
      let stderr = '';
      
      pythonProcess.stdout.on('data', (data) => { stdout += data.toString(); });
      pythonProcess.stderr.on('data', (data) => { stderr += data.toString(); });
      
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

  ipcMain.handle("scheduler:update-task", async (_event, taskId, taskConfig) => {
    console.log(`[Scheduler] Updating task: ${taskId}`, taskConfig);
    return { success: true, taskId };
  });

  // ── Match Resolution Handler ────────────────────────────────────────────────
  ipcMain.handle("resolution:process-match", async (_event, sport, tournamentId, matchId, innings = 'both', force = false, firebaseMode = 'prod') => {
    console.log("================================================================================");
    console.log(`[Resolution] Starting match resolution process`);
    console.log(`[Resolution] Sport: ${sport}`);
    console.log(`[Resolution] Tournament ID: ${tournamentId}`);
    console.log(`[Resolution] Match ID: ${matchId}`);
    console.log(`[Resolution] Innings: ${innings}`);
    console.log(`[Resolution] Force: ${force} (type: ${typeof force})`);
    console.log(`[Resolution] Firebase Mode: ${firebaseMode}`);
    console.log("================================================================================");
    
    let scriptPath = '';
    
    if (sport === 'cricket') {
      scriptPath = path.join(__dirname, "../..", "automation", "cricket", "run_calculator.py");
    } else if (sport === 'football') {
      scriptPath = path.join(__dirname, "../..", "automation", "football", "run_calculator.py");
    } else {
      console.error(`[Resolution] ERROR: Unsupported sport: ${sport}`);
      return { success: false, error: 'Unsupported sport' };
    }
    
    console.log(`[Resolution] Python path: ${pythonPath}`);
    console.log(`[Resolution] Script path: ${scriptPath}`);
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
      if (force) pythonArgs.push('--force');
      
      const pythonProcess = spawn(pythonPath, pythonArgs, {
        cwd: getBackendRoot(),
        env: getPythonEnv(firebaseEnv)
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
          if (line.trim()) console.error(`[Resolution Error] ${line}`);
        });
        stderr += data.toString();
      });
      
      pythonProcess.on('close', (code) => {
        console.log("================================================================================");
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
        console.log("================================================================================");
      });
      
      pythonProcess.on('error', (error) => {
        console.error("================================================================================");
        console.error(`[Resolution] ERROR: Failed to start Python process`);
        console.error(`[Resolution] Error details: ${error.message}`);
        console.error("================================================================================");
        resolve({ success: false, error: 'Failed to start process', details: error.message });
      });
    });
  });

  console.log('[IPC] Resolution handlers registered');
};

module.exports = {
  registerResolutionHandlers
};
