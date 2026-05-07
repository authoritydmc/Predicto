// Configuration module for Predicto Host App
const APP_MODE = process.env.APP_MODE || process.env.NODE_ENV || 'development';
const isDev = process.env.NODE_ENV === 'development' || APP_MODE === 'local';

// Host app is independent - no frontend dependencies
const APP_VERSION = '1.0.0';

module.exports = {
  APP_MODE,
  isDev,
  APP_VERSION
};