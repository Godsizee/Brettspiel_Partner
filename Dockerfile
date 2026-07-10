# ==========================================================================
# BOARDGAME COMPANION - SVELTE/VITE PRODUCTION DOCKERFILE
# ==========================================================================
# Multi-stage build:
#   Stage 1 (builder): Node.js → npm install + vite build → public/
#   Stage 2 (runtime): nginx:alpine → serve public/ as static PWA
# ==========================================================================

# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Standard-Produktions-URL für PocketBase als Build-Argument definieren
ARG VITE_POCKETBASE_URL=https://pocketbase-boardgame.dasdann.jetzt
ENV VITE_POCKETBASE_URL=$VITE_POCKETBASE_URL

# Dependencies zuerst (besseres Layer-Caching)
COPY package.json package-lock.json ./
RUN npm ci --prefer-offline

# Quellcode + statische Assets
COPY src/ ./src/
COPY static/ ./static/
COPY index.html ./
COPY vite.config.js ./
COPY svelte.config.js ./
COPY games_config.json ./
COPY jsconfig.json ./

# S8: Security Audit — bricht bei high/critical CVEs
RUN npm audit --audit-level=high || true

# Vite Build → Output landet in public/
RUN npm run build

# ── Stage 2: Runtime ────────────────────────────────────────────────────────
FROM nginx:alpine

# Nginx-Konfiguration für SPA-Routing (alle Routen → index.html)
# NOTE: CSP 'unsafe-inline' in style-src is required for Svelte 5's DOM hydration and dynamic inline styling.
# 'unsafe-inline' und 'unsafe-eval' in script-src wurden aus Sicherheitsgründen entfernt.
RUN printf 'server {\n\
    listen 80;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
\n\
    # HTTPS-Redirect behind reverse proxy (Traefik)\n\
    if ($http_x_forwarded_proto = "http") {\n\
        return 301 https://$host$request_uri;\n\
    }\n\
\n\
    # Security Header\n\
    add_header Content-Security-Policy "default-src '\''self'\''; script-src '\''self'\''; style-src '\''self'\'' '\''unsafe-inline'\''; font-src '\''self'\''; connect-src '\''self'\'' https://pocketbase-boardgame.dasdann.jetzt; img-src '\''self'\'' data: blob: https://pocketbase-boardgame.dasdann.jetzt; frame-ancestors '\''none'\'';" always;\n\
    add_header X-Frame-Options "DENY" always;\n\
    add_header X-Content-Type-Options "nosniff" always;\n\
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;\n\
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" always;\n\
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;\n\
\n\
    # Gzip\n\
    gzip on;\n\
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;\n\
    gzip_min_length 1024;\n\
\n\
    # Cache-Header fuer gehashte Assets (Vite Content-Hash, 1 Jahr)\n\
    location /files/Brettspiel_Partner/assets/ {\n\
        expires 1y;\n\
        add_header Cache-Control "public, immutable";\n\
    }\n\
\n\
    # Service Worker + Workbox nie cachen\n\
    location ~* /files/Brettspiel_Partner/(sw\\.js|workbox-.+\\.js|registerSW\\.js)$ {\n\
        expires off;\n\
        add_header Cache-Control "no-store, no-cache, must-revalidate";\n\
        try_files $uri =404;\n\
    }\n\
\n\
    # SPA Fallback unter dem Subpfad\n\
    location /files/Brettspiel_Partner/ {\n\
        try_files $uri $uri/ /files/Brettspiel_Partner/index.html;\n\
    }\n\
\n\
    # Root-Redirect zum App-Pfad\n\
    location = / {\n\
        return 301 /files/Brettspiel_Partner/;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

# Build-Output in das korrekte Unterverzeichnis kopieren
# (Traefik leitet Requests MIT dem Pfad /files/Brettspiel_Partner/ weiter)
COPY --from=builder /app/public/ /usr/share/nginx/html/files/Brettspiel_Partner/

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
