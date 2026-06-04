#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${1:-}"

if [ -z "$DOMAIN" ]; then
  echo "Usage: bash check-vps.sh audio.yourdomain.com"
  exit 1
fi

echo "Checking service..."
systemctl --no-pager status esp32-audio-monitor || true

echo
echo "Checking local app..."
curl -I http://127.0.0.1:8090/ || true

echo
echo "Checking public HTTPS..."
curl -I "https://$DOMAIN/" || true

echo
echo "Recent logs..."
journalctl -u esp32-audio-monitor -n 50 --no-pager || true

