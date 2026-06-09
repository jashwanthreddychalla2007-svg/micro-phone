const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");

const PORT = Number(process.env.PORT || 8090);
const DASHBOARD_TOKEN = process.env.DASHBOARD_TOKEN || "change-this-dashboard-token";
const DEVICE_TOKEN = process.env.DEVICE_TOKEN || "change-this-device-token";
const OFFLINE_AFTER_MS = 15000;
const PUBLIC_DIR = path.join(__dirname, "public");
const RECORDINGS_DIR = process.env.RECORDINGS_DIR || path.join(__dirname, "recordings");
const RECORDING_SAMPLE_RATE = 16000;
const RECORDING_RETENTION_MS = 24 * 60 * 60 * 1000;
const RECORDING_SEGMENT_MS = 5 * 60 * 1000;

let deviceSocket = null;
let micOn = false;
let lastSeenAt = 0;
let deviceInfo = {
  deviceName: "Kitchen Monitor 1",
  rssi: null,
  uptimeMs: 0,
  reconnects: 0,
  audioLevel: 0
};
const dashboards = new Set();
let activeRecording = null;
let lastRecordingCleanupAt = 0;

function ensureRecordingsDir() {
  fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
}

function wavHeader(dataBytes) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataBytes, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RECORDING_SAMPLE_RATE, 24);
  header.writeUInt32LE(RECORDING_SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataBytes, 40);
  return header;
}

function patchWavHeader(recording) {
  if (!recording || !recording.filePath) return;

  try {
    const fd = fs.openSync(recording.filePath, "r+");
    fs.writeSync(fd, wavHeader(recording.dataBytes), 0, 44, 0);
    fs.closeSync(fd);
  } catch {
    // The stream may be rotating or the file may have been removed.
  }
}

function recordingFileName(startedAt) {
  return `kitchen-${new Date(startedAt).toISOString().replace(/[:.]/g, "-")}.wav`;
}

function startRecordingSegment() {
  ensureRecordingsDir();
  const startedAt = Date.now();
  const fileName = recordingFileName(startedAt);
  const filePath = path.join(RECORDINGS_DIR, fileName);
  const stream = fs.createWriteStream(filePath, { flags: "wx" });
  stream.write(wavHeader(0));
  activeRecording = {
    dataBytes: 0,
    fileName,
    filePath,
    lastHeaderPatchAt: 0,
    startedAt,
    stream
  };
}

function closeRecordingSegment() {
  if (!activeRecording) return;

  const recording = activeRecording;
  activeRecording = null;
  patchWavHeader(recording);
  recording.stream.end();
}

function cleanupOldRecordings() {
  const now = Date.now();
  if (now - lastRecordingCleanupAt < 60 * 1000) return;
  lastRecordingCleanupAt = now;
  ensureRecordingsDir();

  for (const file of fs.readdirSync(RECORDINGS_DIR)) {
    if (!file.endsWith(".wav")) continue;
    const filePath = path.join(RECORDINGS_DIR, file);
    const stats = fs.statSync(filePath);
    if (now - stats.mtimeMs > RECORDING_RETENTION_MS && (!activeRecording || activeRecording.fileName !== file)) {
      fs.unlinkSync(filePath);
    }
  }
}

function writeRecordingFrame(payload) {
  cleanupOldRecordings();

  if (!activeRecording || Date.now() - activeRecording.startedAt > RECORDING_SEGMENT_MS) {
    closeRecordingSegment();
    startRecordingSegment();
  }

  activeRecording.stream.write(payload);
  activeRecording.dataBytes += payload.length;

  if (Date.now() - activeRecording.lastHeaderPatchAt > 5000) {
    activeRecording.lastHeaderPatchAt = Date.now();
    patchWavHeader(activeRecording);
  }
}

