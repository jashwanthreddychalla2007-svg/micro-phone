# VPS Deployment Guide

Use this for the production cloud server after local testing works.

## 1. Server Choice

Minimum VPS:

- Ubuntu 22.04 or 24.04
- 1 vCPU
- 1 GB RAM
- Public IP address
- Domain name pointed to the VPS

## 2. Install Node And Nginx

```bash
sudo apt update
sudo apt install -y nodejs nginx certbot python3-certbot-nginx
```

Check Node:

```bash
node --version
```

Node 18 or newer is recommended.

## 3. Upload Project

Upload this folder to:

```text
/opt/esp32-audio-monitor
```

The server has no required npm dependencies, so it can run directly:

```bash
cd /opt/esp32-audio-monitor/server
node standalone-server.js
```

## 4. Environment Variables

Create strong secrets:

```bash
openssl rand -hex 32
```

Use different values for dashboard and device.

Create:

```bash
sudo nano /etc/esp32-audio-monitor.env
```

Example:

```bash
PORT=8090
DASHBOARD_TOKEN=replace-with-long-dashboard-secret
DEVICE_TOKEN=replace-with-long-device-secret
```

## 5. Systemd Service

Create:

```bash
sudo nano /etc/systemd/system/esp32-audio-monitor.service
```

Paste:

```ini
[Unit]
Description=ESP32 Audio Monitor
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/esp32-audio-monitor/server
EnvironmentFile=/etc/esp32-audio-monitor.env
ExecStart=/usr/bin/node standalone-server.js
Restart=always
RestartSec=5
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
```

Enable:

```bash
sudo systemctl daemon-reload
sudo systemctl enable esp32-audio-monitor
sudo systemctl start esp32-audio-monitor
sudo systemctl status esp32-audio-monitor
```

## 6. Nginx Reverse Proxy

Create:

```bash
sudo nano /etc/nginx/sites-available/esp32-audio-monitor
```

Paste, replacing `yourdomain.com`:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8090;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /dashboard {
        proxy_pass http://127.0.0.1:8090;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600;
    }

    location /device {
        proxy_pass http://127.0.0.1:8090;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600;
    }
}
```

Enable:

```bash
sudo ln -s /etc/nginx/sites-available/esp32-audio-monitor /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 7. HTTPS

```bash
sudo certbot --nginx -d yourdomain.com
```

After HTTPS is active, open:

```text
https://yourdomain.com
```

## 8. Firmware Production Change

For production, use secure WebSocket.

In `firmware/esp32_audio_monitor.ino`, set:

```cpp
const char* WS_HOST = "yourdomain.com";
const uint16_t WS_PORT = 443;
const bool WS_USE_TLS = true;
const char* DEVICE_TOKEN = "your-production-device-token";
```

Then upload the firmware again. The ESP32 will connect outward to:

```text
wss://yourdomain.com/device
```

## 9. Firewall

Allow only SSH, HTTP, and HTTPS:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Do not expose port `8090` directly to the internet.
