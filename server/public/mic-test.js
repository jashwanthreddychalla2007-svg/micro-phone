const deviceTokenInput = document.getElementById("deviceTokenInput");
const toggleDeviceTokenBtn = document.getElementById("toggleDeviceTokenBtn");
const startTestBtn = document.getElementById("startTestBtn");
const stopTestBtn = document.getElementById("stopTestBtn");
const testMessage = document.getElementById("testMessage");
const testStatusPill = document.getElementById("testStatusPill");
const testLevelText = document.getElementById("testLevelText");
const testBars = [...document.querySelectorAll(".test-bar")];

let socket;
let stream;
let audioContext;
let source;
let processor;
let heartbeatTimer;
let carry = [];
let micOn = true;

function urlForDevice() {
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${location.host}/device?token=${encodeURIComponent(deviceTokenInput.value.trim())}`;
}

function setStatus(active) {
  testStatusPill.innerHTML = `<span class="status-dot"></span>${active ? "STREAMING" : "STOPPED"}`;
  testStatusPill.className = `pill ${active ? "online" : "offline"}`;
  startTestBtn.disabled = active;
  stopTestBtn.disabled = !active;
}

function showLevel(level) {
  const activeBars = Math.max(0, Math.min(testBars.length, Math.round(level * testBars.length)));
  testBars.forEach((bar, index) => {
    const active = index < activeBars;
    bar.style.height = `${active ? 18 + index * 6 : 10}%`;
    bar.classList.toggle("active", active);
    bar.classList.toggle("hot", active && index >= 8);
    bar.classList.toggle("peak", active && index >= 10);
  });
  testLevelText.textContent = level < 0.08 ? "Quiet" : level < 0.45 ? "Live" : "Loud";
}

function heartbeat() {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "heartbeat", micOn }));
  }
}

function resample16k(input, inputRate) {
  if (inputRate === 16000) return input;
  const all = new Float32Array(carry.length + input.length);
  all.set(carry, 0);
  all.set(input, carry.length);
  const ratio = inputRate / 16000;
  const outLen = Math.floor(all.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i += 1) {
    const sourceIndex = i * ratio;
    const a = Math.floor(sourceIndex);
    const b = Math.min(a + 1, all.length - 1);
    const t = sourceIndex - a;
    out[i] = all[a] + (all[b] - all[a]) * t;
  }
  carry = Array.from(all.slice(Math.floor(outLen * ratio)));
  return out;
}

function sendPcm(floatSamples) {
  if (!socket || socket.readyState !== WebSocket.OPEN || !micOn) return;
  const pcm = new Int16Array(floatSamples.length);
  for (let i = 0; i < floatSamples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, floatSamples[i]));
    pcm[i] = sample < 0 ? sample * 32768 : sample * 32767;
  }
  socket.send(pcm.buffer);
}

async function start() {
  if (!deviceTokenInput.value.trim()) {
    testMessage.textContent = "Paste DEVICE_TOKEN first.";
    return;
  }

  socket = new WebSocket(urlForDevice());
  socket.binaryType = "arraybuffer";
  testMessage.textContent = "Connecting to Render as laptop device...";

  socket.addEventListener("open", async () => {
    heartbeat();
    heartbeatTimer = setInterval(heartbeat, 5000);
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new AudioContext();
    source = audioContext.createMediaStreamSource(stream);
    processor = audioContext.createScriptProcessor(2048, 1, 1);
    processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      let total = 0;
      for (let i = 0; i < input.length; i += 1) total += Math.abs(input[i]);
      showLevel(Math.min(1, (total / input.length) * 3.5));
      sendPcm(resample16k(input, audioContext.sampleRate));
    };
    source.connect(processor);
    processor.connect(audioContext.destination);
    setStatus(true);
    testMessage.textContent = "Laptop mic is streaming. Open the main dashboard in another tab.";
  });

  socket.addEventListener("message", (event) => {
    if (typeof event.data !== "string") return;
    const data = JSON.parse(event.data);
    if (data.type === "mic") {
      micOn = data.enabled === true;
      heartbeat();
    }
  });

  socket.addEventListener("error", () => {
    testMessage.textContent = "Connection failed. Check DEVICE_TOKEN.";
  });
}

function stop() {
  clearInterval(heartbeatTimer);
  if (processor) processor.disconnect();
  if (source) source.disconnect();
  if (audioContext) audioContext.close();
  if (stream) stream.getTracks().forEach((track) => track.stop());
  if (socket && socket.readyState === WebSocket.OPEN) socket.close();
  socket = null;
  stream = null;
  audioContext = null;
  source = null;
  processor = null;
  carry = [];
  setStatus(false);
  showLevel(0);
  testLevelText.textContent = "Idle";
  testMessage.textContent = "Laptop mic stopped.";
}

toggleDeviceTokenBtn.addEventListener("click", () => {
  deviceTokenInput.type = deviceTokenInput.type === "password" ? "text" : "password";
  const visible = deviceTokenInput.type === "text";
  toggleDeviceTokenBtn.classList.toggle("is-hidden", !visible);
  toggleDeviceTokenBtn.setAttribute("aria-label", visible ? "Hide device token" : "Show device token");
});

startTestBtn.addEventListener("click", start);
stopTestBtn.addEventListener("click", stop);
setStatus(false);
showLevel(0);
testLevelText.textContent = "Idle";

