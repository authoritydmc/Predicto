#!/usr/bin/env node

const { spawn } = require('child_process');
const http = require('http');

// Function to check if a port is in use
function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: port,
      path: '/',
      method: 'HEAD',
      timeout: 1000
    }, () => {
      resolve(true);
    });
    
    req.on('error', () => {
      resolve(false);
    });
    
    req.on('timeout', () => {
      resolve(false);
    });
    
    req.end();
  });
}

// Function to find Vite dev server port
async function findVitePort() {
  const commonPorts = [3456, 3457, 3458, 3459, 3460, 5173];
  
  for (const port of commonPorts) {
    const isInUse = await checkPort(port);
    if (isInUse) {
      console.log(`Found Vite dev server on port ${port}`);
      return port;
    }
  }
  
  console.log('Vite dev server not found, using default port 3456');
  return 3456;
}

// Start the application
async function start() {
  const vitePort = await findVitePort();
  
  // Set environment variable for Electron
  process.env.VITE_DEV_SERVER_URL = `http://localhost:${vitePort}`;
  
  // Start Electron
  const electron = spawn('electron', ['.'], {
    stdio: 'inherit',
    env: { ...process.env, VITE_DEV_SERVER_URL: `http://localhost:${vitePort}` }
  });
  
  electron.on('close', (code) => {
    process.exit(code);
  });
}

start().catch(console.error);
