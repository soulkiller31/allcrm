#!/usr/bin/env bash
set -euo pipefail

# Install common prerequisites on Debian/Ubuntu Hostinger VPS
# Run as a sudo-capable user: sudo ./deploy/install_prereqs.sh

echo "Updating apt and installing packages..."
sudo apt update
sudo apt install -y curl gnupg build-essential nginx certbot python3-certbot-nginx ca-certificates

echo "Installing Node.js 18 (NodeSource)..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

echo "Installing Chromium for Puppeteer..."
sudo apt install -y chromium

echo "Creating log directory /var/log/salon-crm and setting owner to $(whoami)"
sudo mkdir -p /var/log/salon-crm
sudo chown $(whoami):$(whoami) /var/log/salon-crm

echo
echo "Prereqs installed. Next steps (on VPS):"
echo "1) Clone repo to /var/www/salon-crm"
echo "2) Copy .env files: backend/.env.production -> backend/.env and frontend/.env.production -> frontend/.env"
echo "3) Run: sudo DEPLOY_DIR=/var/www/salon-crm ./hostinger_deploy.sh"
echo "4) Run: sudo ./deploy/pm2_start.sh (follow printed pm2 startup command)"
echo "5) Configure nginx: sudo cp deploy/nginx_salon_crm.conf /etc/nginx/sites-available/salon-crm && sudo ln -s ... && sudo nginx -t && sudo systemctl reload nginx"