function recordingsList() {
  ensureRecordingsDir();
  const files = fs.readdirSync(RECORDINGS_DIR)
    .filter((file) => file.endsWith(".wav"))
    .map((file) => {
      const filePath = path.join(RECORDINGS_DIR, file);
      const stats = fs.statSync(filePath);
      return {
        createdAt: stats.birthtimeMs,
        downloadUrl: `/recordings/${encodeURIComponent(file)}?token=${encodeURIComponent(DASHBOARD_TOKEN)}`,
        name: file,
        size: stats.size
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt);

  return {
    retentionHours: 24,
    totalBytes: files.reduce((sum, file) => sum + file.size, 0),
    recordings: files
  };
}

function sendJsonResponse(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function serveRecordingsApi(request, response, url) {
  if (url.searchParams.get("token") !== DASHBOARD_TOKEN) {
    sendJsonResponse(response, 401, { error: "Unauthorized" });
    return true;
  }

  cleanupOldRecordings();
  sendJsonResponse(response, 200, recordingsList());
  return true;
}

function serveRecordingDownload(request, response, url) {
  if (url.searchParams.get("token") !== DASHBOARD_TOKEN) {
    response.writeHead(401);
    response.end("Unauthorized");
    return true;
  }

  const fileName = decodeURIComponent(url.pathname.replace("/recordings/", ""));
  if (!/^[a-zA-Z0-9_.-]+\.wav$/.test(fileName)) {
    response.writeHead(400);
    response.end("Bad recording name");
    return true;
  }

  const filePath = path.join(RECORDINGS_DIR, fileName);
  if (!filePath.startsWith(RECORDINGS_DIR) || !fs.existsSync(filePath)) {
    response.writeHead(404);
    response.end("Recording not found");
    return true;
  }

  if (activeRecording && activeRecording.fileName === fileName) {
    patchWavHeader(activeRecording);
  }

  response.writeHead(200, {
    "Content-Disposition": `attachment; filename="${fileName}"`,
    "Content-Type": "audio/wav"
  });
  fs.createReadStream(filePath).pipe(response);
  return true;
}

function serveStatic(request, response) {
  const url = new URL(request.url, "http://localhost");

  if (url.pathname === "/api/recordings") {
    serveRecordingsApi(request, response, url);
    return;
  }

  if (url.pathname.startsWith("/recordings/")) {
    serveRecordingDownload(request, response, url);
    return;
  }

  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, pathname));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      const fallbackPath = path.join(PUBLIC_DIR, "index.html");
      fs.readFile(fallbackPath, (fallbackError, fallbackContent) => {
        if (fallbackError) {
          response.writeHead(404);
          response.end("Not found");
          return;
        }

        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        response.end(fallbackContent);
      });
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
    deviceInfo,
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
            deviceInfo = {
              deviceName: typeof data.deviceName === "string" ? data.deviceName : deviceInfo.deviceName,
              rssi: typeof data.rssi === "number" ? data.rssi : deviceInfo.rssi,
              uptimeMs: typeof data.uptimeMs === "number" ? data.uptimeMs : deviceInfo.uptimeMs,
              reconnects: typeof data.reconnects === "number" ? data.reconnects : deviceInfo.reconnects,
              audioLevel: typeof data.audioLevel === "number" ? data.audioLevel : deviceInfo.audioLevel
            };
          }
          broadcastStatus();
        } catch {
          sendText(socket, { type: "error", message: "Invalid JSON" });
        }
        return;
      }

      if (opcode === 0x2 && micOn) {
        writeRecordingFrame(payload);
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
          if (deviceSocket && !deviceSocket.destroyed) {
            sendText(deviceSocket, { type: "blink" });
          }
          return;
        }

        if (data.type === "blink") {
          if (deviceSocket && !deviceSocket.destroyed) {
            sendText(deviceSocket, { type: "blink" });
          }
          return;
        }

        if (data.type === "restart") {
          if (deviceSocket && !deviceSocket.destroyed) {
            sendText(deviceSocket, { type: "restart" });
          }
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
