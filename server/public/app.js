const statusPill = document.getElementById("statusPill");
const micState = document.getElementById("micState");
const lastSeen = document.getElementById("lastSeen");
const listenerState = document.getElementById("listenerState");
const tokenInput = document.getElementById("tokenInput");
const connectBtn = document.getElementById("connectBtn");
const micOnBtn = document.getElementById("micOnBtn");
const micOffBtn = document.getElementById("micOffBtn");
const listenBtn = document.getElementById("listenBtn");
const message = document.getElementById("message");
const levelText = document.getElementById("levelText");
const meterBars = [...document.querySelectorAll(".bar")];

let socket;
let audioContext;
let nextPlayTime = 0;
let listening = false;
let lastSeenAt = 0;

function setMessage(text) {
  message.textContent = text;
}

function setConnectedControls(enabled) {
  micOnBtn.disabled = !enabled;
  micOffBtn.disabled = !enabled;
  listenBtn.disabled = !enabled;
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
  setDeviceClass(status.online);
  lastSeenAt = status.lastSeenAt || 0;
  renderLastSeen();
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
    setListeningClass(false);
    listenBtn.textContent = "LISTEN LIVE";
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

listenBtn.addEventListener("click", async () => {
  await ensureAudioContext();
  send({ type: "listen", enabled: !listening });
});

setInterval(renderLastSeen, 1000);
resetLevel();
setDeviceClass(false);
