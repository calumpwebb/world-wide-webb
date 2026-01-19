# Database Backup & Restore Guide

This directory contains automated backup and restore scripts for the SQLite database.

## Quick Start

### Create a Manual Backup

```bash
# Basic backup (creates backups/captive-portal-YYYY-MM-DDTHH-MM-SS.db)
tsx scripts/backup-database.ts

# Backup with integrity verification
tsx scripts/backup-database.ts --verify

# Backup to offsite location (e.g., mounted NAS)
tsx scripts/backup-database.ts --offsite-dir /mnt/nas/captive-portal-backups

# Keep only 7 days of backups
tsx scripts/backup-database.ts --retention-days 7

# Dry run to see what would happen
tsx scripts/backup-database.ts --dry-run
```

### Restore from Backup

```bash
# List available backups
tsx scripts/restore-database.ts --list

# Restore from specific backup (with confirmation prompt)
tsx scripts/restore-database.ts --backup-file backups/captive-portal-2024-01-19T02-00-00.db

# Restore without pre-restore backup (⚠️ DANGEROUS!)
tsx scripts/restore-database.ts --backup-file <PATH> --no-backup --force

# Preview restore without making changes
tsx scripts/restore-database.ts --backup-file <PATH> --dry-run
```

## Automated Backups

### Using Systemd (Linux Production)

The systemd timer runs backups daily at 2 AM with automatic rotation.

#### Installation

1. **Copy systemd files to system directory:**

```bash
sudo cp scripts/systemd/captive-portal-backup.* /etc/systemd/system/
```

2. **Edit service file paths if needed:**

```bash
sudo nano /etc/systemd/system/captive-portal-backup.service
```

Ensure these paths match your installation:
- `WorkingDirectory=/opt/captive-portal` → Your app directory
- `ExecStart=/usr/bin/tsx /opt/captive-portal/scripts/backup-database.ts` → Backup script path
- `User=captive-portal` → Your app user
- `Group=captive-portal` → Your app group

3. **Reload systemd and enable timer:**

```bash
sudo systemctl daemon-reload
sudo systemctl enable captive-portal-backup.timer
sudo systemctl start captive-portal-backup.timer
```

4. **Verify timer is active:**

```bash
# Check timer status
sudo systemctl status captive-portal-backup.timer

# List all timers
systemctl list-timers captive-portal-backup.timer

# View timer logs
journalctl -u captive-portal-backup.service -n 50
```

#### Manual Trigger

```bash
# Trigger backup immediately (useful for testing)
sudo systemctl start captive-portal-backup.service

# Check backup status
sudo systemctl status captive-portal-backup.service
```

### Using Cron (Alternative)

If you prefer cron over systemd:

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * cd /opt/captive-portal && /usr/bin/tsx scripts/backup-database.ts --verify --retention-days 30 >> /var/log/captive-portal-backup.log 2>&1
```

### Using Docker

If running in Docker, add a cron container to `docker-compose.yml`:

```yaml
backup:
  image: node:20-alpine
  volumes:
    - ./:/app
    - ./backups:/backups
    - ./data:/app/data:ro
  working_dir: /app
  command: sh -c "apk add --no-cache dcron && echo '0 2 * * * cd /app && tsx scripts/backup-database.ts --verify --retention-days 30' | crontab - && crond -f -l 2"
  restart: unless-stopped
```

## Backup Features

### Backup Script (`backup-database.ts`)

- **VACUUM INTO**: Uses SQLite's `VACUUM INTO` for atomic, optimized backups
- **Integrity Verification**: Optional `--verify` flag to check backup validity
- **Automatic Rotation**: Deletes backups older than retention period (default: 30 days)
- **Offsite Copy**: Optional `--offsite-dir` for copying to NAS/cloud mount
- **Dry Run**: Test backup process without creating files

### Restore Script (`restore-database.ts`)

- **List Backups**: `--list` shows all available backups sorted by date
- **Integrity Check**: Verifies backup before and after restore
- **Pre-Restore Backup**: Automatically backs up current database before restore
- **Confirmation Prompt**: Interactive confirmation (skip with `--force`)
- **Dry Run**: Preview restore without making changes

## Backup Strategy

### Daily Backups

- **Frequency**: Daily at 2 AM (configurable)
- **Retention**: 30 days (configurable with `--retention-days`)
- **Verification**: Enabled by default in systemd service
- **Location**: `./backups/` directory

### Offsite Backups

For production, configure offsite backups to protect against hardware failure:

#### Option 1: NFS/CIFS Mount

```bash
# Mount NAS share
sudo mount -t nfs nas.local:/backups /mnt/nas

