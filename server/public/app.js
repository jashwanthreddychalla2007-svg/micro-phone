const statusPill = document.getElementById("statusPill");
const micState = document.getElementById("micState");
const lastSeen = document.getElementById("lastSeen");
const listenerState = document.getElementById("listenerState");
const tokenInput = document.getElementById("tokenInput");
const toggleTokenBtn = document.getElementById("toggleTokenBtn");
const connectBtn = document.getElementById("connectBtn");
const micOnBtn = document.getElementById("micOnBtn");
const micOffBtn = document.getElementById("micOffBtn");
const listenBtn = document.getElementById("listenBtn");
const restartBtn = document.getElementById("restartBtn");
const recordBtn = document.getElementById("recordBtn");
const downloadBtn = document.getElementById("downloadBtn");
const message = document.getElementById("message");
const levelText = document.getElementById("levelText");
const meterBars = [...document.querySelectorAll(".bar")];
const wifiSignal = document.getElementById("wifiSignal");
const wifiQuality = document.getElementById("wifiQuality");
const deviceTemp = document.getElementById("deviceTemp");
const uptimeState = document.getElementById("uptimeState");
const reconnectState = document.getElementById("reconnectState");
const deviceName = document.getElementById("deviceName");
const espAudioLevel = document.getElementById("espAudioLevel");
const refreshRecordingsBtn = document.getElementById("refreshRecordingsBtn");
const recordingsList = document.getElementById("recordingsList");
const backupStatus = document.getElementById("backupStatus");

let socket;
let audioContext;
let nextPlayTime = 0;
let listening = false;
let lastSeenAt = 0;
let recording = false;
let recordedChunks = [];

function setMessage(text) {
  message.textContent = text;
}

function setConnectedControls(enabled) {
  micOnBtn.disabled = !enabled;
  micOffBtn.disabled = !enabled;
  listenBtn.disabled = !enabled;
  restartBtn.disabled = !enabled;
  recordBtn.disabled = !enabled;
  downloadBtn.disabled = recordedChunks.length === 0;
  refreshRecordingsBtn.disabled = !enabled;
}

function setDeviceClass(online) {
  document.body.classList.toggle("device-online", online);
  document.body.classList.toggle("device-offline", !online);
}

function setListeningClass(enabled) {
  document.body.classList.toggle("is-listening", enabled);
}

function websocketUrl() {
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  const token = encodeURIComponent(tokenInput.value.trim());
  return `${protocol}://${location.host}/dashboard?token=${token}`;
}

function renderStatus(status) {
  statusPill.innerHTML = `<span class="status-dot"></span>${status.online ? "ONLINE" : "OFFLINE"}`;
  statusPill.className = `pill ${status.online ? "online" : "offline"}`;
  micState.textContent = status.micOn ? "ON" : "OFF";
  renderDeviceInfo(status.deviceInfo || {});
  setDeviceClass(status.online);
  lastSeenAt = status.lastSeenAt || 0;
  renderLastSeen();
}

function signalLabel(rssi) {
  if (typeof rssi !== "number") return "--";
  if (rssi >= -55) return `Excellent (${rssi})`;
  if (rssi >= -67) return `Good (${rssi})`;
  if (rssi >= -75) return `Fair (${rssi})`;
  return `Weak (${rssi})`;
}

