// Configuration module for Predicto Host App
const APP_MODE = process.env.NODE_ENV || 'development';
const isDev = APP_MODE === 'development';
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
const APP_VERSION = '1.0.0';

module.exports = {
  APP_MODE,
  isDev,
  VITE_DEV_SERVER_URL,
  APP_VERSION
};