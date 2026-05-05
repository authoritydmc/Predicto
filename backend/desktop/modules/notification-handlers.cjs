/**
 * Notification Handlers Module
 * Discord and Push notification IPC handlers
 */

const { ipcMain, shell } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const { getBackendRoot, getPythonEnv, getPythonPath } = require("./python-runtime.cjs");

const registerNotificationHandlers = () => {
  const pythonPath = getPythonPath();
  const orchestratorScript = path.join(__dirname, "../..", "automation", "orchestrator", "main.py");

  // ── Discord Notification Handlers ───────────────────────────────────────────
  ipcMain.handle("automation:test-discord", async () => {
    console.log('[Discord] Testing Discord notification');
    
    return new Promise((resolve) => {
      const pythonProcess = spawn(pythonPath, [orchestratorScript, '--test-discord'], {
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
          catch (e) { resolve({ success: false, error: 'Failed to parse test result' }); }
        } else {
          resolve({ success: false, error: `Test failed with code ${code}` });
        }
      });
    });
  });

  ipcMain.handle("automation:update-discord-config", async (_event, config) => {
    console.log('[Discord] Updating Discord configuration:', config);
    
    return new Promise((resolve) => {
      const pythonProcess = spawn(pythonPath, [
        orchestratorScript, '--update-discord-config', JSON.stringify(config)
      ], {
        cwd: getBackendRoot(),
        env: getPythonEnv()
      });
      
      let stdout = '';
      pythonProcess.stdout.on('data', (data) => { stdout += data.toString(); });
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

  ipcMain.handle("automation:get-notification-status", async () => {
    console.log('[Discord] Getting notification status');
    
    return new Promise((resolve) => {
      const pythonProcess = spawn(pythonPath, [orchestratorScript, '--notification-status'], {
        cwd: getBackendRoot(),
        env: getPythonEnv()
      });
      
      let stdout = '';
      pythonProcess.stdout.on('data', (data) => { stdout += data.toString(); });
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try { resolve(JSON.parse(stdout)); } 
          catch (e) { resolve({ success: false, error: 'Failed to parse status' }); }
        } else {
          resolve({ success: false, error: `Status check failed with code ${code}` });
        }
      });
    });
  });

  // ── Push Notification Handlers ──────────────────────────────────────────────
  ipcMain.handle("push:register-device", async (_event, userId, deviceInfo) => {
    console.log(`[Push] Registering device for user ${userId}`);
    
    return new Promise((resolve) => {
      const pythonProcess = spawn(pythonPath, [
        orchestratorScript, '--register-device', userId, JSON.stringify(deviceInfo)
      ], {
        cwd: getBackendRoot(),
        env: getPythonEnv()
      });
      
      let stdout = '';
      pythonProcess.stdout.on('data', (data) => { stdout += data.toString(); });
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try { resolve(JSON.parse(stdout)); } 
          catch (e) { resolve({ success: false, error: 'Failed to parse result' }); }
        } else {
          resolve({ success: false, error: `Registration failed with code ${code}` });
        }
      });
    });
  });

  ipcMain.handle("push:unregister-device", async (_event, userId, deviceId) => {
    console.log(`[Push] Unregistering device ${deviceId} for user ${userId}`);
    
    return new Promise((resolve) => {
      const pythonProcess = spawn(pythonPath, [
        orchestratorScript, '--unregister-device', userId, deviceId
      ], {
        cwd: getBackendRoot(),
        env: getPythonEnv()
      });
      
      let stdout = '';
      pythonProcess.stdout.on('data', (data) => { stdout += data.toString(); });
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try { resolve(JSON.parse(stdout)); } 
          catch (e) { resolve({ success: false, error: 'Failed to parse result' }); }
        } else {
          resolve({ success: false, error: `Unregistration failed with code ${code}` });
        }
      });
    });
  });

  ipcMain.handle("push:get-user-settings", async (_event, userId) => {
    console.log(`[Push] Getting notification settings for user ${userId}`);
    
    return new Promise((resolve) => {
      const pythonProcess = spawn(pythonPath, [
        orchestratorScript, '--get-user-settings', userId
      ], {
        cwd: getBackendRoot(),
        env: getPythonEnv()
      });
      
      let stdout = '';
      pythonProcess.stdout.on('data', (data) => { stdout += data.toString(); });
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try { resolve(JSON.parse(stdout)); } 
          catch (e) { resolve({ success: false, error: 'Failed to parse settings' }); }
        } else {
          resolve({ success: false, error: `Failed to get settings with code ${code}` });
        }
      });
    });
  });

  ipcMain.handle("push:update-user-settings", async (_event, userId, settings) => {
    console.log(`[Push] Updating notification settings for user ${userId}`);
    
    return new Promise((resolve) => {
      const pythonProcess = spawn(pythonPath, [
        orchestratorScript, '--update-user-settings', userId, JSON.stringify(settings)
      ], {
        cwd: getBackendRoot(),
        env: getPythonEnv()
      });
      
      let stdout = '';
      pythonProcess.stdout.on('data', (data) => { stdout += data.toString(); });
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try { resolve(JSON.parse(stdout)); } 
          catch (e) { resolve({ success: false, error: 'Failed to parse result' }); }
        } else {
          resolve({ success: false, error: `Settings update failed with code ${code}` });
        }
      });
    });
  });

  ipcMain.handle("push:get-user-devices", async (_event, userId) => {
    console.log(`[Push] Getting devices for user ${userId}`);
    
    return new Promise((resolve) => {
      const pythonProcess = spawn(pythonPath, [
        orchestratorScript, '--get-user-devices', userId
      ], {
        cwd: getBackendRoot(),
        env: getPythonEnv()
      });
      
      let stdout = '';
      pythonProcess.stdout.on('data', (data) => { stdout += data.toString(); });
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try { resolve(JSON.parse(stdout)); } 
          catch (e) { resolve({ success: false, error: 'Failed to parse devices' }); }
        } else {
          resolve({ success: false, error: `Failed to get devices with code ${code}` });
        }
      });
    });
  });

  ipcMain.handle("push:test-notification", async (_event, userId) => {
    console.log(`[Push] Testing push notification for user ${userId}`);
    
    return new Promise((resolve) => {
      const pythonProcess = spawn(pythonPath, [
        orchestratorScript, '--test-push-notification', userId || 'test'
      ], {
        cwd: getBackendRoot(),
        env: getPythonEnv()
      });
      
      let stdout = '';
      pythonProcess.stdout.on('data', (data) => { stdout += data.toString(); });
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try { resolve(JSON.parse(stdout)); } 
          catch (e) { resolve({ success: false, error: 'Failed to parse test result' }); }
        } else {
          resolve({ success: false, error: `Test failed with code ${code}` });
        }
      });
    });
  });

  ipcMain.handle("push:get-vapid-key", async () => {
    console.log('[Push] Getting VAPID public key');
    
    return new Promise((resolve) => {
      const pythonProcess = spawn(pythonPath, [
        orchestratorScript, '--get-vapid-key'
      ], {
        cwd: getBackendRoot(),
        env: getPythonEnv()
      });
      
      let stdout = '';
      pythonProcess.stdout.on('data', (data) => { stdout += data.toString(); });
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try { resolve(JSON.parse(stdout)); } 
          catch (e) { resolve({ success: false, error: 'Failed to parse VAPID key' }); }
        } else {
          resolve({ success: false, error: `Failed to get VAPID key with code ${code}` });
        }
      });
    });
  });

  console.log('[IPC] Notification handlers registered');
};

module.exports = {
  registerNotificationHandlers
};
