// Scraper Handlers Module for Predicto Host App
// This module handles web scraping-related functionality

const { ipcMain } = require('electron');

function registerScraperHandlers() {
  console.log('[Scraper] Registering scraper handlers');
  
  // Handle scraper run
  ipcMain.handle('scraper:run', async (event, sport, matchId, teamA, teamB, scraperOrder, matchUrl) => {
    console.log('[Scraper] Running scraper for:', { sport, matchId, teamA, teamB, scraperOrder, matchUrl });
    
    try {
      // Try to run scraper via backend automation
      const automationHandlers = require('./automation-handlers.cjs');
      if (automationHandlers.runScraperJob) {
        const result = await automationHandlers.runScraperJob({ sport, matchId, teamA, teamB, scraperOrder, matchUrl });
        return result;
      }
      
      // Fallback: return mock response
      return { 
        success: false, 
        error: 'Scraper not configured. Use Manual mode.',
        runs: 0,
        wickets: 0,
        overs: '0.0'
      };
    } catch (error) {
      console.error('[Scraper] Error:', error.message);
      return { success: false, error: error.message };
    }
  });
  
  // Handle scraping status
  ipcMain.handle('scraper:status', (event) => {
    return { running: false, lastRun: null };
  });
  
  console.log('[Scraper] Handlers registered');
}

module.exports = {
  registerScraperHandlers
};