const { spawn } = require('child_process');
const path = require('path');

// Bridge between Electron app and Python automation system
class AutomationBridge {
  constructor() {
    // Point to backend/automation folder
    this.automationPath = path.resolve(__dirname, '..', '..', 'backend');
    this.isRunning = false;
  }

  async startAutomation() {
    try {
      console.log('[Automation] Starting automation system...');
      
      return new Promise((resolve, reject) => {
        const process = spawn('python', [
          '-m', 'automation.main',
          'scheduler', 'start'
        ], {
          cwd: this.automationPath,
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let output = '';
        let errorOutput = '';

        process.stdout.on('data', (data) => {
          output += data.toString();
        });

        process.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });

        process.on('close', (code) => {
          if (code === 0) {
            this.isRunning = true;
            console.log('[Automation] Started successfully:', output);
            resolve({ success: true, output });
          } else {
            console.error('[Automation] Failed to start:', errorOutput);
            reject(new Error(`Automation failed with code ${code}: ${errorOutput}`));
          }
        });

        process.on('error', (error) => {
          console.error('[Automation] Process error:', error);
          reject(error);
        });
      });
    } catch (error) {
      console.error('[Automation] Error starting automation:', error);
      throw error;
    }
  }

  async stopAutomation() {
    try {
      console.log('[Automation] Stopping automation system...');
      
      return new Promise((resolve, reject) => {
        const process = spawn('python', [
          '-m', 'automation.main',
          'scheduler', 'stop'
        ], {
          cwd: this.automationPath,
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let output = '';
        let errorOutput = '';

        process.stdout.on('data', (data) => {
          output += data.toString();
        });

        process.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });

        process.on('close', (code) => {
          if (code === 0) {
            this.isRunning = false;
            console.log('[Automation] Stopped successfully:', output);
            resolve({ success: true, output });
          } else {
            console.error('[Automation] Failed to stop:', errorOutput);
            reject(new Error(`Automation stop failed with code ${code}: ${errorOutput}`));
          }
        });

        process.on('error', (error) => {
          console.error('[Automation] Process error:', error);
          reject(error);
        });
      });
    } catch (error) {
      console.error('[Automation] Error stopping automation:', error);
      throw error;
    }
  }

  async getStatus() {
    try {
      console.log('[Automation] Getting status...');
      
      return new Promise((resolve, reject) => {
        const process = spawn('python', [
          '-m', 'automation.main',
          'scheduler', 'status'
        ], {
          cwd: this.automationPath,
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let output = '';
        let errorOutput = '';

        process.stdout.on('data', (data) => {
          output += data.toString();
        });

        process.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });

        process.on('close', (code) => {
          if (code === 0) {
            console.log('[Automation] Status retrieved:', output);
            resolve({ 
              running: this.isRunning, 
              status: output.trim(),
              output 
            });
          } else {
            console.error('[Automation] Failed to get status:', errorOutput);
            reject(new Error(`Status check failed with code ${code}: ${errorOutput}`));
          }
        });

        process.on('error', (error) => {
          console.error('[Automation] Process error:', error);
          reject(error);
        });
      });
    } catch (error) {
      console.error('[Automation] Error getting status:', error);
      throw error;
    }
  }

  async runScript(scriptName, args = []) {
    try {
      console.log(`[Automation] Running script: ${scriptName}`);
      
      return new Promise((resolve, reject) => {
        const process = spawn('python', [
          '-m', 'automation.main',
          'run', 'script', scriptName, ...args
        ], {
          cwd: this.automationPath,
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let output = '';
        let errorOutput = '';

        process.stdout.on('data', (data) => {
          output += data.toString();
        });

        process.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });

        process.on('close', (code) => {
          if (code === 0) {
            console.log(`[Automation] Script completed: ${output}`);
            resolve({ success: true, output });
          } else {
            console.error(`[Automation] Script failed: ${errorOutput}`);
            reject(new Error(`Script ${scriptName} failed with code ${code}: ${errorOutput}`));
          }
        });

        process.on('error', (error) => {
          console.error('[Automation] Process error:', error);
          reject(error);
        });
      });
    } catch (error) {
      console.error(`[Automation] Error running script ${scriptName}:`, error);
      throw error;
    }
  }
}

module.exports = { AutomationBridge };
