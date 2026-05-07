const { spawn } = require('child_process');
const { exec } = require('child_process');

console.log('Starting Predicto Host App...');

// Kill any existing processes on port 3456
exec('netstat -ano -p tcp | findstr :3456', (error, stdout, stderr) => {
  if (stdout) {
    const lines = stdout.split('\n');
    const portLines = lines.filter(line => line.includes(':3456') && line.includes('LISTENING'));
    
    if (portLines.length > 0) {
      console.log('Killing existing processes on port 3456...');
      portLines.forEach(line => {
        const match = line.match(/\s+(\d+)$/);
        if (match) {
          const pid = match[1];
          exec(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
        }
      });
    }
  }
  
  // Start Vite
  console.log('Starting Vite dev server...');
  const vite = spawn('vite', ['--port', '3456'], {
    stdio: 'inherit',
    shell: true
  });
  
  // Wait for Vite to be ready, then start Electron
  let viteReady = false;
  
  vite.stdout?.on('data', (data) => {
    const output = data.toString();
    console.log(output);
    
    // Check if Vite is ready
    if (output.includes('Local:') && output.includes('http://localhost:3456') && !viteReady) {
      viteReady = true;
      console.log('Vite is ready, starting Electron...');
      
      // Start Electron after a short delay
      setTimeout(() => {
        console.log('Launching Electron desktop app...');
        const electron = spawn('electron', ['.'], {
          stdio: 'inherit',
          shell: true,
          env: { ...process.env, NODE_ENV: 'development' }
        });
        
        electron.on('close', (code) => {
          console.log(`Electron exited with code ${code}`);
          vite.kill();
          process.exit(code);
        });
      }, 3000);
    }
  });
  
  // Also check stderr for Vite output
  vite.stderr?.on('data', (data) => {
    const output = data.toString();
    console.log(output);
    
    // Check if Vite is ready
    if (output.includes('Local:') && output.includes('http://localhost:3456') && !viteReady) {
      viteReady = true;
      console.log('Vite is ready, starting Electron...');
      
      // Start Electron after a short delay
      setTimeout(() => {
        console.log('Launching Electron desktop app...');
        const electron = spawn('electron', ['.'], {
          stdio: 'inherit',
          shell: true,
          env: { ...process.env, NODE_ENV: 'development' }
        });
        
        electron.on('close', (code) => {
          console.log(`Electron exited with code ${code}`);
          vite.kill();
          process.exit(code);
        });
      }, 3000);
    }
  });
  
  vite.on('close', (code) => {
    console.log(`Vite exited with code ${code}`);
    process.exit(code);
  });
});
