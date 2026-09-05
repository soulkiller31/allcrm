#!/usr/bin/env bash
set -euo pipefail

# PM2 startup helper for Hostinger VPS
# Run as the user that should run the Node process (not root ideally)

APP_DIR=/var/www/salon-crm
BACKEND_DIR="$APP_DIR/backend"

echo "Installing backend dependencies..."
cd "$BACKEND_DIR"
npm ci

echo "Starting application with PM2 using ecosystem.config.cjs"
if ! command -v pm2 >/dev/null 2>&1; then
  echo "pm2 not found — installing globally (requires sudo)"
  sudo npm install -g pm2
fi

pm2 startOrReload $APP_DIR/ecosystem.config.cjs --env production || pm2 start $APP_DIR/ecosystem.config.cjs --env production
pm2 save

echo "Generating systemd startup script for pm2 (you may need sudo)"
USER=$(whoami)
PM2_START_CMD=$(pm2 startup systemd -u "$USER" --hp "$HOME" | sed -n 's/.*\(sudo.*\)/\1/p')
if [ -n "$PM2_START_CMD" ]; then
  echo "Run the following command to finish pm2 systemd setup (may require sudo):"
  echo
  echo "$PM2_START_CMD"
  echo
else
  echo "pm2 startup returned nothing; you can run: sudo pm2 startup systemd -u $USER --hp $HOME"
fi

echo "PM2 processes saved. Ensure systemd startup command runs, then reboot to verify pm2 runs on boot."