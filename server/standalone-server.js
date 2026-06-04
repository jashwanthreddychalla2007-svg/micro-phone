const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");

const PORT = Number(process.env.PORT || 8090);
const DASHBOARD_TOKEN = process.env.DASHBOARD_TOKEN || "change-this-dashboard-token";
const DEVICE_TOKEN = process.env.DEVICE_TOKEN || "change-this-device-token";
const OFFLINE_AFTER_MS = 15000;
const PUBLIC_DIR = path.join(__dirname, "public");

let deviceSocket = null;
let micOn = false;
let lastSeenAt = 0;
const dashboards = new Set();

function serveStatic(request, response) {
  const url = new URL(request.url, "http://localhost");
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, pathname));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    const ext = path.extname(filePath);
    const type = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8"
    }[ext] || "application/octet-stream";

    response.writeHead(200, { "Content-Type": type });
    response.end(content);
  });
}

function sendFrame(socket, opcode, payload = Buffer.alloc(0)) {
  if (socket.destroyed || !socket.writable) return;

  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload));
  let header;

  if (data.length < 126) {
    header = Buffer.from([0x80 | opcode, data.length]);
  } else if (data.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(data.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(data.length), 2);
  }

  socket.write(Buffer.concat([header, data]), (error) => {
    if (error) socket.destroy();
  });
}

function sendText(socket, payload) {
  sendFrame(socket, 0x1, JSON.stringify(payload));
}

function sendBinary(socket, payload) {
  sendFrame(socket, 0x2, payload);
}

function getDeviceStatus() {
  return {
    type: "status",
    online: Boolean(deviceSocket && !deviceSocket.destroyed && Date.now() - lastSeenAt < OFFLINE_AFTER_MS),
    micOn,
    lastSeenAt,
    serverTime: Date.now()
  };
}

function broadcastStatus() {
  const status = getDeviceStatus();
  for (const dashboard of dashboards) {
    if (dashboard.destroyed || !dashboard.writable) {
      dashboards.delete(dashboard);
    } else {
      sendText(dashboard, status);
    }
  }
}

function readFrames(socket, chunk, onFrame) {
  socket.buffer = Buffer.concat([socket.buffer || Buffer.alloc(0), chunk]);

  while (socket.buffer.length >= 2) {
    const first = socket.buffer[0];
    const second = socket.buffer[1];
    const opcode = first & 0x0f;
    const masked = Boolean(second & 0x80);
    let length = second & 0x7f;
    let offset = 2;

    if (length === 126) {
      if (socket.buffer.length < offset + 2) return;
      length = socket.buffer.readUInt16BE(offset);
      offset += 2;
    } else if (length === 127) {
      if (socket.buffer.length < offset + 8) return;
      length = Number(socket.buffer.readBigUInt64BE(offset));
      offset += 8;
    }

    let mask;
    if (masked) {
      if (socket.buffer.length < offset + 4) return;
      mask = socket.buffer.subarray(offset, offset + 4);
      offset += 4;
    }

    if (socket.buffer.length < offset + length) return;

    const payload = Buffer.from(socket.buffer.subarray(offset, offset + length));
    socket.buffer = socket.buffer.subarray(offset + length);

    if (masked) {
      for (let i = 0; i < payload.length; i += 1) {
        payload[i] ^= mask[i % 4];
      }
    }

    onFrame(opcode, payload);
  }
}

function acceptWebSocket(request, socket, head) {
  const key = request.headers["sec-websocket-key"];
  if (!key) {
    socket.destroy();
    return;
  }

  const accept = crypto
    .createHash("sha1")
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");

  socket.write([
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${accept}`,
    "\r\n"
  ].join("\r\n"));

  if (head.length) socket.unshift(head);
}

function closeSocket(socket) {
  sendFrame(socket, 0x8);
  socket.end();
}

function handleDevice(socket) {
  socket.on("error", () => {});

  if (deviceSocket && !deviceSocket.destroyed) {
    closeSocket(deviceSocket);
  }

  deviceSocket = socket;
  micOn = false;
  lastSeenAt = Date.now();
  broadcastStatus();

  socket.on("data", (chunk) => {
    readFrames(socket, chunk, (opcode, payload) => {
      if (opcode === 0x8) {
        socket.end();
        return;
      }

      if (opcode === 0x9) {
        sendFrame(socket, 0xA, payload);
        return;
      }

      lastSeenAt = Date.now();

      if (opcode === 0x1) {
        try {
          const data = JSON.parse(payload.toString("utf8"));
          if (data.type === "heartbeat" && typeof data.micOn === "boolean") {
            micOn = data.micOn;
          }
          broadcastStatus();
        } catch {
          sendText(socket, { type: "error", message: "Invalid JSON" });
        }
        return;
      }

      if (opcode === 0x2 && micOn) {
        for (const dashboard of dashboards) {
          if (dashboard.isListening && !dashboard.destroyed) {
            sendBinary(dashboard, payload);
          }
        }
      }
    });
  });

  socket.on("close", () => {
    if (deviceSocket === socket) {
      deviceSocket = null;
      micOn = false;
      broadcastStatus();
    }
  });
}

function handleDashboard(socket) {
  socket.isListening = false;
  socket.on("error", () => {});
  dashboards.add(socket);
  sendText(socket, getDeviceStatus());

  socket.on("data", (chunk) => {
    readFrames(socket, chunk, (opcode, payload) => {
      if (opcode === 0x8) {
        socket.end();
        return;
      }

      if (opcode === 0x9) {
        sendFrame(socket, 0xA, payload);
        return;
      }

      if (opcode !== 0x1) return;

      try {
        const data = JSON.parse(payload.toString("utf8"));

        if (data.type === "listen") {
          socket.isListening = Boolean(data.enabled);
          sendText(socket, { type: "listener", enabled: socket.isListening });
          return;
        }

        if (data.type === "mic") {
          micOn = data.enabled === true;
          if (deviceSocket && !deviceSocket.destroyed) {
            sendText(deviceSocket, { type: "mic", enabled: micOn });
          }
          broadcastStatus();
        }
      } catch {
        sendText(socket, { type: "error", message: "Invalid JSON" });
      }
    });
  });

  socket.on("close", () => {
    dashboards.delete(socket);
  });
}

const server = http.createServer(serveStatic);

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (url.pathname === "/device" && url.searchParams.get("token") === DEVICE_TOKEN) {
    acceptWebSocket(request, socket, head);
    handleDevice(socket);
    return;
  }

  if (url.pathname === "/dashboard" && url.searchParams.get("token") === DASHBOARD_TOKEN) {
    acceptWebSocket(request, socket, head);
    handleDashboard(socket);
    return;
  }

  socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
  socket.destroy();
});

setInterval(broadcastStatus, 5000);

server.listen(PORT, () => {
  console.log(`ESP32 audio monitor server running on http://127.0.0.1:${PORT}`);
});
