#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${1:-}"
APP_DIR="/opt/esp32-audio-monitor"
SERVER_DIR="$APP_DIR/server"
ENV_FILE="/etc/esp32-audio-monitor.env"
SERVICE_FILE="/etc/systemd/system/esp32-audio-monitor.service"
NGINX_SITE="/etc/nginx/sites-available/esp32-audio-monitor"

if [ -z "$DOMAIN" ]; then
  echo "Usage: sudo bash install-vps.sh audio.yourdomain.com"
  exit 1
fi

if [ ! -f "$SERVER_DIR/standalone-server.js" ]; then
  echo "Server file not found: $SERVER_DIR/standalone-server.js"
  echo "Upload the project to $APP_DIR first."
  exit 1
fi

if [ "$EUID" -ne 0 ]; then
  echo "Run as root: sudo bash install-vps.sh $DOMAIN"
  exit 1
fi

echo "Installing packages..."
apt update
apt install -y nodejs nginx certbot python3-certbot-nginx ufw openssl

DASHBOARD_TOKEN="$(openssl rand -hex 32)"
DEVICE_TOKEN="$(openssl rand -hex 32)"

echo "Writing environment file..."
cat > "$ENV_FILE" <<ENVEOF
PORT=8090
DASHBOARD_TOKEN=$DASHBOARD_TOKEN
DEVICE_TOKEN=$DEVICE_TOKEN
ENVEOF

chmod 600 "$ENV_FILE"
chown root:root "$ENV_FILE"

echo "Writing systemd service..."
cat > "$SERVICE_FILE" <<SERVICEEOF
[Unit]
Description=ESP32 Audio Monitor
After=network.target

[Service]
Type=simple
WorkingDirectory=$SERVER_DIR
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/node standalone-server.js
Restart=always
RestartSec=5
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
SERVICEEOF

chown -R www-data:www-data "$APP_DIR"

echo "Starting app service..."
systemctl daemon-reload
systemctl enable esp32-audio-monitor
systemctl restart esp32-audio-monitor

echo "Writing Nginx site..."
cat > "$NGINX_SITE" <<NGINXEOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:8090;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    location /dashboard {
        proxy_pass http://127.0.0.1:8090;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_read_timeout 3600;
    }

    location /device {
        proxy_pass http://127.0.0.1:8090;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_read_timeout 3600;
    }
}
NGINXEOF

ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/esp32-audio-monitor
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "Configuring firewall..."
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "Requesting HTTPS certificate..."
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email || {
  echo "Certbot failed. Check that DNS points $DOMAIN to this VPS IP, then run:"
  echo "sudo certbot --nginx -d $DOMAIN"
  exit 1
}

systemctl restart esp32-audio-monitor
systemctl reload nginx

echo
echo "Deployment complete."
echo
echo "Dashboard URL:"
echo "https://$DOMAIN"
echo
echo "Dashboard token:"
echo "$DASHBOARD_TOKEN"
echo
echo "ESP32 device token:"
echo "$DEVICE_TOKEN"
echo
echo "ESP32 firmware settings:"
echo "const char* WS_HOST = \"$DOMAIN\";"
echo "const uint16_t WS_PORT = 443;"
echo "const bool WS_USE_TLS = true;"
echo "const char* DEVICE_TOKEN = \"$DEVICE_TOKEN\";"

