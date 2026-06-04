# Free Render Deployment Guide

Render can host this project as a free web service for testing and demos.

## Important Free Plan Notes

- Render Web Services support public WebSocket connections.
- Free web services can spin down after inactivity.
- As of Render's 2026 changelog, incoming WebSocket messages keep free services active.
- Your ESP32 sends heartbeat messages every 5 seconds, so the service should stay awake while the ESP32 is connected.
- Do not treat the free plan as production-grade for a real business.

## What You Need

- GitHub account.
- Render account.
- This project uploaded to a GitHub repository.

No paid domain is required. Render gives you a free HTTPS URL:

```text
https://your-service-name.onrender.com
```

## Step 1: Upload Project To GitHub

Create a new GitHub repository, for example:

```text
esp32-audio-monitor
```

Upload this whole project folder.

The repository must include:

```text
render.yaml
server/
firmware/
```

## Step 2: Create Render Web Service

1. Open Render dashboard.
2. Click `New`.
3. Choose `Blueprint`.
4. Connect your GitHub repository.
5. Render will read `render.yaml`.
6. Choose the free plan.
7. Deploy.

Render will create:

```text
https://esp32-audio-monitor.onrender.com
```

Your exact URL may be different.

## Step 3: Find Your Tokens

In Render:

1. Open your service.
2. Go to `Environment`.
3. Find:

```text
DASHBOARD_TOKEN
DEVICE_TOKEN
```

Copy both.

Use `DASHBOARD_TOKEN` in the web dashboard.

Use `DEVICE_TOKEN` in ESP32 firmware.

## Step 4: Configure ESP32 For Render

In:

```text
firmware/esp32_audio_monitor.ino
```

Set:

```cpp
const char* WS_HOST = "esp32-audio-monitor.onrender.com";
const uint16_t WS_PORT = 443;
const bool WS_USE_TLS = true;
const char* DEVICE_TOKEN = "PASTE_RENDER_DEVICE_TOKEN";
```

Do not include `https://` in `WS_HOST`.

Correct:

```cpp
const char* WS_HOST = "esp32-audio-monitor.onrender.com";
```

Wrong:

```cpp
const char* WS_HOST = "https://esp32-audio-monitor.onrender.com";
```

## Step 5: Open Dashboard

Open:

```text
https://esp32-audio-monitor.onrender.com
```

Enter your `DASHBOARD_TOKEN`.

Press:

```text
Connect -> MIC ON -> LISTEN LIVE
```

## Step 6: If Service Sleeps

If ESP32 is offline for more than 15 minutes, Render may sleep the service.

When you open the dashboard again, it may take a little time to wake up.

After the ESP32 reconnects and sends heartbeats, the service should remain active while messages continue.

## Recommended For Final Project Demo

Use Render free for:

- College/final project demo.
- Testing live dashboard.
- Showing remote access.
- Short-term prototype.

Use a paid VPS for:

- Real restaurant use.
- 24/7 reliability.
- Better control over logs, firewall, and uptime.

