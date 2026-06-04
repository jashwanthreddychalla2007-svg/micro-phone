const WebSocket = require("ws");

const HOST = process.env.MONITOR_HOST || "127.0.0.1:8090";
const DEVICE_TOKEN = process.env.DEVICE_TOKEN || "change-this-device-token";
const SAMPLE_RATE = 16000;
const FRAME_SAMPLES = 512;
const TONE_HZ = 440;

let micOn = false;
let phase = 0;

const socket = new WebSocket(`ws://${HOST}/device?token=${encodeURIComponent(DEVICE_TOKEN)}`);

function heartbeat() {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "heartbeat", micOn }));
  }
}

function sendToneFrame() {
  if (!micOn || socket.readyState !== WebSocket.OPEN) return;

  const frame = Buffer.alloc(FRAME_SAMPLES * 2);
  for (let i = 0; i < FRAME_SAMPLES; i += 1) {
    const sample = Math.round(Math.sin(phase) * 12000);
    frame.writeInt16LE(sample, i * 2);
    phase += (Math.PI * 2 * TONE_HZ) / SAMPLE_RATE;
    if (phase > Math.PI * 2) phase -= Math.PI * 2;
  }

  socket.send(frame);
}

socket.on("open", () => {
  console.log("Fake ESP32 connected.");
  heartbeat();
});

socket.on("message", (message, isBinary) => {
  if (isBinary) return;

  const data = JSON.parse(message.toString());
  if (data.type === "mic") {
    micOn = data.enabled === true;
    console.log(`Microphone ${micOn ? "ON" : "OFF"}`);
    heartbeat();
  }
});

socket.on("close", () => {
  console.log("Fake ESP32 disconnected.");
});

socket.on("error", (error) => {
  console.error(error.message);
});

setInterval(heartbeat, 5000);
setInterval(sendToneFrame, 32);

