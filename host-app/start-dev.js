const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function startDev() {
  console.log('Starting development server...');
  
  // Kill any existing processes on port 3456
  try {
    const { spawn } = require('child_process');
    const netstat = spawn('netstat', ['-ano', '-p', 'tcp']);
    let output = '';
    
    netstat.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    netstat.on('close', (code) => {
      const lines = output.split('\n');
      const port3456Lines = lines.filter(line => line.includes(':3456') && line.includes('LISTENING'));
      
      if (port3456Lines.length > 0) {
        console.log('Killing existing processes on port 3456...');
        port3456Lines.forEach(line => {
          const match = line.match(/\s+(\d+)$/);
          if (match) {
            const pid = match[1];
            try {
              require('child_process').spawnSync('taskkill', ['/F', '/PID', pid], { stdio: 'ignore' });
            } catch (e) {
              // Ignore errors
            }
          }
        });
      }
      
      // Wait a bit for processes to die
      setTimeout(() => {
        startVite();
      }, 1000);
    });
  } catch (e) {
    startVite();
  }
}

function startVite() {
  const vite = spawn('vite', ['--port', '3456'], {
    stdio: 'inherit',
    shell: true
  });
  
  let vitePort = null;
  
  // Capture Vite output to find the actual port
  vite.stdout?.on('data', (data) => {
    const output = data.toString();
    console.log(output);
    
    // Extract port from Vite output
    const portMatch = output.match(/Local:\s+http:\/\/localhost:(\d+)\//);
    if (portMatch && !vitePort) {
      vitePort = portMatch[1];
      console.log(`Vite started on port ${vitePort}`);
      
      // Write port to file for Electron to read
      fs.writeFileSync(path.join(__dirname, 'vite-port.txt'), vitePort);
      
      // Start Electron after Vite is ready
      setTimeout(() => {
        console.log('Starting Electron...');
        const electron = spawn('electron', ['.'], {
          stdio: 'inherit',
          shell: true
        });
        
        electron.on('close', (code) => {
          console.log(`Electron exited with code ${code}`);
          vite.kill();
          process.exit(code);
        });
      }, 2000);
    }
  });
  
  vite.on('close', (code) => {
    console.log(`Vite exited with code ${code}`);
    process.exit(code);
  });
}

startDev();
