// Debug Console - Reusable across all window types
export const createDebugConsole = (windowName = "App") => {
  const debugConsoleStore = [];
  const maxDebugLogs = 500;

  const getTimeString = () => {
    const now = new Date();
    return now.toLocaleTimeString("en-GB", { 
      hour12: false, 
      hour: "2-digit", 
      minute: "2-digit", 
      second: "2-digit", 
      fractionalSecondDigits: 3 
    });
  };

  const formatLogMessage = (level, args) => {
    const timestamp = getTimeString();
    const message = args.map(arg => {
      if (typeof arg === "string") return arg;
      if (typeof arg === "object") {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(" ");
    
    return { timestamp, level, message };
  };

  const addDebugLog = (level, args) => {
    const logEntry = formatLogMessage(level, args);
    debugConsoleStore.unshift(logEntry);
    
    if (debugConsoleStore.length > maxDebugLogs) {
      debugConsoleStore.pop();
    }
    
    renderDebugConsole();
  };

  const renderDebugConsole = () => {
    const contentEl = document.querySelector("#debugConsoleContent");
    if (!contentEl) return;
    
    contentEl.innerHTML = debugConsoleStore.map((log) => {
      const levelColor = {
        log: "#9c9c9c",
        info: "#00d9ff",
        warn: "#ffcc00",
        error: "#ff4444"
      }[log.level] || "#9c9c9c";
      
      return `<div style="color: ${levelColor}; margin-bottom: 4px;"><span style="color: #555;">[${log.timestamp}]</span> <span style="color: #6699ff;">[${log.level.toUpperCase()}]</span> ${log.message}</div>`;
    }).join("");
    
    contentEl.scrollTop = 0;
  };

  const injectDebugUI = () => {
    // Check if already injected
    if (document.querySelector("#debugConsoleModal")) {
      return;
    }

    const modal = document.createElement("div");
    modal.id = "debugConsoleModal";
    modal.style.cssText = "display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 10000; padding: 20px;";
    
    modal.innerHTML = `
      <div style="position: fixed; top: 20px; right: 20px; width: 600px; height: 500px; background: #0a0e27; border: 1px solid #2a2e4e; border-radius: 12px; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
        <div style="padding: 16px; border-bottom: 1px solid #2a2e4e; display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; color: #fff; font-size: 14px; font-weight: 600;">Debug Console - ${windowName}</h3>
          <div style="display: flex; gap: 8px;">
            <button id="clearDebugBtn" style="background: #2a2e4e; color: #9c9c9c; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">Clear</button>
            <button id="closeDebugBtn" style="background: #2a2e4e; color: #9c9c9c; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">✕</button>
          </div>
        </div>
        <div id="debugConsoleContent" style="flex: 1; overflow-y: auto; padding: 12px; font-family: 'Courier New', monospace; font-size: 11px; color: #9c9c9c; line-height: 1.4; background: #0f1329;">
          <!-- Logs will be inserted here -->
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);

    // Add open button if not exists
    const existingBtn = document.querySelector("#openDebugConsoleBtn");
    if (!existingBtn) {
      const btn = document.createElement("button");
      btn.id = "openDebugConsoleBtn";
      btn.innerHTML = '<span>🖥️ Debug</span>';
      btn.style.cssText = "position: fixed; bottom: 20px; right: 20px; background: #2a2e4e; color: #9c9c9c; border: 1px solid #444; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; z-index: 9999; font-family: inherit;";
      document.body.appendChild(btn);
      
      btn.addEventListener("click", () => {
        modal.style.display = modal.style.display === "none" ? "block" : "none";
        renderDebugConsole();
      });
    }

    // Close button
    const closeBtn = document.querySelector("#closeDebugBtn");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        modal.style.display = "none";
      });
    }

    // Clear button
    const clearBtn = document.querySelector("#clearDebugBtn");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        debugConsoleStore.length = 0;
        renderDebugConsole();
      });
    }

    // Close on outside click
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.style.display = "none";
      }
    });
  };

  // Intercept console methods
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalInfo = console.info;

  console.log = function (...args) {
    originalLog.apply(console, args);
    addDebugLog("log", args);
  };

  console.error = function (...args) {
    originalError.apply(console, args);
    addDebugLog("error", args);
  };

  console.warn = function (...args) {
    originalWarn.apply(console, args);
    addDebugLog("warn", args);
  };

  console.info = function (...args) {
    originalInfo.apply(console, args);
    addDebugLog("info", args);
  };

  // Initialize UI when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectDebugUI);
  } else {
    injectDebugUI();
  }

  return {
    clear: () => {
      debugConsoleStore.length = 0;
      renderDebugConsole();
    },
    getLogs: () => [...debugConsoleStore],
    addLog: (level, args) => addDebugLog(level, args)
  };
};
