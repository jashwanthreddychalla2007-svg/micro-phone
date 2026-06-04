const crypto = require("crypto");
const http = require("http");
const net = require("net");

const HOST = process.env.MONITOR_HOST || "127.0.0.1";
const PORT = Number(process.env.MONITOR_PORT || 8090);
const DASHBOARD_TOKEN = process.env.DASHBOARD_TOKEN || "change-this-dashboard-token";

function sendFrame(socket, opcode, payload = Buffer.alloc(0)) {
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload));
  const mask = crypto.randomBytes(4);
  let header;

  if (data.length < 126) {
    header = Buffer.from([0x80 | opcode, 0x80 | data.length]);
  } else {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(data.length, 2);
  }

  const masked = Buffer.from(data);
  for (let i = 0; i < masked.length; i += 1) {
    masked[i] ^= mask[i % 4];
  }

  socket.write(Buffer.concat([header, mask, masked]));
}

function sendText(socket, payload) {
  sendFrame(socket, 0x1, JSON.stringify(payload));
}

function readFrames(socket, chunk, onFrame) {
  socket.buffer = Buffer.concat([socket.buffer || Buffer.alloc(0), chunk]);

  while (socket.buffer.length >= 2) {
    const opcode = socket.buffer[0] & 0x0f;
    let length = socket.buffer[1] & 0x7f;
    let offset = 2;

    if (length === 126) {
      if (socket.buffer.length < offset + 2) return;
      length = socket.buffer.readUInt16BE(offset);
      offset += 2;
    }

    if (socket.buffer.length < offset + length) return;
    const payload = Buffer.from(socket.buffer.subarray(offset, offset + length));
    socket.buffer = socket.buffer.subarray(offset + length);
    onFrame(opcode, payload);
  }
}

function checkHttp() {
  return new Promise((resolve, reject) => {
    http.get(`http://${HOST}:${PORT}/`, (response) => {
      let body = "";
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        if (response.statusCode !== 200 || !body.includes("Kitchen Audio Dashboard")) {
          reject(new Error("Dashboard HTTP page did not load"));
          return;
        }
        resolve();
      });
    }).on("error", reject);
  });
}

function checkWebSocketFlow() {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: HOST, port: PORT });
    const timeout = setTimeout(() => reject(new Error("Timed out waiting for audio frames")), 8000);
    let connected = false;
    let gotOnlineStatus = false;
    let gotAudioFrames = 0;

    socket.on("connect", () => {
      const key = crypto.randomBytes(16).toString("base64");
      socket.write([
        `GET /dashboard?token=${encodeURIComponent(DASHBOARD_TOKEN)} HTTP/1.1`,
        `Host: ${HOST}:${PORT}`,
        "Upgrade: websocket",
        "Connection: Upgrade",
        `Sec-WebSocket-Key: ${key}`,
        "Sec-WebSocket-Version: 13",
        "\r\n"
      ].join("\r\n"));
    });

    socket.on("data", (chunk) => {
      if (!connected) {
        const text = chunk.toString("utf8");
        if (!text.includes("101 Switching Protocols")) return;

        connected = true;
        const splitAt = text.indexOf("\r\n\r\n") + 4;
        const remaining = chunk.subarray(splitAt);
        sendText(socket, { type: "mic", enabled: true });
        sendText(socket, { type: "listen", enabled: true });
        if (remaining.length) readFrames(socket, remaining, handleFrame);
        return;
      }

      readFrames(socket, chunk, handleFrame);
    });

    socket.on("error", reject);

    function handleFrame(opcode, payload) {
      if (opcode === 0x1) {
        const data = JSON.parse(payload.toString("utf8"));
        if (data.type === "status" && data.online) gotOnlineStatus = true;
      }

      if (opcode === 0x2) {
        gotAudioFrames += 1;
      }

      if (gotOnlineStatus && gotAudioFrames >= 3) {
        clearTimeout(timeout);
        sendText(socket, { type: "mic", enabled: false });
        socket.end();
        resolve();
      }
    }
  });
}

(async () => {
  await checkHttp();
  await checkWebSocketFlow();
  console.log("Dashboard HTTP, device status, MIC ON command, and live audio relay verified.");
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

