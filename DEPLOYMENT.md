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

**Option 1: Use Secrets Generator (Recommended)**

```bash
# Interactive mode - guides you through setup
pnpm generate-secrets --output .env

# Automatic mode - generates all secrets without prompting
pnpm generate-secrets:auto --output .env
```

The secrets generator will:
- Generate cryptographically secure secrets (BETTER_AUTH_SECRET, admin password)
- Validate password complexity (12+ characters, mixed case, numbers, symbols)
- Guide you through Unifi and email configuration
- Create a production-ready `.env` file

**Option 2: Manual Setup**

```bash
# Copy environment template
cp .env.example .env

# Generate secrets manually
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

The project includes comprehensive backup and restore scripts with automatic rotation, integrity verification, and offsite copy support.

### Quick Start

**Create a manual backup:**
```bash
pnpm db:backup
```

**List available backups:**
```bash
pnpm db:restore:list
```

**Restore from backup:**
```bash
pnpm db:restore
```

For detailed documentation, see [scripts/BACKUP_README.md](scripts/BACKUP_README.md).

### Production Setup (Automated Daily Backups)

#### Using Systemd (Recommended)

The project includes systemd timer files for automated daily backups at 2 AM.

1. **Copy systemd files:**
   ```bash
   sudo cp /opt/world-wide-webb/scripts/systemd/captive-portal-backup.* /etc/systemd/system/
   ```

2. **Edit service file paths:**
   ```bash
   sudo nano /etc/systemd/system/captive-portal-backup.service
   ```

   Update these paths to match your installation:
   - `WorkingDirectory=/opt/world-wide-webb`
   - `ExecStart=/usr/bin/tsx /opt/world-wide-webb/scripts/backup-database.ts --verify --retention-days 30`
   - `User=www-data` (or your app user)
   - `Group=www-data` (or your app group)

3. **Enable and start timer:**
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable captive-portal-backup.timer
   sudo systemctl start captive-portal-backup.timer
   ```

4. **Verify timer is active:**
   ```bash
   sudo systemctl status captive-portal-backup.timer
   systemctl list-timers captive-portal-backup.timer
   ```

5. **Test backup manually:**
   ```bash
   sudo systemctl start captive-portal-backup.service
   sudo systemctl status captive-portal-backup.service
   ```

#### Using Cron (Alternative)

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM with verification and 30-day retention
0 2 * * * cd /opt/world-wide-webb && /usr/bin/tsx scripts/backup-database.ts --verify --retention-days 30 >> /var/log/captive-portal-backup.log 2>&1
```

### Offsite Backups

For production, configure offsite backups to protect against hardware failure.

#### Option 1: NFS/CIFS Mount

```bash
# Mount NAS share
sudo mount -t nfs nas.local:/backups /mnt/nas

# Update systemd service to copy to offsite location
sudo nano /etc/systemd/system/captive-portal-backup.service
```

Change `ExecStart` to:
```
ExecStart=/usr/bin/tsx /opt/world-wide-webb/scripts/backup-database.ts --verify --retention-days 30 --offsite-dir /mnt/nas/captive-portal
```

#### Option 2: Cloud Sync (Rclone)

```bash
# Install rclone
sudo apt install rclone

# Configure rclone remote (e.g., Backblaze B2, AWS S3, Google Drive)
rclone config

# Create post-backup sync script
cat > /opt/world-wide-webb/scripts/sync-backups.sh <<'EOF'
#!/bin/bash
rclone sync /opt/world-wide-webb/backups remote:captive-portal-backups --delete-after --log-file=/var/log/rclone-backup.log
EOF

chmod +x /opt/world-wide-webb/scripts/sync-backups.sh
```

Update systemd service:
```bash
sudo nano /etc/systemd/system/captive-portal-backup.service
```

Add after `ExecStart`:
```
ExecStartPost=/opt/world-wide-webb/scripts/sync-backups.sh
```

### Restore Procedures

#### Emergency Restore

If the database is corrupted or lost:

1. **Stop the application:**
   ```bash
   sudo systemctl stop world-wide-webb
   # OR for Docker:
   docker compose stop app
   ```

2. **List available backups:**
   ```bash
   cd /opt/world-wide-webb
   tsx scripts/restore-database.ts --list
   ```

3. **Restore from latest backup:**
   ```bash
   tsx scripts/restore-database.ts --backup-file backups/captive-portal-YYYY-MM-DDTHH-MM-SS.db
   ```

   The script will:
   - Verify backup integrity
   - Create pre-restore backup of current database
   - Ask for confirmation
   - Restore database
   - Verify restored database integrity

4. **Restart application:**
   ```bash
   sudo systemctl start world-wide-webb
   # OR for Docker:
   docker compose up -d
   ```

#### Verify Backup Integrity

```bash
# Manual verification
sqlite3 backups/captive-portal-LATEST.db "PRAGMA integrity_check;"

