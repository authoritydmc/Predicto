/**
 * WebSocket Server Module
 * Handles log broadcasting via WebSocket
 */

const { WebSocketServer } = require("ws");

let wss = null;

const initLogServer = () => {
  wss = new WebSocketServer({ port: 9222 });
  wss.on("connection", (ws) => {
    ws.on("message", (data) => {
      // Broadcast to all other clients
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === 1) {
          client.send(data.toString());
        }
      });
    });
  });
  console.log('[WebSocket] Log server initialized on port 9222');
};

const getWss = () => wss;

const broadcastToClients = (data) => {
  if (wss) {
    wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(JSON.stringify(data));
      }
    });
  }
};

module.exports = {
  initLogServer,
  getWss,
  broadcastToClients
};
