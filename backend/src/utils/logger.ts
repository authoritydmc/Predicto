let logWs: WebSocket | null = null;

const initLogger = (windowName: string) => {
   if (typeof window === 'undefined') return;
   
   const connect = () => {
      logWs = new WebSocket('ws://localhost:9222');
      logWs.onclose = () => setTimeout(connect, 3000);
   };
   
   connect();

   const send = (level: string, message: any) => {
      if (logWs && logWs.readyState === 1) {
         logWs.send(JSON.stringify({
            level,
            window: windowName,
            message: String(message)
         }));
      }
   };

   // Patch console
   const originalLog = console.log;
   const originalError = console.error;

   console.log = (...args) => {
      send('log', args.join(' '));
      originalLog.apply(console, args);
   };

   console.error = (...args) => {
      send('error', args.join(' '));
      originalError.apply(console, args);
   };
};

export default initLogger;
