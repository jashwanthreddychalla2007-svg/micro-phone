# Deploy On Render Now

Follow this to create the live server where you can listen from anywhere.

## What You Need

- GitHub account
- Render account
- ESP32 already wired and flashed later

## Step 1: Create GitHub Repository

1. Open GitHub.
2. Click `New repository`.
3. Repository name:

```text
esp32-audio-monitor
```

4. Choose `Public` or `Private`.
5. Click `Create repository`.

## Step 2: Upload This Project To GitHub

Upload the full folder:

```text
C:\Users\lenovo\OneDrive\clang.c\Documents\ESP32-WiFi-Live-Audio-Monitor
```

Make sure these files are in the repository:

```text
render.yaml
server/standalone-server.js
server/public/index.html
server/public/app.js
server/public/styles.css
firmware/esp32_audio_monitor.ino
```

## Step 3: Create Render Account

1. Go to:

```text
https://render.com
```

2. Sign up.
3. Connect your GitHub account.

## Step 4: Deploy Blueprint

1. In Render dashboard, click `New`.
2. Choose `Blueprint`.
3. Select your GitHub repository:

```text
esp32-audio-monitor
```

4. Render reads:

```text
render.yaml
```

5. Click `Apply`.
6. Wait for deploy to finish.

## Step 5: Copy Your Render URL

Render will give a URL like:

```text
https://esp32-audio-monitor.onrender.com
```

Your exact URL may be different.

Save only the hostname for ESP32:

```text
esp32-audio-monitor.onrender.com
```

Do not include:

```text
https://
```

## Step 6: Find Tokens

In Render:

1. Open your service.
2. Go to `Environment`.
3. Copy:

```text
DASHBOARD_TOKEN
DEVICE_TOKEN
```

## Step 7: Configure ESP32 Code

Open:

```text
firmware/esp32_audio_monitor.ino
```

Set:

```cpp
const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* WS_HOST = "YOUR_RENDER_HOSTNAME.onrender.com";
const uint16_t WS_PORT = 443;
const bool WS_USE_TLS = true;
const char* DEVICE_TOKEN = "PASTE_DEVICE_TOKEN_FROM_RENDER";
```

Example:

```cpp
const char* WIFI_SSID = "RestaurantWiFi";
const char* WIFI_PASSWORD = "wifi-password";
const char* WS_HOST = "esp32-audio-monitor.onrender.com";
const uint16_t WS_PORT = 443;
const bool WS_USE_TLS = true;
const char* DEVICE_TOKEN = "abc123...";
```

Upload this code to ESP32.

## Step 8: Open Dashboard

Open your Render URL:

```text
https://esp32-audio-monitor.onrender.com
```

Paste:

```text
DASHBOARD_TOKEN
```

Then press:

```text
Connect
MIC ON
LISTEN LIVE
```

## Step 9: Expected Result

Dashboard should show:

```text
Status: ONLINE
Microphone: ON
Listener: Listening
```

You should hear live audio from the ESP32 microphone.

## If It Does Not Work

### Dashboard Opens But Device Offline

Check:

- ESP32 Wi-Fi name/password
- `WS_HOST` has no `https://`
- `WS_PORT` is `443`
- `WS_USE_TLS` is `true`
- `DEVICE_TOKEN` exactly matches Render value
- ESP32 Serial Monitor says `WebSocket connected`

### Render App Sleeps

Open the dashboard URL and wait 30-60 seconds.

Free Render services can sleep after inactivity.

### Dashboard Token Fails

Copy `DASHBOARD_TOKEN` again from Render `Environment`.

