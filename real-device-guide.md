# Real Device Build Guide

This guide takes the project from laptop simulation to a working ESP32 + INMP441 physical device.

## 1. Buy These Parts

Required:

- ESP32 DevKit V1, 30-pin.
- INMP441 I2S microphone module.
- Micro USB cable for programming and power.
- 5V USB power adapter.
- Jumper wires, female-to-female for testing.
- Small plastic enclosure.
- Power switch.

Recommended:

- Small perfboard or prototype PCB for final wiring.
- Heat-shrink tubing.
- 220 ohm resistor and 5 mm LED if you want an external power/status LED.
- Short shielded wire for microphone lines if the enclosure wiring is longer than a few centimeters.

## 2. Wire The Microphone

Use 3.3V only for the INMP441.

| INMP441 Pin | ESP32 Pin |
|---|---|
| VCC | 3.3V |
| GND | GND |
| WS | GPIO25 |
| SCK | GPIO26 |
| SD | GPIO22 |
| L/R | GND |

Important:

- Do not connect INMP441 VCC to 5V.
- Keep wires short for the first test.
- Make sure ESP32 GND and microphone GND are connected.
- If audio is almost silent, try moving `L/R` from `GND` to `3.3V` and change firmware channel from left to right.

## 3. Install Arduino IDE Setup

Install:

- Arduino IDE.
- ESP32 board package.
- WebSockets library by Markus Sattler.

Arduino IDE board setting:

- Board: ESP32 Dev Module
- Upload speed: 115200 or 921600
- Flash frequency: 40 MHz
- Port: your ESP32 COM port

## 4. Configure Firmware

Open:

```text
firmware/esp32_audio_monitor.ino
```

Change:

```cpp
const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* WS_HOST = "YOUR_SERVER_IP_OR_DOMAIN";
const uint16_t WS_PORT = 8090;
const char* DEVICE_TOKEN = "change-this-device-token";
```

For first testing, use your laptop IP address for `WS_HOST`.

Example:

```cpp
const char* WS_HOST = "192.168.1.15";
```

Do not use `127.0.0.1` in ESP32 firmware. On ESP32, `127.0.0.1` means the ESP32 itself, not your laptop.

## 5. Find Your Laptop IP Address

On Windows PowerShell:

```powershell
ipconfig
```

Look for your Wi-Fi IPv4 address, usually like:

```text
192.168.1.15
```

Your laptop and ESP32 must be on the same Wi-Fi network for local testing.

## 6. Start The Local Server

From:

```text
C:\Users\lenovo\OneDrive\clang.c\Documents\ESP32-WiFi-Live-Audio-Monitor\server
```

Run:

```bash
node standalone-server.js
```

Open dashboard:

```text
http://127.0.0.1:8090
```

Token:

```text
change-this-dashboard-token
```

## 7. Upload Firmware

1. Connect ESP32 to laptop with USB.
2. Open firmware in Arduino IDE.
3. Select ESP32 Dev Module.
4. Select correct COM port.
5. Click Upload.
6. Open Serial Monitor at 115200 baud if you add debug prints.

If upload fails:

- Hold BOOT button while upload starts.
- Release BOOT when Arduino IDE shows “Connecting...”.
- Try another USB cable.
- Try lower upload speed, 115200.

## 8. First Real Test

1. Server running on laptop.
2. ESP32 powered and connected to Wi-Fi.
3. Dashboard open in browser.
4. Status should become ONLINE.
5. Press MIC ON.
6. Press LISTEN LIVE.
7. Speak near microphone.
8. Press MIC OFF.

Expected:

- ONLINE status appears within a few seconds.
- Last seen updates.
- Microphone state changes ON/OFF.
- Live audio plays through browser.

## 9. If Device Stays Offline

Check:

- Wi-Fi name and password are correct.
- ESP32 and laptop are on same Wi-Fi.
- `WS_HOST` is laptop IPv4 address, not `127.0.0.1`.
- Windows Firewall allows Node/server on port 8090.
- Server is running.
- Device token in firmware matches server token.

## 10. If Audio Is Silent

Check:

- INMP441 VCC is connected to 3.3V.
- INMP441 GND is connected.
- WS, SCK, and SD pins match firmware.
- Press MIC ON before listening.
- Press LISTEN LIVE after connecting dashboard.
- Browser tab is not muted.
- Phone/laptop volume is up.

Try this hardware change:

- Move INMP441 `L/R` from `GND` to `3.3V`.

Then change firmware:

```cpp
.channel_format = I2S_CHANNEL_FMT_ONLY_RIGHT,
```

## 11. If Audio Is Noisy

Improve:

- Use shorter microphone wires.
- Keep microphone wires away from USB power wires.
- Use a better 5V adapter.
- Put microphone behind a small hole, not directly touching enclosure plastic.
- Avoid placing device next to exhaust fans, mixers, or high-vibration surfaces.

## 12. Enclosure Layout

Front:

- Microphone hole.
- Power/status LED.

Back:

- Power connector.
- Reset button access.
- Power switch.

Placement:

- Visible.
- Away from direct heat.
- Away from steam and oil.
- Not inside a metal box because Wi-Fi signal will drop.

## 13. Production Security

Before using from outside the restaurant:

- Deploy to VPS.
- Use HTTPS/WSS.
- Change dashboard token.
- Change device token.
- Do not expose port 8090 directly to the internet.
- Follow local workplace privacy law and disclosure requirements.

