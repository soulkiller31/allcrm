# ── Frontend Dockerfile ─────────────────────────────────────
# Stage 1: Build React app
FROM node:20-slim AS builder

WORKDIR /app

COPY package.json package-lock.json rollup-wasm.cjs ./
RUN npm ci

COPY index.html ./
COPY public/ ./public/
COPY src/ ./src/
COPY postcss.config.js tailwind.config.js vite.config.js ./

# Build arg for API URL — passed at build time
ARG VITE_API_URL=https://cutnculturesalon.cloud/api
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx config for React SPA
RUN echo 'server { \
    listen 80; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { try_files $uri $uri/ /index.html; } \
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ { expires 1y; add_header Cache-Control "public, immutable"; } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
