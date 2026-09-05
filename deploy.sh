#!/bin/bash
# ============================================================
# Salon CRM — Hostinger VPS Deployment Script
# Tuned for: 1 CPU / 4GB RAM / Ubuntu 22.04
#
# USAGE:
#   Bare metal (Node + PM2):  ./deploy.sh
#   Docker mode:              ./deploy.sh --docker
#
# Upload project to /var/www/salon-crm/ then run:
#   chmod +x deploy.sh && ./deploy.sh
# ============================================================

set -e

APP_DIR="/var/www/salon-crm"
LOG_DIR="/var/log/salon-crm"
DOMAIN="cutnculturesalon.cloud"
MODE="pm2"   # default: pm2 | docker

# Parse args
for arg in "$@"; do
  case $arg in
    --docker) MODE="docker" ;;
  esac
done

echo "============================================="
echo "  Salon CRM — VPS Setup (1CPU / 4GB RAM)"
echo "  Mode: $MODE"
echo "============================================="

# ── 1. System update ──────────────────────────────────────
echo ""
echo "[1/11] Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq curl wget gnupg2 git unzip software-properties-common

# ── 2. Swap file (critical for 1-core VPS with Chrome) ────
echo ""
echo "[2/11] Setting up 2GB swap file..."
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl vm.swappiness=10
  echo 'vm.swappiness=10' >> /etc/sysctl.conf
  echo "  Swap created: $(free -h | grep Swap)"
else
  echo "  Swap already exists"
fi

# ── 3. Docker mode ────────────────────────────────────────
if [ "$MODE" = "docker" ]; then
  echo ""
  echo "[3/11] Installing Docker..."
  if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
  fi
  echo "  Docker: $(docker --version)"

  if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    apt-get install -y docker-compose-plugin
  fi
  echo "  Docker Compose: $(docker compose version)"

  echo ""
  echo "[4/11] Installing Nginx + Certbot for SSL..."
  apt-get install -y nginx certbot python3-certbot-nginx -qq

  echo ""
  echo "[5-8/11] Skipped (Docker handles Node/Chrome/deps/build)..."

  echo ""
  echo "[9/11] Starting containers..."
  cd "$APP_DIR"
  docker compose down 2>/dev/null || true
  docker compose build --no-cache
  docker compose up -d
  echo "  Containers running:"
  docker compose ps

  echo ""
  echo "[10/11] Configuring Nginx SSL proxy..."
  cp "$APP_DIR/nginx.conf" /etc/nginx/nginx.conf
  nginx -t && systemctl restart nginx
  systemctl enable nginx

  echo ""
  echo "[11/11] Configuring firewall..."
  if command -v ufw &> /dev/null; then
    ufw --force enable
    ufw allow ssh
    ufw allow 'Nginx Full'
    ufw status
  fi

  echo ""
  echo "============================================="
  echo "  Docker setup complete!"
  echo "============================================="
  echo ""
  echo "Next steps:"
  echo "  1. Point DNS: A @ -> $(curl -s ifconfig.me 2>/dev/null || echo YOUR_VPS_IP)"
  echo "  2. Run SSL:   certbot --nginx -d $DOMAIN -d www.$DOMAIN"
  echo "  3. Visit:     https://$DOMAIN"
  echo ""
  echo "Docker commands:"
  echo "  docker compose ps                    — status"
  echo "  docker compose logs -f backend       — backend logs"
  echo "  docker compose restart backend       — restart backend"
  echo "  docker compose down && docker compose up -d  — full restart"
  exit 0
fi

# ── PM2 (bare metal) mode ─────────────────────────────────
echo ""
echo "[3/11] Installing Node.js 22..."
if ! command -v node &> /dev/null || [[ "$(node --version)" != v20* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - 2>/dev/null
  apt-get install -y nodejs
fi
echo "  Node: $(node --version)  npm: $(npm --version)"

echo ""
echo "[4/11] Installing Google Chrome..."
if ! command -v google-chrome-stable &> /dev/null; then
  wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg
  echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list
  apt-get update -qq
  apt-get install -y google-chrome-stable
fi
echo "  Chrome: $(google-chrome-stable --version)"

echo ""
echo "[5/11] Installing PM2 and Nginx..."
npm install -g pm2 --silent
apt-get install -y nginx certbot python3-certbot-nginx -qq
echo "  PM2: $(pm2 --version)"

echo ""
echo "[6/11] Creating directories..."
mkdir -p "$APP_DIR"
mkdir -p "$LOG_DIR"
mkdir -p "$APP_DIR/backend/.wwebjs_auth"
chmod 700 "$APP_DIR/backend/.wwebjs_auth"

echo ""
echo "[7/11] Installing backend dependencies..."
cd "$APP_DIR/backend"
cp "$APP_DIR/backend/.env.production" "$APP_DIR/backend/.env"
npm install --omit=dev
echo "  Backend ready"

echo ""
echo "[8/11] Building frontend..."
cd "$APP_DIR/frontend"
cp "$APP_DIR/frontend/.env.production" "$APP_DIR/frontend/.env"
npm install
npm run build
echo "  Frontend built: $APP_DIR/frontend/dist"

echo ""
echo "[9/11] Configuring Nginx..."
cp "$APP_DIR/nginx.conf" /etc/nginx/nginx.conf
nginx -t
systemctl restart nginx
systemctl enable nginx

echo ""
echo "[10/11] Starting backend with PM2..."
cd "$APP_DIR"
pm2 delete salon-crm 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save
env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u root --hp /root
systemctl enable pm2-root 2>/dev/null || true
echo "  Backend running"

echo ""
echo "[11/11] Configuring firewall..."
if command -v ufw &> /dev/null; then
  ufw --force enable
  ufw allow ssh
  ufw allow 'Nginx Full'
  ufw status
fi

echo ""
echo "============================================="
echo "  PM2 setup complete!"
echo "============================================="
echo ""
echo "Resource usage on 1CPU/4GB:"
echo "  Node.js:      ~150MB RAM"
echo "  Chrome (WA):  ~400MB RAM  (when connected)"
echo "  Chrome (PDF): ~200MB RAM  (during generation)"
echo "  Nginx:        ~20MB RAM"
echo "  OS:           ~300MB RAM"
echo "  Swap buffer:  2GB"
echo "  Total used:   ~1.1GB / 4GB"
echo ""
echo "Next steps:"
echo "  1. Point DNS A record @ -> $(curl -s ifconfig.me 2>/dev/null || echo YOUR_VPS_IP)"
echo "  2. Run SSL: certbot --nginx -d $DOMAIN -d www.$DOMAIN"
echo "  3. Visit:   https://$DOMAIN"
echo "     Login:   admin@salon.com / Admin@123456"
echo ""
echo "Management:"
echo "  pm2 status              — app status"
echo "  pm2 logs salon-crm      — live logs"
echo "  pm2 restart salon-crm   — restart"
echo "  pm2 monit               — real-time monitor"
echo "  free -h                 — check RAM"
