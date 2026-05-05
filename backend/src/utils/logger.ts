let logWs: WebSocket | null = null;
let reconnectTimer: any = null;

const initLogger = (windowName: string) => {
   if (typeof window === 'undefined') return;
   if (windowName.toLowerCase() === 'debug') return;

   const loggerState = window as any;
   if (loggerState.__overlayLoggerInstalled) return;
   loggerState.__overlayLoggerInstalled = true;
   
   const connect = () => {
      if (logWs && logWs.readyState === WebSocket.OPEN) return;
      
      logWs = new WebSocket('ws://localhost:9222');
      
      logWs.onopen = () => {
         if (reconnectTimer) clearInterval(reconnectTimer);
         reconnectTimer = null;
      };

      logWs.onclose = () => {
         if (!reconnectTimer) {
            reconnectTimer = setInterval(connect, 3000);
         }
      };

      logWs.onerror = () => {
         if (logWs) logWs.close();
      };
   };
   
   connect();

   const sendToStream = (level: string, message: any) => {
      if (logWs && logWs.readyState === WebSocket.OPEN) {
         try {
            const text = message
               .map((item: any) => {
                  if (item instanceof Error) return item.stack || item.message;
                  return typeof item === 'object' ? JSON.stringify(item) : String(item);
               })
               .join(' ');

            logWs.send(JSON.stringify({
               level,
               window: windowName,
               message: text,
               timestamp: Date.now()
            }));
         } catch (e) {
            // Silently fail if send fails to prevent recursion
         }
      }
   };

   // Patch console
   const originalLog = console.log;
   const originalWarn = console.warn;
   const originalError = console.error;

   console.log = (...args) => {
      sendToStream('info', args);
      originalLog.apply(console, args);
   };

   console.warn = (...args) => {
      sendToStream('warn', args);
      originalWarn.apply(console, args);
   };

   console.error = (...args) => {
      sendToStream('error', args);
      originalError.apply(console, args);
   };
};

export default initLogger;