# Run backup with offsite copy
tsx scripts/backup-database.ts --offsite-dir /mnt/nas/captive-portal
```

Update systemd service:

```bash
sudo nano /etc/systemd/system/captive-portal-backup.service
```

Change `ExecStart` to:

```
ExecStart=/usr/bin/tsx /opt/captive-portal/scripts/backup-database.ts --verify --retention-days 30 --offsite-dir /mnt/nas/captive-portal
```

#### Option 2: Cloud Sync (Rclone)

```bash
# Install rclone
sudo apt install rclone

# Configure rclone remote (e.g., Backblaze B2, AWS S3)
rclone config

# Create post-backup sync script
cat > /opt/captive-portal/scripts/sync-backups.sh <<'EOF'
#!/bin/bash
rclone sync /opt/captive-portal/backups remote:captive-portal-backups --delete-after --log-file=/var/log/rclone-backup.log
EOF

chmod +x /opt/captive-portal/scripts/sync-backups.sh
```

Update systemd service to run sync after backup:

```
ExecStart=/usr/bin/tsx /opt/captive-portal/scripts/backup-database.ts --verify --retention-days 30
ExecStartPost=/opt/captive-portal/scripts/sync-backups.sh
```

#### Option 3: Docker Volume Backup

If using Docker, backup the entire data volume:

```bash
# Create volume backup
docker run --rm -v captive-portal_data:/data -v $(pwd)/backups:/backup alpine tar czf /backup/volume-backup-$(date +%Y%m%d).tar.gz -C /data .
```

## Restore Procedures

### Emergency Restore

If the database is corrupted or lost:

1. **Stop the application:**

   ```bash
   sudo systemctl stop captive-portal
   # OR for Docker:
   docker compose stop app
   ```

2. **List available backups:**

   ```bash
   tsx scripts/restore-database.ts --list
   ```

3. **Restore from latest backup:**

   ```bash
   tsx scripts/restore-database.ts --backup-file backups/captive-portal-YYYY-MM-DDTHH-MM-SS.db
   ```

4. **Verify database integrity:**

   ```bash
   sqlite3 data/captive-portal.db "PRAGMA integrity_check;"
   ```

5. **Restart application:**

   ```bash
   sudo systemctl start captive-portal
   # OR for Docker:
   docker compose up -d
   ```

### Point-in-Time Restore

If you need to restore to a specific time (e.g., before a mistake):

1. **Find backup closest to desired time:**

   ```bash
   tsx scripts/restore-database.ts --list
   ```

2. **Restore from that backup:**

   ```bash
   tsx scripts/restore-database.ts --backup-file backups/captive-portal-YYYY-MM-DDTHH-MM-SS.db
   ```

3. **Verify data is correct:**

   ```bash
   sqlite3 data/captive-portal.db "SELECT COUNT(*) FROM guests;"
   sqlite3 data/captive-portal.db "SELECT * FROM activity_logs ORDER BY createdAt DESC LIMIT 10;"
   ```

### Partial Restore (Specific Data)

If you only need to restore specific data (e.g., a deleted guest):

1. **Restore backup to temporary location:**

   ```bash
   cp backups/captive-portal-YYYY-MM-DDTHH-MM-SS.db /tmp/restore.db
   ```

2. **Extract specific data:**

   ```bash
   sqlite3 /tmp/restore.db "SELECT * FROM guests WHERE email='user@example.com';"
   ```

3. **Manually insert into current database:**

   ```bash
   sqlite3 data/captive-portal.db "INSERT INTO guests (...) VALUES (...);"
   ```

## Testing Backup & Restore

### Test Backup Integrity

```bash
# Create backup with verification
tsx scripts/backup-database.ts --verify

# Manually verify integrity
sqlite3 backups/captive-portal-LATEST.db "PRAGMA integrity_check;"
```

### Test Restore Process

```bash
# Create test backup
tsx scripts/backup-database.ts

# Dry-run restore
tsx scripts/restore-database.ts --backup-file backups/captive-portal-LATEST.db --dry-run

