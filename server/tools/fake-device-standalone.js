const crypto = require("crypto");
const net = require("net");

const HOST = process.env.MONITOR_HOST || "127.0.0.1";
const PORT = Number(process.env.MONITOR_PORT || 8090);
const DEVICE_TOKEN = process.env.DEVICE_TOKEN || "change-this-device-token";
const SAMPLE_RATE = 16000;
const FRAME_SAMPLES = 512;
const TONE_HZ = 440;

let micOn = false;
let phase = 0;
let connected = false;
const socket = net.createConnection({ host: HOST, port: PORT });

function sendFrame(opcode, payload = Buffer.alloc(0)) {
  if (!connected || socket.destroyed) return;

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

function sendText(payload) {
  sendFrame(0x1, JSON.stringify(payload));
}

function heartbeat() {
  sendText({ type: "heartbeat", micOn });
}

function readFrames(chunk, onFrame) {
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

function sendToneFrame() {
  if (!micOn) return;

  const frame = Buffer.alloc(FRAME_SAMPLES * 2);
  for (let i = 0; i < FRAME_SAMPLES; i += 1) {
    const sample = Math.round(Math.sin(phase) * 12000);
    frame.writeInt16LE(sample, i * 2);
    phase += (Math.PI * 2 * TONE_HZ) / SAMPLE_RATE;
    if (phase > Math.PI * 2) phase -= Math.PI * 2;
  }

  sendFrame(0x2, frame);
}

socket.on("connect", () => {
  const key = crypto.randomBytes(16).toString("base64");
  socket.write([
    `GET /device?token=${encodeURIComponent(DEVICE_TOKEN)} HTTP/1.1`,
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
    console.log("Fake ESP32 connected.");
    heartbeat();
    if (remaining.length) readFrames(remaining, handleFrame);
    return;
  }

  readFrames(chunk, handleFrame);
});

function handleFrame(opcode, payload) {
  if (opcode !== 0x1) return;

  const data = JSON.parse(payload.toString("utf8"));
  if (data.type === "mic") {
    micOn = data.enabled === true;
    console.log(`Microphone ${micOn ? "ON" : "OFF"}`);
    heartbeat();
  }
}

socket.on("close", () => {
  connected = false;
  console.log("Fake ESP32 disconnected.");
});

socket.on("error", (error) => {
  console.error(error.message);
});

setInterval(heartbeat, 5000);
setInterval(sendToneFrame, 32);

