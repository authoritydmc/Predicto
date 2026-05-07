// Configuration module for Predicto Host App
const APP_MODE = process.env.NODE_ENV || 'development';
const isDev = APP_MODE === 'development';

// Try to detect Vite dev server port, fallback to common ports
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || (() => {
  const commonPorts = [3456, 3457, 3458, 3459, 3460, 5173];
  for (const port of commonPorts) {
    if (process.env.VITE_PORT === port.toString()) {
      return `http://localhost:${port}`;
    }
  }
  return 'http://localhost:3456'; // Default to Vite's configured port
})();

const APP_VERSION = '1.0.0';

module.exports = {
  APP_MODE,
  isDev,
  VITE_DEV_SERVER_URL,
  APP_VERSION
};