# Actual restore test (creates pre-restore backup automatically)
tsx scripts/restore-database.ts --backup-file backups/captive-portal-LATEST.db
```

### Disaster Recovery Drill

Run quarterly to ensure backup/restore works:

1. **Create fresh backup:**

   ```bash
   tsx scripts/backup-database.ts --verify
   ```

2. **Stop application:**

   ```bash
   sudo systemctl stop captive-portal
   ```

3. **Corrupt database (simulated failure):**

   ```bash
   cp data/captive-portal.db data/captive-portal.db.pre-drill
   dd if=/dev/random of=data/captive-portal.db bs=1024 count=10
   ```

4. **Attempt restore:**

   ```bash
   tsx scripts/restore-database.ts --backup-file backups/captive-portal-LATEST.db --force
   ```

5. **Verify application works:**

   ```bash
   sudo systemctl start captive-portal
   curl http://localhost:3000/api/health
   ```

6. **Document recovery time:**

   ```bash
   echo "Disaster recovery drill completed in X minutes" >> /var/log/backup-drill.log
   ```

## Monitoring Backups

### Check Backup Status

```bash
# View recent backup logs
journalctl -u captive-portal-backup.service -n 50

# Check for backup failures
journalctl -u captive-portal-backup.service --since "7 days ago" | grep -i "failed\|error"

# List backup files
ls -lh backups/

# Check backup disk usage
du -sh backups/
```

### Backup Health Alerts

Create a monitoring script to alert on backup failures:

```bash
#!/bin/bash
# /opt/captive-portal/scripts/check-backups.sh

BACKUP_DIR="/opt/captive-portal/backups"
MAX_AGE_HOURS=36  # Alert if no backup in last 36 hours

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

Add to cron:

```bash
# Check backups every 6 hours, send email on failure
0 */6 * * * /opt/captive-portal/scripts/check-backups.sh || echo "Backup check failed" | mail -s "Captive Portal Backup Alert" admin@example.com
```

## Troubleshooting

### Backup Fails with "Database is locked"

The application is writing to the database. SQLite's `VACUUM INTO` handles this gracefully, but if backups consistently fail:

```bash
# Check for long-running transactions
sudo systemctl status captive-portal

# Increase backup retry delay in systemd service
sudo nano /etc/systemd/system/captive-portal-backup.service
# Add: Restart=on-failure
#      RestartSec=60s
```

### Backup Directory Full

```bash
# Check disk space
df -h /opt/captive-portal/backups

# Reduce retention period
tsx scripts/backup-database.ts --retention-days 7

# Or increase disk space
```

### Restore Fails with Integrity Check Error

```bash
# Try older backup
tsx scripts/restore-database.ts --list
tsx scripts/restore-database.ts --backup-file backups/captive-portal-OLDER.db

# If all backups corrupted, check disk health
sudo smartctl -a /dev/sda
```

### Systemd Timer Not Running

```bash
# Check timer status
systemctl status captive-portal-backup.timer

# Enable timer
sudo systemctl enable captive-portal-backup.timer
sudo systemctl start captive-portal-backup.timer

# Check systemd logs
journalctl -u captive-portal-backup.timer -n 50
```

## Best Practices

1. **Test Restores Regularly**: Run quarterly disaster recovery drills
2. **Monitor Backup Age**: Alert if no backup in 36 hours
3. **Use Offsite Backups**: Protect against hardware failure
4. **Verify Backups**: Always use `--verify` flag in production
5. **Keep Multiple Generations**: 30-day retention recommended
6. **Document Recovery**: Keep RTO/RPO metrics updated
7. **Encrypt Offsite Backups**: Use rclone crypt for cloud storage
8. **Monitor Disk Space**: Alert when backups/ directory > 80% full

## Backup Metrics

- **Backup Size**: ~100-500 KB per backup (varies with guest count)
- **Backup Time**: < 1 second for typical database
- **Restore Time**: < 5 seconds for typical restore
- **Retention**: 30 days = ~30 MB disk usage (estimated)
- **RTO**: < 5 minutes (includes app restart)
- **RPO**: 24 hours (daily backups)

## Security Considerations

1. **Backup Permissions**: Ensure backups are readable only by app user

   ```bash
   chmod 700 /opt/captive-portal/backups
   chown captive-portal:captive-portal /opt/captive-portal/backups
   ```

2. **Encrypt Offsite Backups**: Use rclone crypt for cloud storage

   ```bash
   rclone config  # Create encrypted remote
   rclone sync /opt/captive-portal/backups remote-crypt:backups
   ```

3. **Rotate Backup Encryption Keys**: Rotate offsite backup encryption annually

4. **Audit Backup Access**: Monitor who accesses backup files

   ```bash
   auditctl -w /opt/captive-portal/backups -p r -k backup_access
   ```

## See Also

- [DEPLOYMENT.md](../DEPLOYMENT.md) - Production deployment guide
- [README.md](../README.md) - Project overview
- [Drizzle Migrations](../drizzle/) - Database schema management
