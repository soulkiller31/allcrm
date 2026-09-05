#!/usr/bin/env bash
set -e

# Hostinger VPS deployment script
# Domain : https://techbuddy31.co.in
# VPS IP : 89.116.134.239
#
# First-time setup on VPS (run once as root):
#   apt update && apt install -y nginx nodejs npm git
#   npm install -g pm2
#   certbot --nginx -d techbuddy31.co.in -d www.techbuddy31.co.in
#   cp nginx.conf /etc/nginx/nginx.conf && nginx -t && systemctl reload nginx
#   mkdir -p /var/log/salon-crm
#
# Every deploy:
#   git pull
#   bash hostinger_deploy.sh

DEPLOY_DIR=${DEPLOY_DIR:-/var/www/salon-crm}

echo "==> Building frontend..."
cd frontend
cp .env.production .env.production.local 2>/dev/null || true
npm ci --prefer-offline
npm run build

echo "==> Deploying frontend to $DEPLOY_DIR/public"
mkdir -p "$DEPLOY_DIR/public"
rm -rf "$DEPLOY_DIR/public"/*
cp -r dist/* "$DEPLOY_DIR/public/"

cd ../backend
echo "==> Installing backend dependencies..."
npm ci --prefer-offline

# Copy production env if .env doesn't exist yet
if [ ! -f .env ]; then
  cp .env.production .env
  echo "Copied .env.production → .env"
fi

echo "==> Starting/reloading backend with PM2..."
pm2 startOrReload ../ecosystem.config.cjs --env production 2>/dev/null \
  || pm2 start ../ecosystem.config.cjs --env production
pm2 save

echo "==> Reloading Nginx..."
nginx -t && systemctl reload nginx

echo ""
echo "✓ Deployment complete!"
echo "  Site : https://techbuddy31.co.in"
echo "  API  : https://techbuddy31.co.in/api/health"
