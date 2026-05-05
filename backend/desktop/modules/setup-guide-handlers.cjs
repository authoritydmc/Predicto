/**
 * Setup Guide Handlers Module
 * Handles setup guide IPC calls
 */

const { ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");

const registerSetupGuideHandlers = () => {
  const guidePaths = {
    'discord': path.join(__dirname, "../..", "automation", "notifications", "DISCORD_SETUP_GUIDE.md"),
    'push': path.join(__dirname, "../..", "automation", "notifications", "PUSH_NOTIFICATION_SETUP_GUIDE.md")
  };

  ipcMain.handle("app:open-setup-guide", async (_event, guideType) => {
    console.log(`[App] Opening setup guide: ${guideType}`);
    
    const guidePath = guidePaths[guideType];
    if (!guidePath) {
      return { success: false, error: 'Invalid guide type' };
    }
    
    try {
      if (!fs.existsSync(guidePath)) {
        return { success: false, error: 'Guide file not found' };
      }
      
      await shell.openPath(guidePath);
      return { success: true, message: 'Setup guide opened' };
    } catch (error) {
      console.error('[App] Error opening setup guide:', error);
      return { success: false, error: 'Failed to open setup guide' };
    }
  });

  ipcMain.handle("app:get-setup-guide-content", async (_event, guideType) => {
    console.log(`[App] Getting setup guide content: ${guideType}`);
    
    const guidePath = guidePaths[guideType];
    if (!guidePath) {
      return { success: false, error: 'Invalid guide type' };
    }
    
    try {
      if (!fs.existsSync(guidePath)) {
        return { success: false, error: 'Guide file not found' };
      }
      
      const content = fs.readFileSync(guidePath, 'utf8');
      return { success: true, content };
    } catch (error) {
      console.error('[App] Error reading setup guide:', error);
      return { success: false, error: 'Failed to read setup guide' };
    }
  });

  console.log('[IPC] Setup guide handlers registered');
};

module.exports = {
  registerSetupGuideHandlers
};
