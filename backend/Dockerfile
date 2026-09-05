# ── Backend Dockerfile ──────────────────────────────────────
# Node.js 20 on Debian slim + Google Chrome for Puppeteer/WhatsApp

FROM node:22-slim

# Install Chrome dependencies + Chrome itself
RUN apt-get update && apt-get install -y \
    wget \
    gnupg2 \
    ca-certificates \
    apt-transport-https \
    --no-install-recommends \
  && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg \
  && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
  && apt-get update \
  && apt-get install -y google-chrome-stable \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    libxss1 \
    --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first for layer caching
COPY package.json package-lock.json ./

# Install production deps only
RUN npm ci --omit=dev

# Copy source code
COPY src/ ./src/

# Tell Puppeteer to use the system Chrome (not download its own)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV PUPPETEER_CACHE_DIR=/root/.cache/puppeteer
ENV NODE_ENV=production

# Create WhatsApp session directory
RUN mkdir -p /app/.wwebjs_auth

EXPOSE 5000

CMD ["node", "src/server.js"]
