# ESP32 Connections And Code

## Required Hardware

- ESP32 DevKit V1
- INMP441 I2S microphone module
- Jumper wires
- USB cable
- 5V USB power adapter

## INMP441 To ESP32 Wiring

| INMP441 | ESP32 DevKit V1 |
|---|---|
| VCC | 3.3V |
| GND | GND |
| WS | GPIO25 |
| SCK | GPIO26 |
| SD | GPIO22 |
| L/R | GND |

## Important Wiring Notes

- Connect `VCC` to `3.3V`, not `5V`.
- Connect `L/R` to `GND` for left channel.
- Keep microphone wires short.
- If audio is silent, try connecting `L/R` to `3.3V` and change firmware channel to right.

## Firmware File

Use this Arduino file:

```text
firmware/esp32_audio_monitor.ino
```

## Code Settings For Local Laptop Testing

Use this when your ESP32 and laptop are on the same Wi-Fi.

```cpp
const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* WS_HOST = "YOUR_LAPTOP_WIFI_IP";
const uint16_t WS_PORT = 8090;
const bool WS_USE_TLS = false;
const char* DEVICE_TOKEN = "change-this-device-token";
```

Example:

```cpp
const char* WIFI_SSID = "MyRestaurantWiFi";
const char* WIFI_PASSWORD = "mywifi12345";
const char* WS_HOST = "192.168.1.15";
const uint16_t WS_PORT = 8090;
const bool WS_USE_TLS = false;
const char* DEVICE_TOKEN = "change-this-device-token";
```

Do not use `127.0.0.1` as `WS_HOST` in ESP32 code.

## Code Settings For Remote Internet Use

Use this after your VPS, domain, Nginx, and HTTPS are ready.

```cpp
const char* WIFI_SSID = "RESTAURANT_WIFI_NAME";
const char* WIFI_PASSWORD = "RESTAURANT_WIFI_PASSWORD";
const char* WS_HOST = "audio.yourdomain.com";
const uint16_t WS_PORT = 443;
const bool WS_USE_TLS = true;
const char* DEVICE_TOKEN = "your-production-device-token";
```

## Arduino IDE Requirements

Install:

- ESP32 board package
- WebSockets library by Markus Sattler

Board:

```text
ESP32 Dev Module
```

Serial Monitor:

```text
115200 baud
```

## Expected Serial Monitor Output

```text
ESP32 audio monitor starting...
Connecting to Wi-Fi...
Wi-Fi connected. ESP32 IP: 192.168.1.xx
I2S microphone ready.
Connecting to local WebSocket.
WebSocket connected.
```

When you press MIC ON:

```text
MIC ON command received.
```

When you press MIC OFF:

```text
MIC OFF command received.
```

