/**
 * Notification Handlers Module
 * Discord and Push notification IPC handlers
 */

const { ipcMain } = require("electron");
const { getBackendPath, runPythonJson } = require("./process-runner.cjs");

const notificationCommand = (args, messages = {}) => runPythonJson(args, {
  parseError: messages.parseError || "Failed to parse notification result",
  exitError: messages.exitError || "Notification command failed",
  startError: messages.startError || "Failed to start notification command"
});

const registerNotificationHandlers = () => {
  const orchestratorScript = getBackendPath("automation", "orchestrator", "main.py");

  // ── Discord Notification Handlers ───────────────────────────────────────────
  ipcMain.handle("automation:test-discord", async () => {
    console.log('[Discord] Testing Discord notification');
    return notificationCommand([orchestratorScript, '--test-discord'], {
      parseError: 'Failed to parse test result',
      exitError: 'Discord test failed'
    });
  });

  ipcMain.handle("automation:update-discord-config", async (_event, config) => {
    console.log('[Discord] Updating Discord configuration:', config);
    return notificationCommand([orchestratorScript, '--update-discord-config', JSON.stringify(config)], {
      parseError: 'Failed to parse result',
      exitError: 'Discord config update failed'
    });
  });

  ipcMain.handle("automation:get-notification-status", async () => {
    console.log('[Discord] Getting notification status');
    return notificationCommand([orchestratorScript, '--notification-status'], {
      parseError: 'Failed to parse status',
      exitError: 'Notification status check failed'
    });
  });

  // ── Push Notification Handlers ──────────────────────────────────────────────
  ipcMain.handle("push:register-device", async (_event, userId, deviceInfo) => {
    console.log(`[Push] Registering device for user ${userId}`);
    return notificationCommand([orchestratorScript, '--register-device', userId, JSON.stringify(deviceInfo)], {
      parseError: 'Failed to parse result',
      exitError: 'Push registration failed'
    });
  });

  ipcMain.handle("push:unregister-device", async (_event, userId, deviceId) => {
    console.log(`[Push] Unregistering device ${deviceId} for user ${userId}`);
    return notificationCommand([orchestratorScript, '--unregister-device', userId, deviceId], {
      parseError: 'Failed to parse result',
      exitError: 'Push unregistration failed'
    });
  });

  ipcMain.handle("push:get-user-settings", async (_event, userId) => {
    console.log(`[Push] Getting notification settings for user ${userId}`);
    return notificationCommand([orchestratorScript, '--get-user-settings', userId], {
      parseError: 'Failed to parse settings',
      exitError: 'Failed to get push settings'
    });
  });

  ipcMain.handle("push:update-user-settings", async (_event, userId, settings) => {
    console.log(`[Push] Updating notification settings for user ${userId}`);
    return notificationCommand([orchestratorScript, '--update-user-settings', userId, JSON.stringify(settings)], {
      parseError: 'Failed to parse result',
      exitError: 'Push settings update failed'
    });
  });

  ipcMain.handle("push:get-user-devices", async (_event, userId) => {
    console.log(`[Push] Getting devices for user ${userId}`);
    return notificationCommand([orchestratorScript, '--get-user-devices', userId], {
      parseError: 'Failed to parse devices',
      exitError: 'Failed to get push devices'
    });
  });

  ipcMain.handle("push:test-notification", async (_event, userId) => {
    console.log(`[Push] Testing push notification for user ${userId}`);
    return notificationCommand([orchestratorScript, '--test-push-notification', userId || 'test'], {
      parseError: 'Failed to parse test result',
      exitError: 'Push notification test failed'
    });
  });

  ipcMain.handle("push:get-vapid-key", async () => {
    console.log('[Push] Getting VAPID public key');
    return notificationCommand([orchestratorScript, '--get-vapid-key'], {
      parseError: 'Failed to parse VAPID key',
      exitError: 'Failed to get VAPID key'
    });
  });

  console.log('[IPC] Notification handlers registered');
};

module.exports = {
  registerNotificationHandlers
};
