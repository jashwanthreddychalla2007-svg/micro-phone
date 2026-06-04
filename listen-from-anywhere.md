# Listen From Anywhere Setup

This is the production path for remote listening from your phone.

## Final Remote Architecture

```text
ESP32 in restaurant kitchen
  -> Restaurant Wi-Fi
  -> Internet
  -> VPS server
  -> HTTPS dashboard
  -> Your phone browser
```

The restaurant router does not need port forwarding because the ESP32 connects outward to the VPS.

## What You Need

- VPS with Ubuntu.
- Domain name, recommended.
- HTTPS certificate from Certbot.
- Dashboard token.
- Device token.
- ESP32 firmware configured for your domain.

## Step 1: Buy Or Prepare VPS

Minimum:

- 1 vCPU
- 1 GB RAM
- Ubuntu 22.04 or 24.04

Any of these are fine:

- Hostinger VPS
- DigitalOcean Droplet
- AWS Lightsail
- Hetzner Cloud

## Step 2: Point Domain To VPS

In your domain DNS settings, create:

```text
Type: A
Name: audio
Value: YOUR_VPS_PUBLIC_IP
```

Example final dashboard address:

```text
https://audio.yourdomain.com
```

You can also use the root domain, like:

```text
https://yourdomain.com
```

## Step 3: Upload Project To VPS

Upload this whole folder to:

```text
/opt/esp32-audio-monitor
```

The important server folder is:

```text
/opt/esp32-audio-monitor/server
```

## Step 4: Create Strong Tokens

On the VPS:

```bash
openssl rand -hex 32
openssl rand -hex 32
```

Use one for dashboard and one for device.

Create:

```bash
sudo nano /etc/esp32-audio-monitor.env
```

Example:

```bash
PORT=8090
DASHBOARD_TOKEN=paste-dashboard-secret-here
DEVICE_TOKEN=paste-device-secret-here
```

## Step 5: Run Server As A Service

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

Start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable esp32-audio-monitor
sudo systemctl start esp32-audio-monitor
sudo systemctl status esp32-audio-monitor
```

## Step 6: Configure Nginx

Install:

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

Create:

```bash
sudo nano /etc/nginx/sites-available/esp32-audio-monitor
```

Use this, replacing `audio.yourdomain.com`:

```nginx
server {
    listen 80;
    server_name audio.yourdomain.com;

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

## Step 7: Enable HTTPS

```bash
sudo certbot --nginx -d audio.yourdomain.com
```

After this, your dashboard is:

```text
https://audio.yourdomain.com
```

The browser dashboard will automatically use:

```text
wss://audio.yourdomain.com/dashboard
```

## Step 8: Configure ESP32 For Remote Server

In:

```text
firmware/esp32_audio_monitor.ino
```

Set:

```cpp
const char* WS_HOST = "audio.yourdomain.com";
const uint16_t WS_PORT = 443;
const bool WS_USE_TLS = true;
const char* DEVICE_TOKEN = "paste-device-secret-here";
```

Keep:

```cpp
const char* WIFI_SSID = "restaurant-wifi-name";
const char* WIFI_PASSWORD = "restaurant-wifi-password";
```

Upload firmware again.

## Step 9: Use From Phone

Open:

```text
https://audio.yourdomain.com
```

Enter dashboard token:

```text
paste-dashboard-secret-here
```

Then press:

1. Connect
2. MIC ON
3. LISTEN LIVE

## Step 10: Firewall

On the VPS:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Do not expose port `8090` publicly.

## Common Problems

### Dashboard opens but device is OFFLINE

Check:

- ESP32 Wi-Fi credentials.
- `WS_HOST` is your domain, not local IP.
- `WS_PORT` is `443`.
- `WS_USE_TLS` is `true`.
- `DEVICE_TOKEN` matches `/etc/esp32-audio-monitor.env`.
- VPS service is running.

### Dashboard does not open

Check:

- DNS A record points to VPS IP.
- Nginx is running.
- Certbot completed successfully.
- Firewall allows 80 and 443.

### MIC ON works but no audio

Check:

- Browser volume.
- Browser tab is not muted.
- Press LISTEN LIVE after MIC ON.
- INMP441 wiring.
- Try local testing first to separate hardware issues from internet issues.

