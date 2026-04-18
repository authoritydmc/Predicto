let logWs: WebSocket | null = null;
let reconnectTimer: any = null;

const initLogger = (windowName: string) => {
   if (typeof window === 'undefined') return;
   
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
            logWs.send(JSON.stringify({
               level,
               window: windowName,
               message: typeof message === 'object' ? JSON.stringify(message) : String(message),
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
      sendToStream('info', args.join(' '));
      originalLog.apply(console, args);
   };

   console.warn = (...args) => {
      sendToStream('warn', args.join(' '));
      originalWarn.apply(console, args);
   };

   console.error = (...args) => {
      sendToStream('error', args.join(' '));
      originalError.apply(console, args);
   };
};

export default initLogger;
