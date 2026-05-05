/**
 * Scheduler Module
 * Manages the Python scheduler process
 */

const { spawn } = require("child_process");
const path = require("path");
const { getBackendRoot, getPythonEnv, getPythonPath } = require("./python-runtime.cjs");

let schedulerProcess = null;

const createScheduler = (appMode) => {
  const startScheduler = () => {
    if (schedulerProcess) {
      console.log('[Scheduler] Already running');
      return;
    }
    
    const pythonPath = getPythonPath();
    const scriptPath = path.join(__dirname, "../..", "automation", "scheduler", "main.py");
    
    console.log('[Scheduler] Starting scheduler process...');
    
    schedulerProcess = spawn(pythonPath, [scriptPath], {
      cwd: getBackendRoot(),
      env: getPythonEnv()
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
        if (appMode === 'prod') {
          console.log('[Scheduler] Auto-restarting...');
          startScheduler();
        }
      }, 5000);
    });
    
    schedulerProcess.on('error', (error) => {
      console.error(`[Scheduler] Failed to start:`, error);
      schedulerProcess = null;
    });
  };

  const stopScheduler = () => {
    if (schedulerProcess) {
      schedulerProcess.kill();
      schedulerProcess = null;
      console.log('[Scheduler] Stopped');
    }
  };

  const getSchedulerStatus = () => {
    return {
      running: !!schedulerProcess,
      pid: schedulerProcess ? schedulerProcess.pid : null
    };
  };

  return {
    startScheduler,
    stopScheduler,
    getSchedulerStatus
  };
};

module.exports = {
  createScheduler
};
