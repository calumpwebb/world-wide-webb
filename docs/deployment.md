# Deployment Guide

Production deployment guide for World Wide Webb captive portal.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Reverse Proxy Setup](#reverse-proxy-setup)
  - [Caddy (Recommended)](#caddy-recommended)
  - [Nginx](#nginx)
  - [Traefik](#traefik)
- [Firewall Configuration](#firewall-configuration)
- [Monitoring Setup](#monitoring-setup)
- [Production Checklist](#production-checklist)

---

## Prerequisites

Before deploying to production:

1. **Domain name** - Point a domain (e.g., `wifi.yourdomain.com`) to your server
2. **Docker** - Installed and running
3. **Unifi Controller** - Accessible from the server
4. **Email provider** - Resend API key for production emails

---

## Reverse Proxy Setup

The application runs on port 3000 by default. A reverse proxy handles HTTPS termination and security headers.

### Caddy (Recommended)

Caddy automatically obtains and renews Let's Encrypt certificates.

#### Installation

```bash
# Ubuntu/Debian
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy

# macOS
brew install caddy
```

#### Caddyfile

Create `/etc/caddy/Caddyfile`:

```caddyfile
wifi.yourdomain.com {
    # Reverse proxy to the app
    reverse_proxy localhost:3000

    # Security headers
    header {
        # Prevent clickjacking
        X-Frame-Options "SAMEORIGIN"
        # Prevent MIME type sniffing
        X-Content-Type-Options "nosniff"
        # Enable XSS filter
        X-XSS-Protection "1; mode=block"
        # Referrer policy
        Referrer-Policy "strict-origin-when-cross-origin"
        # Content Security Policy
        Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:;"
        # HSTS (be careful with this in testing)
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        # Remove server header
        -Server
    }

    # Logging
    log {
        output file /var/log/caddy/wifi-access.log
        format json
    }

    # Handle captive portal detection
    # iOS/macOS captive portal detection
    @captive_apple path /hotspot-detect.html
    handle @captive_apple {
        respond "Success" 200
    }

    # Android captive portal detection
    @captive_android path /generate_204
    handle @captive_android {
        respond "" 204
    }

    # Windows captive portal detection
    @captive_windows path /connecttest.txt
    handle @captive_windows {
        respond "Microsoft Connect Test" 200
    }
}

# Redirect HTTP to HTTPS
http://wifi.yourdomain.com {
    redir https://{host}{uri} permanent
}
```

#### Start Caddy

```bash
# Enable and start
sudo systemctl enable caddy
sudo systemctl start caddy

# Verify
sudo systemctl status caddy
sudo caddy validate --config /etc/caddy/Caddyfile
```

---

### Nginx

For Nginx, you'll need to manage certificates separately (e.g., with Certbot).

#### Installation

```bash
# Ubuntu/Debian
sudo apt install nginx certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d wifi.yourdomain.com
```

#### Nginx Configuration

Create `/etc/nginx/sites-available/wifi`:

```nginx
# Rate limiting zone
limit_req_zone $binary_remote_addr zone=wifi_limit:10m rate=10r/s;

# Upstream
upstream wifi_backend {
    server 127.0.0.1:3000;
    keepalive 32;
}

# HTTP to HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name wifi.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name wifi.yourdomain.com;

    # SSL certificates (managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/wifi.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/wifi.yourdomain.com/privkey.pem;
    ssl_trusted_certificate /etc/letsencrypt/live/wifi.yourdomain.com/chain.pem;

    # SSL configuration
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # OCSP stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 1.1.1.1 8.8.8.8 valid=300s;
    resolver_timeout 5s;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:;" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Logging
    access_log /var/log/nginx/wifi-access.log;
    error_log /var/log/nginx/wifi-error.log;

    # Captive portal detection endpoints
    location = /hotspot-detect.html {
        return 200 'Success';
        add_header Content-Type text/plain;
    }

    location = /generate_204 {
        return 204;
    }

    location = /connecttest.txt {
        return 200 'Microsoft Connect Test';
        add_header Content-Type text/plain;
    }

    # Health check endpoint (no rate limiting)
    location = /api/health {
        proxy_pass http://wifi_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Main application
    location / {
        limit_req zone=wifi_limit burst=20 nodelay;

        proxy_pass http://wifi_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Buffer settings
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
    }
}
```

#### Enable the Site

```bash
sudo ln -s /etc/nginx/sites-available/wifi /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Auto-renew certificates
sudo systemctl enable certbot.timer
```

---

### Traefik

For Docker-based deployments with Traefik.

#### docker-compose.yml with Traefik

```yaml
services:
  traefik:
    image: traefik:v2.10
    command:
      - "--api.dashboard=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
      - "--certificatesresolvers.letsencrypt.acme.email=admin@yourdomain.com"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - traefik-certs:/letsencrypt
    networks:
      - captive-portal

  app:
    build: .
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.wifi.rule=Host(`wifi.yourdomain.com`)"
      - "traefik.http.routers.wifi.entrypoints=websecure"
      - "traefik.http.routers.wifi.tls.certresolver=letsencrypt"
      - "traefik.http.services.wifi.loadbalancer.server.port=3000"
      # Redirect HTTP to HTTPS
      - "traefik.http.routers.wifi-http.rule=Host(`wifi.yourdomain.com`)"
      - "traefik.http.routers.wifi-http.entrypoints=web"
      - "traefik.http.routers.wifi-http.middlewares=https-redirect"
      - "traefik.http.middlewares.https-redirect.redirectscheme.scheme=https"
      # Security headers
      - "traefik.http.middlewares.security-headers.headers.frameDeny=true"
      - "traefik.http.middlewares.security-headers.headers.contentTypeNosniff=true"
      - "traefik.http.middlewares.security-headers.headers.browserXssFilter=true"
      - "traefik.http.middlewares.security-headers.headers.stsSeconds=31536000"
      - "traefik.http.middlewares.security-headers.headers.stsIncludeSubdomains=true"
      - "traefik.http.routers.wifi.middlewares=security-headers"
    networks:
      - captive-portal

volumes:
  traefik-certs:

networks:
  captive-portal:
```

---

## Firewall Configuration

### UFW (Ubuntu)

```bash
# Allow SSH (if not already)
sudo ufw allow ssh

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow Unifi communication (if controller on different server)
# Usually not needed if on same network
# sudo ufw allow out 8443/tcp

# Enable firewall
sudo ufw enable

# Verify
sudo ufw status verbose
```

### iptables

```bash
# Allow established connections
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow loopback
iptables -A INPUT -i lo -j ACCEPT

# Allow SSH
iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# Allow HTTP/HTTPS
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Block app port from external (only accessible via reverse proxy)
iptables -A INPUT -p tcp --dport 3000 -j DROP

# Drop all other incoming
iptables -A INPUT -j DROP

# Save rules (Ubuntu/Debian)
sudo apt install iptables-persistent
sudo netfilter-persistent save
```

### Unifi Controller Access

Ensure the portal server can reach the Unifi Controller:

```bash
# Test connectivity to Unifi Controller
curl -k https://192.168.1.1:8443

# If using Docker, ensure the container can reach the controller
# The controller URL should be accessible from inside the container
docker exec world-wide-webb curl -k https://192.168.1.1:8443
```

---

## Monitoring Setup

### Health Check Endpoint

The portal exposes a health check at `GET /api/health`:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "checks": {
    "database": { "status": "pass", "latencyMs": 5 },
    "unifi": { "status": "pass", "latencyMs": 150 },
    "email": { "status": "pass", "message": "Resend configured" }
  },
  "version": "0.1.0"
}
```

Status codes:
- `200` - Healthy or degraded (some warnings)
- `503` - Unhealthy (critical failures)

### Metrics Endpoint

Detailed metrics at `GET /api/metrics`:

```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "guests": {
    "total": 150,
    "activeAuthorizations": 42,
    "expiredAuthorizations": 108,
    "expiringSoon": 5,
    "uniqueUsers": 87
  },
  "authentication": {
    "successfulAuths": 12,
    "failedAuths": 2,
    "pendingVerifications": 0
  },
  "admin": {
    "totalAdmins": 1,
    "revocationsLast24h": 0
  },
  "devices": {
    "totalDevices": 95,
    "activeDevices": 42
  }
}
```

### UptimeRobot Setup

1. Create account at [UptimeRobot](https://uptimerobot.com)
2. Add new monitor:
   - **Monitor Type**: HTTP(s)
   - **Friendly Name**: WiFi Portal
   - **URL**: `https://wifi.yourdomain.com/api/health`
   - **Monitoring Interval**: 5 minutes
3. Configure alerts:
   - Email alerts for down status
   - Optional: Slack, Discord, or webhook notifications

### Healthchecks.io (Cron Monitoring)

For background job monitoring:

1. Create account at [Healthchecks.io](https://healthchecks.io)
2. Create checks for each background job
3. Add ping to your background job scripts

### Better Stack (Formerly Logtail)

For log aggregation and alerting:

1. Sign up at [Better Stack](https://betterstack.com)
2. Create a source for your application
3. Configure log shipping:

```bash
# Install Vector for log shipping
curl --proto '=https' --tlsv1.2 -sSf https://sh.vector.dev | bash

# /etc/vector/vector.toml
[sources.docker_logs]
type = "docker_logs"

[sinks.betterstack]
type = "http"
inputs = ["docker_logs"]
uri = "https://in.logs.betterstack.com"
encoding.codec = "json"
headers.Authorization = "Bearer YOUR_TOKEN"
```

### Email Alerts on Health Check Failures

Add a simple cron job to check health and send alerts:

```bash
# /usr/local/bin/check-wifi-portal.sh
#!/bin/bash

HEALTH_URL="https://wifi.yourdomain.com/api/health"
ALERT_EMAIL="admin@yourdomain.com"
LAST_STATE_FILE="/tmp/wifi-portal-state"

# Check health
response=$(curl -s -w "\n%{http_code}" "$HEALTH_URL")
body=$(echo "$response" | head -n -1)
status_code=$(echo "$response" | tail -n 1)

# Parse status
current_state="healthy"
if [ "$status_code" != "200" ]; then
    current_state="down"
elif echo "$body" | grep -q '"status":"unhealthy"'; then
    current_state="unhealthy"
elif echo "$body" | grep -q '"status":"degraded"'; then
    current_state="degraded"
fi

# Get last state
last_state="healthy"
if [ -f "$LAST_STATE_FILE" ]; then
    last_state=$(cat "$LAST_STATE_FILE")
fi

# Save current state
echo "$current_state" > "$LAST_STATE_FILE"

# Alert on state change
if [ "$current_state" != "$last_state" ]; then
    if [ "$current_state" = "healthy" ]; then
        echo "WiFi Portal recovered: $body" | mail -s "✅ WiFi Portal Recovered" "$ALERT_EMAIL"
    else
        echo "WiFi Portal issue: $body" | mail -s "🚨 WiFi Portal $current_state" "$ALERT_EMAIL"
    fi
fi
```

```bash
# Make executable
chmod +x /usr/local/bin/check-wifi-portal.sh

# Add to crontab (check every 5 minutes)
# crontab -e
*/5 * * * * /usr/local/bin/check-wifi-portal.sh
```

### Docker Health Check

The `docker-compose.yml` includes a built-in health check:

```yaml
healthcheck:
  test: ['CMD', 'wget', '--no-verbose', '--tries=1', '--spider', 'http://localhost:3000/']
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 10s
```

Check container health:

```bash
# View health status
docker inspect --format='{{.State.Health.Status}}' world-wide-webb

# View health logs
docker inspect --format='{{json .State.Health}}' world-wide-webb | jq
```

---

## Production Checklist

### Before Going Live

- [ ] **Secrets configured**
  - [ ] `BETTER_AUTH_SECRET` - Unique, random 32+ characters
  - [ ] `ADMIN_PASSWORD` - Strong, unique password
  - [ ] `CRON_SECRET` - Unique secret for cron jobs
  - [ ] `RESEND_API_KEY` - Valid Resend API key

- [ ] **Email setup**
  - [ ] `EMAIL_PROVIDER=resend`
  - [ ] `EMAIL_FROM` - Verified sender domain
  - [ ] Test email delivery works

- [ ] **Unifi Controller**
  - [ ] Controller URL accessible from server
  - [ ] Admin credentials with appropriate permissions
  - [ ] Guest network configured on controller

- [ ] **HTTPS/SSL**
  - [ ] Valid certificate installed
  - [ ] HTTP redirects to HTTPS
  - [ ] Security headers configured

- [ ] **Firewall**
  - [ ] Port 80/443 open
  - [ ] Port 3000 blocked from external access
  - [ ] Unifi Controller reachable

- [ ] **Monitoring**
  - [ ] Health check monitoring configured
  - [ ] Alert notifications working
  - [ ] Logs being collected

- [ ] **Backup**
  - [ ] Database volume backed up
  - [ ] `.env` file backed up securely

### Environment Variables for Production

```bash
# .env.production
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://wifi.yourdomain.com

# Auth
BETTER_AUTH_SECRET=your-very-long-random-secret-at-least-32-chars
BETTER_AUTH_URL=https://wifi.yourdomain.com

# Email
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_your_api_key
EMAIL_FROM=WiFi Guest Portal <wifi@yourdomain.com>

# Admin
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=your-very-strong-password
ADMIN_NOTIFY_EMAIL=admin@yourdomain.com

# Unifi
UNIFI_CONTROLLER_URL=https://192.168.1.1:8443
UNIFI_USERNAME=portal-admin
UNIFI_PASSWORD=your-unifi-password
UNIFI_SITE=default
UNIFI_SKIP_SSL_VERIFY=true

# Database
DATABASE_PATH=/app/data/captive-portal.db
```

### Deployment Commands

```bash
# Build and start
docker compose -f docker-compose.yml up -d --build

# View logs
docker compose logs -f app

# Run migrations
docker exec world-wide-webb npm run db:migrate

# Seed admin user
docker exec world-wide-webb npm run db:seed

# Check health
curl https://wifi.yourdomain.com/api/health

# Restart after config changes
docker compose restart app
```
