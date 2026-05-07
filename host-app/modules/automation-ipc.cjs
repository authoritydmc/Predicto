const { ipcMain } = require('electron');
const { AutomationBridge } = require('./automation-bridge');

// Initialize automation bridge
const automationBridge = new AutomationBridge();

// Register automation IPC handlers
ipcMain.handle('automation:start', async () => {
  try {
    console.log('[IPC] Starting automation...');
    const result = await automationBridge.startAutomation();
    return { success: true, ...result };
  } catch (error) {
    console.error('[IPC] Error starting automation:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('automation:stop', async () => {
  try {
    console.log('[IPC] Stopping automation...');
    const result = await automationBridge.stopAutomation();
    return { success: true, ...result };
  } catch (error) {
    console.error('[IPC] Error stopping automation:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('automation:status', async () => {
  try {
    console.log('[IPC] Getting automation status...');
    const result = await automationBridge.getStatus();
    return { success: true, ...result };
  } catch (error) {
    console.error('[IPC] Error getting automation status:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('automation:run-script', async (event, { scriptName, args = [] }) => {
  try {
    console.log(`[IPC] Running script: ${scriptName}`);
    const result = await automationBridge.runScript(scriptName, args);
    return { success: true, ...result };
  } catch (error) {
    console.error(`[IPC] Error running script ${scriptName}:`, error);
    return { success: false, error: error.message };
  }
});

console.log('[Automation IPC] Automation handlers registered');