# Should output: ok
```

### Backup Monitoring

#### Check Backup Status

```bash
# View recent backup logs (systemd)
journalctl -u captive-portal-backup.service -n 50

# Check for failures in last 7 days
journalctl -u captive-portal-backup.service --since "7 days ago" | grep -i "failed\|error"

# List backup files
ls -lh /opt/world-wide-webb/backups/

# Check backup disk usage
du -sh /opt/world-wide-webb/backups/
```

#### Automated Backup Health Checks

Create `/opt/world-wide-webb/scripts/check-backups.sh`:

```bash
#!/bin/bash
# Alert if no backup in last 36 hours

BACKUP_DIR="/opt/world-wide-webb/backups"
MAX_AGE_HOURS=36

LATEST_BACKUP=$(find "$BACKUP_DIR" -name "captive-portal-*.db" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2)

if [ -z "$LATEST_BACKUP" ]; then
  echo "CRITICAL: No backups found in $BACKUP_DIR"
  exit 2
fi

LATEST_BACKUP_TIME=$(stat -c %Y "$LATEST_BACKUP")
NOW=$(date +%s)
AGE_HOURS=$(( (NOW - LATEST_BACKUP_TIME) / 3600 ))

if [ $AGE_HOURS -gt $MAX_AGE_HOURS ]; then
  echo "WARNING: Latest backup is $AGE_HOURS hours old (threshold: $MAX_AGE_HOURS)"
  exit 1
fi

echo "OK: Latest backup is $AGE_HOURS hours old"
exit 0
```

Make executable and add to cron:
```bash
chmod +x /opt/world-wide-webb/scripts/check-backups.sh

# Check every 6 hours, email on failure
crontab -e
0 */6 * * * /opt/world-wide-webb/scripts/check-backups.sh || echo "Backup check failed" | mail -s "Captive Portal Backup Alert" admin@example.com
```

### Backup Features

- **Atomic Backups**: Uses SQLite `VACUUM INTO` for crash-safe backups
- **Hot Backups**: No application downtime required
- **Integrity Verification**: Optional `--verify` flag validates backups
- **Automatic Rotation**: Keeps last 30 days by default (configurable)
- **Offsite Support**: Built-in support for NAS/cloud destinations
- **Pre-Restore Safety**: Creates backup before restore
- **Dry-Run Mode**: Test backup/restore without changes

### Testing Backup & Restore

Run quarterly disaster recovery drills:

```bash
# 1. Create test backup
tsx scripts/backup-database.ts --verify

# 2. Stop application
sudo systemctl stop world-wide-webb

# 3. Simulate corruption
cp data/captive-portal.db data/captive-portal.db.pre-drill
dd if=/dev/random of=data/captive-portal.db bs=1024 count=10

# 4. Restore from backup
tsx scripts/restore-database.ts --backup-file backups/captive-portal-LATEST.db --force

# 5. Verify application works
sudo systemctl start world-wide-webb
curl http://localhost:3000/api/health

# 6. Document recovery time
echo "Disaster recovery drill completed in X minutes" >> /var/log/backup-drill.log
```

### Backup Metrics

- **RTO (Recovery Time Objective)**: < 5 minutes
- **RPO (Recovery Point Objective)**: 24 hours (daily backups)
- **Backup Size**: ~100-500 KB per backup (varies with guest count)
- **Retention**: 30 days = ~30 MB total disk usage
- **Backup Duration**: < 1 second
- **Restore Duration**: < 5 seconds

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
- [ ] **Secrets generated:** Use `pnpm generate-secrets` or `openssl rand -base64 32` for BETTER_AUTH_SECRET
- [ ] **Admin password:** Strong password (12+ characters, mixed case, numbers, symbols) - secrets generator validates this automatically
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
