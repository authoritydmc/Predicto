// Configuration module for Predicto Host App
const APP_MODE = process.env.NODE_ENV || 'development';
const isDev = APP_MODE === 'development';

// Use built frontend by default when running standalone
// Only use dev server when VITE_DEV_SERVER_URL is explicitly set
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || null;

// Path to built frontend
const BUILT_FRONTEND_PATH = `${__dirname}/../frontend/dist/index.html`;

const APP_VERSION = '1.0.0';

module.exports = {
  APP_MODE,
  isDev,
  VITE_DEV_SERVER_URL,
  APP_VERSION
};