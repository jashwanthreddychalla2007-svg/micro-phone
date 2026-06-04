const http = require("http");
const path = require("path");
const express = require("express");
const { WebSocket, WebSocketServer } = require("ws");

const PORT = Number(process.env.PORT || 8090);
const DASHBOARD_TOKEN = process.env.DASHBOARD_TOKEN || "change-this-dashboard-token";
const DEVICE_TOKEN = process.env.DEVICE_TOKEN || "change-this-device-token";
const OFFLINE_AFTER_MS = 15000;

const app = express();
app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let deviceSocket = null;
let micOn = false;
let lastSeenAt = 0;
const dashboards = new Set();

function sendJson(socket, payload) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function getDeviceStatus() {
  const online = deviceSocket && Date.now() - lastSeenAt < OFFLINE_AFTER_MS;
  return {
    type: "status",
    online: Boolean(online),
    micOn,
    lastSeenAt,
    serverTime: Date.now()
  };
}

function broadcastStatus() {
  const status = getDeviceStatus();
  for (const dashboard of dashboards) {
    sendJson(dashboard, status);
  }
}

function authenticate(url, expectedToken) {
  return url.searchParams.get("token") === expectedToken;
}

wss.on("connection", (socket, request) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (url.pathname === "/device") {
    if (!authenticate(url, DEVICE_TOKEN)) {
      socket.close(1008, "Invalid device token");
      return;
    }

    if (deviceSocket && deviceSocket.readyState === WebSocket.OPEN) {
      deviceSocket.close(1012, "Replaced by new device connection");
    }

    deviceSocket = socket;
    micOn = false;
    lastSeenAt = Date.now();
    broadcastStatus();

    socket.on("message", (message, isBinary) => {
      lastSeenAt = Date.now();

      if (!isBinary) {
        try {
          const data = JSON.parse(message.toString());
          if (data.type === "heartbeat") {
            if (typeof data.micOn === "boolean") micOn = data.micOn;
            broadcastStatus();
          }
        } catch {
          sendJson(socket, { type: "error", message: "Invalid JSON" });
        }
        return;
      }

      if (micOn) {
        for (const dashboard of dashboards) {
          if (dashboard.isListening && dashboard.readyState === WebSocket.OPEN) {
            dashboard.send(message, { binary: true });
          }
        }
      }
    });

    socket.on("close", () => {
      if (deviceSocket === socket) {
        deviceSocket = null;
        micOn = false;
        broadcastStatus();
      }
    });

    return;
  }

  if (url.pathname === "/dashboard") {
    if (!authenticate(url, DASHBOARD_TOKEN)) {
      socket.close(1008, "Invalid dashboard token");
      return;
    }

    socket.isListening = false;
    dashboards.add(socket);
    sendJson(socket, getDeviceStatus());

    socket.on("message", (message, isBinary) => {
      if (isBinary) return;

      let data;
      try {
        data = JSON.parse(message.toString());
      } catch {
        sendJson(socket, { type: "error", message: "Invalid JSON" });
        return;
      }

      if (data.type === "listen") {
        socket.isListening = Boolean(data.enabled);
        sendJson(socket, { type: "listener", enabled: socket.isListening });
        return;
      }

      if (data.type === "mic") {
        micOn = data.enabled === true;
        if (deviceSocket && deviceSocket.readyState === WebSocket.OPEN) {
          sendJson(deviceSocket, { type: "mic", enabled: micOn });
        }
        broadcastStatus();
      }
    });

    socket.on("close", () => {
      dashboards.delete(socket);
    });

    return;
  }

  socket.close(1008, "Unknown endpoint");
});

setInterval(broadcastStatus, 5000);

server.listen(PORT, () => {
  console.log(`ESP32 audio monitor server running on http://127.0.0.1:${PORT}`);
});
