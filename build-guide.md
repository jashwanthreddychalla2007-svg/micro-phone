# Build Guide

## Phase 1: Hardware Test

Wire the INMP441 to ESP32:

| INMP441 | ESP32 |
|---|---|
| VCC | 3.3V |
| GND | GND |
| WS | GPIO25 |
| SCK | GPIO26 |
| SD | GPIO22 |
| L/R | GND |

Keep microphone wires short. Long loose wires can add noise or cause unstable readings.

## Phase 2: Local Server Test

From the server folder, run the no-install server:

```bash
node standalone-server.js
```

Open:

```text
http://127.0.0.1:8090
```

For local testing, the dashboard token is shown in `.env.example`. In production, change it.

Optional laptop-only simulation:

```bash
node tools/fake-device-standalone.js
```

This fake device connects like an ESP32 and sends a test tone when MIC ON is pressed.

## Phase 3: ESP32 Firmware

Install Arduino IDE libraries:

- ESP32 board package
- WebSockets by Markus Sattler

Edit the firmware constants:

```cpp
const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* WS_HOST = "YOUR_SERVER_IP_OR_DOMAIN";
const uint16_t WS_PORT = 8090;
const char* DEVICE_TOKEN = "change-this-device-token";
```

For local network testing, use your laptop IP address as `WS_HOST`.

Upload the sketch to the ESP32.

## Phase 4: Dashboard Test

1. Open the dashboard.
2. Enter the dashboard token.
3. Confirm device status becomes ONLINE.
4. Press MIC ON.
5. Press LISTEN LIVE.
6. Speak near the microphone.
7. Press MIC OFF.

## Phase 5: VPS Deployment

Recommended deployment:

- Ubuntu VPS
- Node.js 18+
- Nginx reverse proxy
- Certbot HTTPS certificate
- PM2 process manager

Production environment variables:

```bash
PORT=8090
DASHBOARD_TOKEN=use-a-long-random-secret
DEVICE_TOKEN=use-a-different-long-random-secret
```

Use `wss://yourdomain.com/device` for the ESP32 when HTTPS is configured. The included firmware currently uses plain `ws://` for the first local prototype; upgrade to secure WebSocket before internet deployment.

## Phase 6: Final Enclosure

Front:

- Microphone hole
- Power/status LED

Back:

- Power connector
- Reset access

Mount the device where it is visible and protected from oil, water, direct heat, and heavy steam.
