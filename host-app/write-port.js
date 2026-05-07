const http = require('http');

const targetUrl = process.argv[2] || 'http://localhost:3456';

function getPort(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      const port = new URL(url).port;
      resolve(port);
    }).on('error', () => {
      resolve('3456');
    });
  });
}

getPort(targetUrl).then((port) => {
  const fs = require('fs');
  const portFile = '.vite-port';
  fs.writeFileSync(portFile, port);
  console.log(`Vite port written: ${port}`);
});