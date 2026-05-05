/**
 * Scraper Handlers Module
 * Google scraping and solver IPC handlers
 */

const { ipcMain, BrowserWindow, shell, app } = require("electron");
const path = require("path");
const fs = require("fs");
const { getBackendPath, runPython } = require("./process-runner.cjs");

const registerScraperHandlers = () => {
  const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  // ── Google Win Probability Scraper ──────────────────────────────────────────
  ipcMain.handle("google:fetch-win-prob", async (_event, url) => {
    if (!url) return null;
    
    const scraperWindow = new BrowserWindow({
      width: 1280, height: 800, show: false,
      webPreferences: { offscreen: true, webSecurity: false, contextIsolation: false }
    });
    
    try {
      await scraperWindow.loadURL(url, { userAgent });
      
      const script = `
        new Promise(resolve => {
          let attempts = 0;
          const interval = setInterval(() => {
            const findInFrame = (win) => {
              try {
                const doc = win.document;
                const selectors = [
                  ['.liveresults-sports-immersive__lr-imso-ss-wp-ft', '.liveresults-sports-immersive__lr-imso-ss-wp-st'],
                  ['.imso_mh__win-pr-p', '.imso_mh__win-pr-p']
                ];
                for (const [selA, selB] of selectors) {
                  const els = Array.from(doc.querySelectorAll(selA + ',' + selB));
                  if (els.length >= 2) {
                    const valA = els[0].innerText.match(/\\d+/);
                    const valB = els[1].innerText.match(/\\d+/);
                    if (valA && valB) return { probA: valA[0] + '%', probB: valB[0] + '%' };
                  }
                }
                const bodyText = doc.body.innerText;
                const matches = bodyText.match(/(\\d+)%/g);
                if (matches && matches.length >= 2) {
                  for (let i = 0; i < matches.length - 1; i++) {
                    const v1 = parseInt(matches[i]); const v2 = parseInt(matches[i+1]);
                    if (v1 + v2 === 100 || (v1 + v2 > 98 && v1 + v2 < 102)) return { probA: v1 + '%', probB: v2 + '%' };
                  }
                }
              } catch(e) { return null; }
              return null;
            };
            const searchAllFrames = (win) => {
              let res = findInFrame(win); if (res) return res;
              for (let i = 0; i < win.frames.length; i++) {
                try { const r = searchAllFrames(win.frames[i]); if (r) return r; } catch(e) {}
              }
              return null;
            };
            const finalResult = searchAllFrames(window);
            if (finalResult || attempts > 25) { clearInterval(interval); resolve(finalResult || null); }
            attempts++;
          }, 1000);
        });
      `;
      
      const result = await scraperWindow.webContents.executeJavaScript(script);
      const image = await scraperWindow.webContents.capturePage();
      const debugPath = path.join(app.getPath("userData"), "scraper_debug.png");
      fs.writeFileSync(debugPath, image.toPNG());
      scraperWindow.destroy();
      return result;
    } catch (error) {
      console.error("Scraper Error:", error);
      if (!scraperWindow.isDestroyed()) {
        try {
          const image = await scraperWindow.webContents.capturePage();
          fs.writeFileSync(path.join(app.getPath("userData"), "scraper_debug.png"), image.toPNG());
        } catch {}
        scraperWindow.destroy();
      }
      return null;
    }
  });

  ipcMain.handle("scraper:view-debug", () => {
    const debugPath = path.join(app.getPath("userData"), "scraper_debug.png");
    if (fs.existsSync(debugPath)) { shell.openPath(debugPath); return true; }
    return false;
  });

  ipcMain.handle("scraper:open-solver", (_event, url) => {
    if (!url) return false;
    const solverWindow = new BrowserWindow({
      width: 600, height: 700, show: true, title: "Google CAPTCHA Solver",
      autoHideMenuBar: true, webPreferences: { webSecurity: false }
    });
    solverWindow.loadURL(url, { userAgent });
    return true;
  });

  // ── Live Score Scraper ────────────────────────────────────────────────────
  ipcMain.handle("scraper:run", async (_event, sport, matchId, teamA, teamB, scraperOrder) => {
    console.log(`[Scraper] Running ${sport} scraper for ${teamA} vs ${teamB}`);

    const scriptPath = getBackendPath("scraper", "live_score_scraper.py");
    const args = [scriptPath, sport, matchId, teamA, teamB];
    if (scraperOrder) args.push(scraperOrder);

    const result = await runPython(args);

    if (result.error) {
      console.error(`[Scraper] Failed to start Python process:`, result.error);
      return { success: false, error: 'Failed to start scraper', details: result.error.message };
    }

    if (!result.success) {
      console.error(`[Scraper] Process exited with code ${result.code}:`, result.stderr);
      return { success: false, error: `Scraper failed with code ${result.code}`, stderr: result.stderr };
    }

    try {
      const data = JSON.parse(result.stdout);
      console.log(`[Scraper] Success:`, data);
      return { success: true, data };
    } catch (error) {
      console.error(`[Scraper] JSON parse error:`, error);
      return { success: false, error: 'Failed to parse scraper output', stderr: result.stderr };
    }
  });

  console.log('[IPC] Scraper handlers registered');
};

module.exports = {
  registerScraperHandlers
};