function uptimeLabel(ms) {
  if (!ms) return "--";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function espAudioLabel(level) {
  if (!level) return "Idle";
  if (level < 700) return "Quiet";
  if (level < 5000) return "Live";
  return "Loud";
}

function renderDeviceInfo(info) {
  wifiSignal.textContent = signalLabel(info.rssi);
  wifiQuality.textContent = typeof info.wifiQuality === "number" ? `${info.wifiQuality}%` : "--";
  deviceTemp.textContent = typeof info.tempC === "number" ? `${info.tempC.toFixed(1)} C` : "--";
  uptimeState.textContent = uptimeLabel(info.uptimeMs);
  reconnectState.textContent = String(info.reconnects || 0);
  deviceName.textContent = info.deviceName || "Kitchen Monitor 1";
  espAudioLevel.textContent = espAudioLabel(info.audioLevel);
}

function formatBytes(bytes) {
  if (!bytes) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function formatRecordingTime(ms) {
  return new Date(ms).toLocaleString();
}

async function loadRecordings() {
  const token = encodeURIComponent(tokenInput.value.trim());
  if (!token) {
    backupStatus.textContent = "Token needed";
    return;
  }

  backupStatus.textContent = "Loading...";
  const response = await fetch(`/api/recordings?token=${token}`);
  if (!response.ok) {
    backupStatus.textContent = "Failed";
    return;
  }

  const data = await response.json();
  backupStatus.textContent = `${data.recordings.length} files, ${formatBytes(data.totalBytes)}`;

  if (data.recordings.length === 0) {
    recordingsList.innerHTML = "<p>No backup recordings yet. Turn MIC ON and stream audio first.</p>";
    return;
  }

  recordingsList.innerHTML = data.recordings.map((recording) => `
    <div class="recording-row">
      <div>
        <a href="${recording.downloadUrl}">${recording.name}</a>
        <div class="recording-meta">${formatRecordingTime(recording.createdAt)} - ${formatBytes(recording.size)}</div>
      </div>
      <a href="${recording.downloadUrl}">Download</a>
    </div>
  `).join("");
}

function renderLastSeen() {
  if (!lastSeenAt) {
    lastSeen.textContent = "Never";
    return;
  }

  const seconds = Math.max(0, Math.round((Date.now() - lastSeenAt) / 1000));
  lastSeen.textContent = `${seconds} seconds ago`;
}

function send(payload) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function blinkDevice() {
  send({ type: "blink" });
}

function renderLevel(level) {
  const activeBars = Math.max(0, Math.min(meterBars.length, Math.round(level * meterBars.length)));

  meterBars.forEach((bar, index) => {
    const active = index < activeBars;
    const height = active ? 18 + index * 6 : 10 + index * 1.5;
    bar.style.height = `${height}%`;
    bar.classList.toggle("active", active);
    bar.classList.toggle("hot", active && index >= 8);
    bar.classList.toggle("peak", active && index >= 10);
  });

  if (!listening) {
    levelText.textContent = "Idle";
  } else if (level < 0.08) {
    levelText.textContent = "Quiet";
  } else if (level < 0.45) {
    levelText.textContent = "Live";
  } else {
    levelText.textContent = "Loud";
  }
}

function resetLevel() {
  renderLevel(0);
}

function renderTokenVisibility() {
  const isVisible = tokenInput.type === "text";
  toggleTokenBtn.classList.toggle("is-hidden", !isVisible);
  toggleTokenBtn.setAttribute("aria-label", isVisible ? "Hide dashboard token" : "Show dashboard token");
  toggleTokenBtn.setAttribute("aria-pressed", String(isVisible));
}

async function ensureAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext({ sampleRate: 16000 });
    nextPlayTime = audioContext.currentTime;
  }

  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }
}

function playPcmFrame(arrayBuffer) {
  if (!audioContext || !listening) return;

  const samples = new Int16Array(arrayBuffer);
  if (recording) {
    recordedChunks.push(new Int16Array(samples));
    downloadBtn.disabled = true;
  }

  const audioBuffer = audioContext.createBuffer(1, samples.length, 16000);
  const channel = audioBuffer.getChannelData(0);
  let total = 0;

  for (let i = 0; i < samples.length; i += 1) {
    channel[i] = samples[i] / 32768;
    total += Math.abs(channel[i]);
  }

  renderLevel(Math.min(1, (total / samples.length) * 3.5));

  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);

  const startAt = Math.max(audioContext.currentTime + 0.03, nextPlayTime);
  source.start(startAt);
  nextPlayTime = startAt + audioBuffer.duration;
}

