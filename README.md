# ESP32 Wi-Fi Live Audio Monitor

Visible restaurant-kitchen audio monitor using an ESP32, INMP441 I2S microphone, a VPS WebSocket server, and a mobile web dashboard.

## Important Use Rule

This project is intended for visible, disclosed monitoring only. Do not hide the device or use it for secret listening. Check local workplace privacy laws, display notice where required, and make sure staff understand what is being monitored.

## What This Builds

- ESP32 connects to restaurant Wi-Fi.
- ESP32 connects to your VPS over WebSocket.
- Web dashboard shows device online/offline status and last seen time.
- Dashboard can send MIC ON and MIC OFF commands.
- Dashboard can listen to live audio in a browser.
- Device stays connected even when the microphone is off.

## Recommended First Version

Use raw PCM audio first:

- Sample rate: 16000 Hz
- Bit depth: 16-bit signed integer
- Channel: mono
- Transport: secure WebSocket through HTTPS reverse proxy

Opus compression is better for production bandwidth, but raw PCM is the right first milestone because it reduces firmware complexity and makes debugging much easier.

## Folder Layout

```text
esp32-audio-monitor/
  requirements.md
  build-guide.md
  real-device-guide.md
  listen-from-anywhere.md
  deployment-vps.md
  render-deploy-guide.md
  DEPLOY-ON-RENDER-NOW.md
  render.yaml
  server/
    package.json
    standalone-server.js
    server.js
    public/
      index.html
      app.js
      styles.css
    tools/
      fake-device-standalone.js
  deploy/
    install-vps.sh
    check-vps.sh
  firmware/
    esp32_audio_monitor.ino
```

## Build Order

1. Wire ESP32 + INMP441.
2. Run the local standalone server on your laptop.
3. Open dashboard and confirm ONLINE/OFFLINE behavior.
4. Flash ESP32 firmware and confirm device connection.
5. Test MIC ON/OFF locally.
6. Deploy server to VPS.
7. Add HTTPS domain and reverse proxy.
8. Test remote listening from phone.

For internet deployment, follow `deployment-vps.md`.

For physical ESP32 assembly and first hardware testing, follow `real-device-guide.md`.

For remote phone access over the internet, follow `listen-from-anywhere.md`.

For free Render hosting, follow `render-deploy-guide.md`.

## Quick Local Run

From `server/`, run:

```bash
node standalone-server.js
```

In another terminal, run the fake ESP32 simulator:

```bash
node tools/fake-device-standalone.js
```

Then open:

```text
http://127.0.0.1:8090
```
