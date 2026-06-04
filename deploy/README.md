# VPS Deployment Kit

Use this folder after you have a VPS and a domain/subdomain.

## You Need From Your VPS Provider

- VPS public IP address
- SSH username, usually `root` or `ubuntu`
- SSH password or SSH key
- Ubuntu server, recommended

## You Need From Your Domain Provider

Create one DNS record:

```text
Type: A
Name: audio
Value: YOUR_VPS_PUBLIC_IP
```

Example:

```text
audio.yourdomain.com -> 123.45.67.89
```

## Deployment Order

1. Upload this full project folder to the VPS:

```text
/opt/esp32-audio-monitor
```

From Windows PowerShell, you can use:

```powershell
.\deploy\upload-from-windows.ps1 -VpsUser root -VpsHost YOUR_VPS_PUBLIC_IP
```

2. SSH into VPS.

3. Run:

```bash
cd /opt/esp32-audio-monitor/deploy
sudo bash install-vps.sh audio.yourdomain.com
```

4. The script will:

- Install Node.js, Nginx, Certbot, and UFW
- Create strong dashboard and device tokens
- Install the systemd service
- Configure Nginx WebSocket proxy
- Enable HTTPS
- Start the monitor server

5. After deploy, open:

```text
https://audio.yourdomain.com
```

6. Use the dashboard token printed by the script.

7. Put the device token into ESP32 firmware.

## ESP32 Remote Firmware Settings

```cpp
const char* WS_HOST = "audio.yourdomain.com";
const uint16_t WS_PORT = 443;
const bool WS_USE_TLS = true;
const char* DEVICE_TOKEN = "PASTE_DEVICE_TOKEN_FROM_VPS";
```