connectBtn.addEventListener("click", () => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.close();
    return;
  }

  socket = new WebSocket(websocketUrl());
  socket.binaryType = "arraybuffer";
  setMessage("Connecting...");

  socket.addEventListener("open", () => {
    connectBtn.textContent = "Disconnect";
    setConnectedControls(true);
    setMessage("Dashboard connected.");
    blinkDevice();
    loadRecordings();
  });

  socket.addEventListener("message", async (event) => {
    if (event.data instanceof ArrayBuffer) {
      playPcmFrame(event.data);
      return;
    }

    const data = JSON.parse(event.data);
    if (data.type === "status") renderStatus(data);
    if (data.type === "listener") {
      listening = data.enabled;
      setListeningClass(listening);
      listenerState.textContent = listening ? "Listening" : "Connected";
      listenBtn.textContent = listening ? "STOP LISTENING" : "LISTEN LIVE";
      if (!listening) resetLevel();
    }
  });

  socket.addEventListener("close", () => {
    connectBtn.textContent = "Connect";
    setConnectedControls(false);
    statusPill.innerHTML = '<span class="status-dot"></span>OFFLINE';
    statusPill.className = "pill offline";
    setDeviceClass(false);
    listenerState.textContent = "Disconnected";
    listening = false;
    recording = false;
    setListeningClass(false);
    listenBtn.textContent = "LISTEN LIVE";
    recordBtn.textContent = "START RECORD";
    resetLevel();
    setMessage("Dashboard disconnected.");
  });

  socket.addEventListener("error", () => {
    setMessage("Connection failed. Check token and server.");
  });
});

micOnBtn.addEventListener("click", () => {
  send({ type: "mic", enabled: true });
});

micOffBtn.addEventListener("click", () => {
  send({ type: "mic", enabled: false });
});

restartBtn.addEventListener("click", () => {
  if (confirm("Restart ESP32 device?")) {
    send({ type: "restart" });
    setMessage("Restart command sent to ESP32.");
  }
});

function wavBlobFromChunks(chunks, sampleRate) {
  const sampleCount = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const dataSize = sampleCount * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  let offset = 0;

  function writeString(value) {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset, value.charCodeAt(i));
      offset += 1;
    }
  }

  writeString("RIFF");
  view.setUint32(offset, 36 + dataSize, true); offset += 4;
  writeString("WAVE");
  writeString("fmt ");
  view.setUint32(offset, 16, true); offset += 4;
  view.setUint16(offset, 1, true); offset += 2;
  view.setUint16(offset, 1, true); offset += 2;
  view.setUint32(offset, sampleRate, true); offset += 4;
  view.setUint32(offset, sampleRate * 2, true); offset += 4;
  view.setUint16(offset, 2, true); offset += 2;
  view.setUint16(offset, 16, true); offset += 2;
  writeString("data");
  view.setUint32(offset, dataSize, true); offset += 4;

  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i += 1) {
      view.setInt16(offset, chunk[i], true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

recordBtn.addEventListener("click", () => {
  if (!listening) {
    setMessage("Press LISTEN LIVE before recording.");
    return;
  }

  recording = !recording;
  recordBtn.textContent = recording ? "STOP RECORD" : "START RECORD";

  if (recording) {
    recordedChunks = [];
    downloadBtn.disabled = true;
    setMessage("Recording started in this browser.");
  } else {
    downloadBtn.disabled = recordedChunks.length === 0;
    setMessage("Recording stopped. Download is ready.");
  }
});

downloadBtn.addEventListener("click", () => {
  if (recordedChunks.length === 0) return;

  const blob = wavBlobFromChunks(recordedChunks, 16000);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  link.href = url;
  link.download = `kitchen-audio-${stamp}.wav`;
  link.click();
  URL.revokeObjectURL(url);
});

refreshRecordingsBtn.addEventListener("click", loadRecordings);

listenBtn.addEventListener("click", async () => {
  await ensureAudioContext();
  send({ type: "listen", enabled: !listening });
});

toggleTokenBtn.addEventListener("click", () => {
  tokenInput.type = tokenInput.type === "password" ? "text" : "password";
  renderTokenVisibility();
});

setInterval(renderLastSeen, 1000);
resetLevel();
setDeviceClass(false);
renderTokenVisibility();
