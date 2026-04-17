export const initWindowLogger = (windowName = "Window") => {
  const WS_URL = "ws://localhost:9999";
  let socket = null;
  let reconnectTimer = null;

  const safeStringify = (value) => {
    if (typeof value === "string") return value;
    if (value instanceof Error) {
      return `${value.name}: ${value.message}\n${value.stack || ""}`;
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };

  const formatMessage = (args) =>
    args
      .map((arg) => {
        if (typeof arg === "string") return arg;
        return safeStringify(arg);
      })
      .join(" ");

  const buildLog = (level, args) => ({
    type: "log",
    window: windowName,
    level,
    message: formatMessage(args),
    timestamp: new Date().toISOString()
  });

  const connect = () => {
    if (socket && socket.readyState === WebSocket.OPEN) return;
    if (socket && socket.readyState === WebSocket.CONNECTING) return;

    socket = new WebSocket(WS_URL);

    socket.addEventListener("open", () => {
      console.log(`[Logger] WebSocket connected for ${windowName}`);
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    });

    socket.addEventListener("close", () => {
      console.warn(`[Logger] WebSocket disconnected for ${windowName}. Reconnecting in 2s...`);
      reconnectTimer = setTimeout(connect, 2000);
    });

    socket.addEventListener("error", (event) => {
      console.error(`[Logger] WebSocket error for ${windowName}:`, event.message || event);
    });
  };

  const sendLog = (payload) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    socket.send(JSON.stringify(payload));
  };

  const wrapConsole = (method, level) => {
    const original = console[method].bind(console);
    console[method] = (...args) => {
      original(...args);
      sendLog(buildLog(level, args));
    };
  };

  wrapConsole("log", "log");
  wrapConsole("info", "info");
  wrapConsole("warn", "warn");
  wrapConsole("error", "error");
  wrapConsole("debug", "debug");

  window.addEventListener("error", (event) => {
    const errorMessage = event.error ? `${event.error.name}: ${event.error.message}` : event.message;
    const stack = event.error ? event.error.stack : "";
    sendLog({
      type: "log",
      window: windowName,
      level: "error",
      message: `${errorMessage}${stack ? `\n${stack}` : ""}`,
      timestamp: new Date().toISOString()
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason instanceof Error ? `${event.reason.name}: ${event.reason.message}` : safeStringify(event.reason);
    const stack = event.reason && event.reason.stack ? event.reason.stack : "";
    sendLog({
      type: "log",
      window: windowName,
      level: "error",
      message: `[Unhandled Rejection] ${reason}${stack ? `\n${stack}` : ""}`,
      timestamp: new Date().toISOString()
    });
  });

  connect();

  return {
    reconnect: connect,
    close: () => {
      if (socket) {
        socket.close();
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
    }
  };
};
