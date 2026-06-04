# Improved Requirements

## 1. Objective

Build a visible device for a restaurant kitchen that streams live audio to an authorized phone or laptop through a secure web dashboard.

The system must:

- Connect to restaurant Wi-Fi.
- Connect automatically to a cloud server.
- Show device ONLINE/OFFLINE status.
- Show last seen time.
- Allow authorized dashboard users to switch the microphone ON and OFF.
- Allow authorized dashboard users to listen live.
- Keep the device online even when the microphone is OFF.
- Recover automatically after Wi-Fi or server disconnection.

## 2. Compliance And Visibility

The device must:

- Be physically visible.
- Have a visible power/status LED.
- Be documented for staff or management.
- Be used only where audio monitoring is legally allowed.
- Avoid hidden placement, hidden recording, or undisclosed monitoring.

The first version does not record audio. It only streams live audio.

## 3. Hardware Requirements

### Required Parts

- ESP32 DevKit V1, 30-pin recommended.
- INMP441 I2S MEMS microphone.
- Plastic enclosure, around 8 cm x 5 cm x 3 cm.
- Power switch.
- Stable 5V USB power adapter or wired 5V supply.
- Restaurant Wi-Fi router.
- VPS server.
- Domain name, recommended for HTTPS.

### INMP441 Wiring

| INMP441 | ESP32 |
|---|---|
| VCC | 3.3V |
| GND | GND |
| WS | GPIO25 |
| SCK | GPIO26 |
| SD | GPIO22 |
| L/R | GND |

## 4. Functional Requirements

### Device Startup

When powered:

1. Connect to configured Wi-Fi.
2. Connect to the server WebSocket endpoint.
3. Send device registration message.
4. Send heartbeat every 5 seconds.
5. Wait for commands.

### MIC ON

When the dashboard sends MIC ON:

1. Server forwards command to ESP32.
2. ESP32 starts I2S audio capture.
3. ESP32 streams binary PCM audio frames to server.
4. Server relays audio to listening dashboard clients.

### MIC OFF

When the dashboard sends MIC OFF:

1. Server forwards command to ESP32.
2. ESP32 stops sending audio frames.
3. ESP32 remains connected and keeps sending heartbeat messages.

### Listen Live

When the user presses Listen Live:

1. Browser opens dashboard WebSocket connection.
2. Browser receives PCM audio frames.
3. Browser plays live audio through Web Audio API.

## 5. Dashboard Requirements

The dashboard must show:

- Device status: ONLINE or OFFLINE.
- Last seen time.
- Microphone state: ON or OFF.
- Listener connection state.
- MIC ON button.
- MIC OFF button.
- LISTEN LIVE button.

The dashboard should be mobile-friendly and usable from:

- iPhone
- Android
- Laptop
- Tablet

## 6. Audio Requirements

### Prototype Settings

- Codec: raw PCM
- Sample rate: 16000 Hz
- Bit depth: 16-bit
- Channel: mono
- Frame size: about 20 ms to 100 ms per binary message

### Production Upgrade

For production, upgrade to Opus when bandwidth or audio quality becomes important.

## 7. Server Requirements

The VPS server must:

- Serve the dashboard over HTTPS.
- Accept WebSocket connections from ESP32.
- Accept WebSocket connections from dashboard clients.
- Authenticate device connections using a device token.
- Authenticate dashboard users using a dashboard token or login.
- Track last heartbeat time.
- Mark the device OFFLINE after missed heartbeats.
- Relay commands from dashboard to ESP32.
- Relay audio from ESP32 to listening dashboards.

Minimum VPS:

- 1 vCPU
- 1 GB RAM
- Linux
- Node.js 18 or newer

## 8. Security Requirements

- Use HTTPS and WSS in production.
- Do not expose raw ws:// over the public internet.
- Use a strong device token.
- Use a strong dashboard token or proper login.
- Keep tokens out of public source code.
- Store secrets in environment variables.
- Use firewall rules so only HTTP/HTTPS/SSH are public.
- Keep server packages updated.

## 9. Reliability Requirements

The ESP32 must:

- Reconnect to Wi-Fi automatically.
- Reconnect to WebSocket automatically.
- Resume heartbeat after reconnection.
- Start with microphone OFF by default.

The server must:

- Handle device disconnects.
- Prevent dashboard crashes when the device is offline.
- Support at least one live listener in version 1.

## 10. Future Features

- Multiple devices on one dashboard.
- Device offline notifications.
- Wi-Fi disconnected alerts.
- Cloud recording with legal controls.
- Last 24 hours / last 7 days playback.
- Opus compression.
- Admin login with user roles.

