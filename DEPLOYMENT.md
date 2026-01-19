# World Wide Webb - Production Deployment Guide

Complete guide for deploying the World Wide Webb captive portal to production.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Server Setup](#server-setup)
- [Unifi Controller Configuration](#unifi-controller-configuration)
- [Application Deployment](#application-deployment)
- [Reverse Proxy Setup](#reverse-proxy-setup)
- [Database Backups](#database-backups)
- [Monitoring & Alerts](#monitoring--alerts)
- [Security Checklist](#security-checklist)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Hardware Requirements
- **Server:** Linux server (Ubuntu 22.04 LTS recommended) with 2GB RAM, 2 CPU cores, 20GB disk
- **Network Gateway:** Unifi Pro Max or compatible Unifi controller
- **Internet:** Stable connection for email delivery and updates

### Software Requirements
- Docker & Docker Compose (recommended) OR Node.js 20+
- Domain name with DNS control (for HTTPS/SSL)
- Email provider account (Resend recommended)
- Unifi Controller with API access enabled

### Accounts & Access
- Unifi Controller admin credentials
- Resend API key (https://resend.com)
- Server SSH access with sudo privileges

---

## Server Setup

### 1. Initial Server Configuration

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y git curl wget ufw fail2ban

# Configure firewall (allow SSH, HTTP, HTTPS)
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Enable fail2ban for SSH protection
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 2. Install Docker (Recommended Method)

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add current user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install -y docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

### 3. Alternative: Install Node.js (Without Docker)

```bash
# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install pnpm
corepack enable
corepack prepare pnpm@latest --activate

# Verify installation
node --version
pnpm --version
```

---

## Unifi Controller Configuration

### 1. Enable API Access

1. Log into your Unifi Controller (https://controller-ip:8443)
2. Navigate to **Settings** → **System** → **Advanced**
3. Enable **"Enable API Access"** (required for guest authorization)
4. Note your controller URL, username, and password

### 2. Configure Guest Network (VLAN)

1. Navigate to **Settings** → **Networks**
2. Create new network or edit existing guest network:
   - **Name:** `Guest WiFi`
   - **VLAN ID:** `10` (or your preferred VLAN)
   - **Purpose:** `Guest`
   - **Gateway/Subnet:** `10.0.10.1/24` (example)
   - **DHCP:** Enabled
   - **Guest Policy:** Apply restrictions as needed

3. Save and apply settings

### 3. Configure Captive Portal

1. Navigate to **Settings** → **Guest Control**
2. Enable **"Guest Portal"**
3. Configure portal settings:
   - **Authentication:** `External Portal Server`
   - **Redirect URL:** `https://yourdomain.com`
   - **Use Secure Portal:** Enabled (HTTPS)
   - **Portal Customization:** Disabled (we handle UI)

4. Under **Access Control**:
   - **Default Access:** `Pre-Authorization Access` (allow DNS, HTTP/HTTPS to portal)
   - **Pre-Authorization Access:**
     - Allow access to: `yourdomain.com` (your portal domain)
     - Allow ports: `80, 443`

5. Save settings

### 4. Create Local Admin User (Recommended)

For better security, create a dedicated Unifi admin account for the portal:

1. Navigate to **Settings** → **Admins**
2. Click **Add Admin**
   - **Name:** `captive-portal-api`
   - **Email:** `portal@yourdomain.com`
   - **Role:** `Limited Admin` with permissions:
     - View-only for most settings
     - Full control for **Guest Control** and **Clients**
3. Set strong password and note credentials

---

## Application Deployment

### Option 1: Docker Deployment (Recommended)

#### 1. Clone Repository

```bash
# Create application directory
sudo mkdir -p /opt/world-wide-webb
cd /opt/world-wide-webb

# Clone repository
git clone https://github.com/yourusername/world-wide-webb.git .

# Set ownership
sudo chown -R $USER:$USER /opt/world-wide-webb
```

#### 2. Configure Environment Variables

```bash
# Copy environment template
cp .env.example .env

# Generate secrets
openssl rand -base64 32  # Use for BETTER_AUTH_SECRET
openssl rand -base64 32  # Use for CRON_SECRET

# Edit .env file
nano .env
```

**Critical variables to set:**

```bash
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://yourdomain.com
BETTER_AUTH_URL=https://yourdomain.com

# Security - MUST CHANGE
BETTER_AUTH_SECRET=<generated-secret-from-above>
CRON_SECRET=<generated-secret-from-above>

# Admin Account
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=<strong-password-12-chars-min>
ADMIN_NOTIFY_EMAIL=admin@yourdomain.com

# Unifi Controller
UNIFI_CONTROLLER_URL=https://192.168.1.1:8443
UNIFI_USERNAME=captive-portal-api
UNIFI_PASSWORD=<unifi-admin-password>
UNIFI_SITE=default
UNIFI_SKIP_SSL_VERIFY=true
ALLOW_OFFLINE_AUTH=false  # Fail-fast in production

# Email (Resend)
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM=WiFi Guest Portal <wifi@yourdomain.com>

# Database
DATABASE_PATH=/app/data/captive-portal.db
```

#### 3. Deploy with Docker Compose

```bash
# Build and start services
docker compose up -d

# View logs
docker compose logs -f app

# Check health
docker compose ps
```

#### 4. Verify Deployment

```bash
# Test health endpoint
curl http://localhost:3000/api/health

# Expected response:
# {"status":"healthy","database":"ok","unifi":"ok","email":"ok"}
```

### Option 2: Systemd Service (Without Docker)

#### 1. Build Application

```bash
cd /opt/world-wide-webb

# Install dependencies
pnpm install --frozen-lockfile

# Build application
pnpm build

# Run database setup
pnpm setup
```

#### 2. Create Systemd Service

Create `/etc/systemd/system/world-wide-webb.service`:

```ini
[Unit]
Description=World Wide Webb Captive Portal
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/world-wide-webb
Environment="NODE_ENV=production"
EnvironmentFile=/opt/world-wide-webb/.env
ExecStart=/usr/bin/node /opt/world-wide-webb/.next/standalone/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=world-wide-webb

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/world-wide-webb/data

[Install]
WantedBy=multi-user.target
```

#### 3. Enable and Start Service

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable auto-start on boot
sudo systemctl enable world-wide-webb

# Start service
sudo systemctl start world-wide-webb

# Check status
sudo systemctl status world-wide-webb

# View logs
sudo journalctl -u world-wide-webb -f
```

---

## Reverse Proxy Setup

A reverse proxy is required for:
- HTTPS/SSL termination with Let's Encrypt
- Domain routing to the application
- Security headers and rate limiting

### Option 1: Caddy (Easiest - Auto SSL)

#### 1. Install Caddy

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

#### 2. Configure Caddy

Create `/etc/caddy/Caddyfile`:

```caddyfile
# World Wide Webb Captive Portal
yourdomain.com {
    # Automatic HTTPS with Let's Encrypt

    # Security headers
    header {
        # Enable HSTS
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        # Prevent clickjacking
        X-Frame-Options "SAMEORIGIN"
        # XSS protection
        X-Content-Type-Options "nosniff"
        # Content Security Policy
        Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'"
        # Remove server header
        -Server
    }

    # Reverse proxy to Next.js
    reverse_proxy localhost:3000 {
        # Preserve original client IP
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }

    # Enable compression
    encode gzip zstd

    # Logging
    log {
        output file /var/log/caddy/world-wide-webb.log
        format json
    }
}

# Redirect www to non-www
www.yourdomain.com {
    redir https://yourdomain.com{uri} permanent
}
```

#### 3. Start Caddy

```bash
# Reload configuration
sudo systemctl reload caddy

# Check status
sudo systemctl status caddy

# View logs
sudo journalctl -u caddy -f
```

### Option 2: Nginx with Certbot

#### 1. Install Nginx and Certbot

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

#### 2. Configure Nginx

Create `/etc/nginx/sites-available/world-wide-webb`:

```nginx
# Rate limiting zones
limit_req_zone $binary_remote_addr zone=guest_verify:10m rate=5r/m;
limit_req_zone $binary_remote_addr zone=admin_login:10m rate=3r/m;

# Upstream to Next.js
upstream world_wide_webb {
    server 127.0.0.1:3000;
    keepalive 64;
}

# HTTP - redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://yourdomain.com$request_uri;
    }
}

# HTTPS
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com;

    # SSL certificates (managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Proxy settings
    location / {
        proxy_pass http://world_wide_webb;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Rate limiting for guest verification
    location /api/guest/verify-email {
        limit_req zone=guest_verify burst=3 nodelay;
        proxy_pass http://world_wide_webb;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Rate limiting for admin login
    location /api/auth/sign-in {
        limit_req zone=admin_login burst=2 nodelay;
        proxy_pass http://world_wide_webb;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Logging
    access_log /var/log/nginx/world-wide-webb-access.log;
    error_log /var/log/nginx/world-wide-webb-error.log;
}

# Redirect www to non-www
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    return 301 https://yourdomain.com$request_uri;
}
```

#### 3. Enable Site and Get SSL Certificate

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/world-wide-webb /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Restart Nginx
sudo systemctl restart nginx

# Enable auto-renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

---

## Database Backups

### Automated Backup Script

Create `/opt/world-wide-webb/scripts/backup-db.sh`:

```bash
#!/bin/bash
set -e

# Configuration
DB_PATH="/opt/world-wide-webb/data/captive-portal.db"
BACKUP_DIR="/opt/backups/world-wide-webb"
RETENTION_DAYS=30

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup filename with timestamp
BACKUP_FILE="$BACKUP_DIR/captive-portal-$(date +%Y%m%d-%H%M%S).db"

# Create backup (SQLite supports hot backups)
sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"

# Compress backup
gzip "$BACKUP_FILE"

# Delete backups older than retention period
find "$BACKUP_DIR" -name "*.db.gz" -mtime +$RETENTION_DAYS -delete

# Log success
echo "$(date): Backup created: $BACKUP_FILE.gz"
```

Make executable:

```bash
chmod +x /opt/world-wide-webb/scripts/backup-db.sh
```

### Configure Cron for Daily Backups

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /opt/world-wide-webb/scripts/backup-db.sh >> /var/log/world-wide-webb-backup.log 2>&1
```

### Restore from Backup

```bash
# Stop application
sudo systemctl stop world-wide-webb  # OR: docker compose down

# Restore database
gunzip -c /opt/backups/world-wide-webb/captive-portal-20260119-020000.db.gz > /opt/world-wide-webb/data/captive-portal.db

# Restart application
sudo systemctl start world-wide-webb  # OR: docker compose up -d
```

### Offsite Backup (Optional)

For critical deployments, configure offsite backups using:

**Option 1: Rsync to remote server**
```bash
# Add to backup script after compression
rsync -az "$BACKUP_DIR/" user@remote-server:/backups/world-wide-webb/
```

**Option 2: Cloud storage (S3, Backblaze B2)**
```bash
# Install rclone
curl https://rclone.org/install.sh | sudo bash

# Configure remote
rclone config

# Add to backup script
rclone copy "$BACKUP_DIR/" remote:world-wide-webb-backups/
```

---

## Monitoring & Alerts

### Health Check Monitoring

Use **UptimeRobot** or **Healthchecks.io** for free monitoring:

#### UptimeRobot Setup

1. Sign up at https://uptimerobot.com
2. Add new monitor:
   - **Monitor Type:** HTTP(s)
   - **URL:** `https://yourdomain.com/api/health`
   - **Monitoring Interval:** 5 minutes
   - **Alert Contacts:** Your email
3. Expected response: `{"status":"healthy"}`

#### Healthchecks.io Setup

1. Sign up at https://healthchecks.io
2. Create new check:
   - **Name:** World Wide Webb Health
   - **Period:** 10 minutes
   - **Grace Time:** 5 minutes
3. Add cron job to ping check:

```bash
# Add to crontab
*/10 * * * * curl -fsS --retry 3 https://hc-ping.com/your-check-uuid > /dev/null
```

### Log Monitoring

View application logs in real-time:

**Docker:**
```bash
docker compose logs -f app
```

**Systemd:**
```bash
sudo journalctl -u world-wide-webb -f
```

**Log rotation (for standalone deployments):**

Create `/etc/logrotate.d/world-wide-webb`:

```
/var/log/world-wide-webb/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        systemctl reload world-wide-webb > /dev/null 2>&1 || true
    endscript
}
```

### Metrics Dashboard (Optional)

For advanced monitoring, expose Prometheus metrics:

1. Create `/api/prometheus/route.ts` (future enhancement)
2. Set up Prometheus + Grafana
3. Import dashboard JSON

---

## Security Checklist

Before going live, verify all security measures:

### Application Security
- [ ] **Secrets rotated:** BETTER_AUTH_SECRET and CRON_SECRET generated with `openssl rand -base64 32`
- [ ] **Admin password:** Strong password (12+ characters) set in production
- [ ] **ALLOW_OFFLINE_AUTH:** Set to `false` (fail-fast on Unifi errors)
- [ ] **Unifi credentials:** Dedicated limited admin account created
- [ ] **TOTP enabled:** Admin forced to set up 2FA on first login
- [ ] **Input validation:** All user inputs validated with Zod schemas
- [ ] **Rate limiting:** Enabled on all public endpoints

### Server Security
- [ ] **Firewall configured:** Only ports 22, 80, 443 open
- [ ] **SSH hardening:** Password authentication disabled, key-only access
- [ ] **Fail2ban enabled:** Protection against brute force attacks
- [ ] **Auto-updates enabled:** Unattended security updates configured
- [ ] **Non-root user:** Application runs as unprivileged user (nextjs/www-data)
- [ ] **File permissions:** Database directory owned by app user only

### Network Security
- [ ] **HTTPS enforced:** HTTP redirects to HTTPS
- [ ] **SSL certificate valid:** Let's Encrypt auto-renewal configured
- [ ] **Security headers:** HSTS, CSP, X-Frame-Options configured in reverse proxy
- [ ] **Unifi API access:** Controller not exposed to public internet
- [ ] **Guest VLAN isolated:** Guest network cannot access internal network

### Monitoring Security
- [ ] **Health endpoint protected:** Not exposed publicly (or use auth)
- [ ] **Logs monitored:** Alert on repeated authentication failures
- [ ] **Backup encrypted:** Database backups stored securely
- [ ] **Email SPF/DKIM:** Domain configured for email authentication

---

## Troubleshooting

### Application Won't Start

**Check logs:**
```bash
# Docker
docker compose logs app

# Systemd
sudo journalctl -u world-wide-webb -n 100
```

**Common issues:**
- **Database migration failed:** Run `pnpm db:migrate` manually
- **Port 3000 in use:** Check for conflicting process with `sudo lsof -i :3000`
- **Better-sqlite3 build error:** Rebuild native modules for Alpine: `docker compose build --no-cache`

### Unifi Authorization Failing

**Verify Unifi connectivity:**
```bash
curl -k https://your-controller:8443
```

**Check credentials:**
```bash
# Test API login
curl -k -X POST https://your-controller:8443/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"your-user","password":"your-password"}'
```

**Common issues:**
- **SSL certificate error:** Set `UNIFI_SKIP_SSL_VERIFY=true` for self-signed certs
- **403 Forbidden:** Unifi user lacks permissions (needs full Guest Control access)
- **ALLOW_OFFLINE_AUTH=true in production:** Set to `false` for fail-fast behavior

### Email Not Sending

**Check email provider status:**
```bash
# Test health endpoint
curl http://localhost:3000/api/health
```

**For Resend:**
- Verify API key is correct (`re_...` format)
- Check domain verification in Resend dashboard
- Review Resend logs for bounces/blocks

**For Mailpit:**
- Check container is running: `docker compose ps`
- View web UI: http://localhost:8025

### Guest Can't Access Internet After Auth

**Verify MAC authorization:**
```bash
# Check Unifi authorized guests (via controller UI)
Settings → Guest Control → Guests
```

**Common issues:**
- **MAC address mismatch:** iOS randomizes MAC per network (expected, portal handles this)
- **Captive portal loop:** Clear browser cache, try incognito mode
- **Firewall blocking:** Verify guest VLAN rules allow internet after auth

### High Memory Usage

**Check database size:**
```bash
du -h data/captive-portal.db
```

**Optimize if database is large:**
```bash
# Vacuum database
sqlite3 data/captive-portal.db "VACUUM;"

# Archive old logs (optional)
sqlite3 data/captive-portal.db "DELETE FROM activity_logs WHERE createdAt < date('now', '-90 days');"
```

### Cannot Login as Admin

**Reset admin password:**
```bash
# Edit .env
nano .env

# Change ADMIN_PASSWORD to new password

# Re-run seed script
pnpm db:seed  # OR: docker compose exec app pnpm db:seed
```

**Lost TOTP device:**
Use backup codes generated during TOTP setup. If lost, disable TOTP in database:

```bash
sqlite3 data/captive-portal.db
UPDATE user SET twoFactorEnabled = 0 WHERE email = 'admin@example.com';
.quit
```

---

## Production Checklist

Final verification before going live:

### Pre-Launch
- [ ] Domain DNS pointing to server IP
- [ ] SSL certificate obtained and auto-renewal configured
- [ ] All environment variables set in `.env` (no defaults)
- [ ] Database migrations applied (`pnpm setup`)
- [ ] Admin account created and TOTP configured
- [ ] Unifi captive portal configured with redirect to https://yourdomain.com
- [ ] Test guest authentication flow end-to-end
- [ ] Test admin login and dashboard access
- [ ] Backup script configured and tested
- [ ] Health check monitoring configured
- [ ] Firewall rules applied and tested

### Post-Launch
- [ ] Monitor logs for errors (first 24 hours)
- [ ] Verify guests can connect successfully
- [ ] Test from multiple devices (iOS, Android, laptop)
- [ ] Review Unifi authorized guests list
- [ ] Check email delivery (welcome emails sent)
- [ ] Verify backups are running daily
- [ ] Set up calendar reminder to review logs weekly

---

## Support & Resources

- **GitHub Issues:** https://github.com/yourusername/world-wide-webb/issues
- **Better Auth Docs:** https://www.better-auth.com
- **Unifi API Docs:** https://ubntwiki.com/products/software/unifi-controller/api
- **Resend Docs:** https://resend.com/docs
- **Caddy Docs:** https://caddyserver.com/docs
- **Nginx Docs:** https://nginx.org/en/docs

For additional help, consult the [README.md](./README.md) and [CLAUDE.md](./CLAUDE.md) files.
