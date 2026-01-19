# Monitoring & Alerting Guide

Comprehensive guide for monitoring the World Wide Webb captive portal in production using Prometheus, Grafana, and alerting systems.

## Table of Contents

- [Metrics Endpoints](#metrics-endpoints)
- [Prometheus Setup](#prometheus-setup)
- [Grafana Dashboard](#grafana-dashboard)
- [Alerting Rules](#alerting-rules)
- [Health Checks](#health-checks)
- [Log Aggregation](#log-aggregation)
- [Best Practices](#best-practices)

## Metrics Endpoints

The captive portal exposes two metrics endpoints:

### JSON Metrics (`GET /api/metrics`)

Human-readable JSON format for basic monitoring and debugging.

```bash
curl http://localhost:3000/api/metrics | jq
```

**Response:**
```json
{
  "timestamp": "2026-01-19T10:00:00.000Z",
  "guests": {
    "total": 42,
    "activeAuthorizations": 15,
    "expiredAuthorizations": 27,
    "expiringSoon": 3,
    "uniqueUsers": 38
  },
  "authentication": {
    "successfulAuths": 12,
    "failedAuths": 2,
    "pendingVerifications": 1
  },
  "admin": {
    "totalAdmins": 1,
    "revocationsLast24h": 0
  },
  "devices": {
    "totalDevices": 58,
    "activeDevices": 15
  }
}
```

### Prometheus Metrics (`GET /api/metrics/prometheus`)

Prometheus text format for scraping by Prometheus server.

```bash
curl http://localhost:3000/api/metrics/prometheus
```

**Response (excerpt):**
```
# HELP captive_portal_guests_total Total number of guest authorizations
# TYPE captive_portal_guests_total counter
captive_portal_guests_total 42

# HELP captive_portal_guests_active Number of active guest authorizations
# TYPE captive_portal_guests_active gauge
captive_portal_guests_active 15
```

## Prometheus Setup

### Installation

**Docker Compose (Recommended):**

Create `docker-compose.monitoring.yml`:

```yaml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: captive-portal-prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=30d'
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    container_name: captive-portal-grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=changeme
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards:ro
      - ./grafana/datasources:/etc/grafana/provisioning/datasources:ro
    restart: unless-stopped

volumes:
  prometheus_data:
  grafana_data:
```

**Start monitoring stack:**
```bash
docker compose -f docker-compose.monitoring.yml up -d
```

### Prometheus Configuration

Create `prometheus.yml`:

```yaml
global:
  scrape_interval: 30s
  evaluation_interval: 30s
  external_labels:
    monitor: 'captive-portal'

# Alertmanager configuration (optional)
alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - 'alertmanager:9093'

# Load alerting rules
rule_files:
  - 'alerts.yml'

scrape_configs:
  # Captive Portal application metrics
  - job_name: 'captive-portal'
    static_configs:
      - targets: ['host.docker.internal:3000']
    metrics_path: '/api/metrics/prometheus'
    scrape_interval: 30s
    scrape_timeout: 10s

  # Prometheus self-monitoring
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
```

**Note:** Use `host.docker.internal` when running Prometheus in Docker and the app on the host. For production, use the actual hostname/IP.

### Verify Prometheus

1. Open http://localhost:9090
2. Go to **Status → Targets** to verify scraping is working
3. Test query: `captive_portal_guests_active` in the **Graph** tab

## Grafana Dashboard

### Add Prometheus Data Source

1. Open Grafana: http://localhost:3001 (login: admin/changeme)
2. Go to **Configuration → Data Sources**
3. Click **Add data source**
4. Select **Prometheus**
5. Set URL: `http://prometheus:9090` (if using Docker Compose)
6. Click **Save & Test**

### Import Dashboard

Create `grafana/dashboards/captive-portal.json`:

```json
{
  "dashboard": {
    "title": "Captive Portal Metrics",
    "panels": [
      {
        "title": "Active Guest Authorizations",
        "targets": [
          {
            "expr": "captive_portal_guests_active"
          }
        ],
        "type": "stat"
      },
      {
        "title": "Authentication Success Rate",
        "targets": [
          {
            "expr": "rate(captive_portal_auth_success_total[5m]) / (rate(captive_portal_auth_success_total[5m]) + rate(captive_portal_auth_fail_total[5m]))"
          }
        ],
        "type": "gauge"
      },
      {
        "title": "Active Devices",
        "targets": [
          {
            "expr": "captive_portal_devices_active"
          }
        ],
        "type": "timeseries"
      },
      {
        "title": "Guest Authorizations Over Time",
        "targets": [
          {
            "expr": "captive_portal_guests_active",
            "legendFormat": "Active"
          },
          {
            "expr": "captive_portal_guests_expiring_soon",
            "legendFormat": "Expiring Soon"
          }
        ],
        "type": "timeseries"
      }
    ]
  }
}
```

**Import via UI:**
1. Go to **Dashboards → Import**
2. Upload `captive-portal.json`
3. Select Prometheus data source
4. Click **Import**

### Useful Grafana Queries

| Metric | Query |
|--------|-------|
| Active guests | `captive_portal_guests_active` |
| Auth success rate (5m) | `rate(captive_portal_auth_success_total[5m])` |
| Auth failure rate (5m) | `rate(captive_portal_auth_fail_total[5m])` |
| Success percentage | `100 * captive_portal_auth_success_total / (captive_portal_auth_success_total + captive_portal_auth_fail_total)` |
| Devices per user | `captive_portal_devices_total / captive_portal_guests_unique_users` |
| Expiring soon alert | `captive_portal_guests_expiring_soon > 10` |

## Alerting Rules

Create `alerts.yml` for Prometheus alerting:

```yaml
groups:
  - name: captive_portal_alerts
    interval: 60s
    rules:
      # High authentication failure rate
      - alert: HighAuthFailureRate
        expr: rate(captive_portal_auth_fail_total[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High authentication failure rate"
          description: "Authentication failures are at {{ $value }} per second (threshold: 0.1/s)"

      # No active guests (unexpected if usually busy)
      - alert: NoActiveGuests
        expr: captive_portal_guests_active == 0
        for: 30m
        labels:
          severity: info
        annotations:
          summary: "No active guest authorizations"
          description: "No guests have been authorized for 30 minutes"

      # Many guests expiring soon
      - alert: ManyGuestsExpiringSoon
        expr: captive_portal_guests_expiring_soon > 10
        for: 1h
        labels:
          severity: info
        annotations:
          summary: "{{ $value }} guests expiring within 24 hours"
          description: "Many guests will need to re-authenticate soon"

      # Service health check failing
      - alert: HealthCheckFailing
        expr: up{job="captive-portal"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Captive portal is down"
          description: "Prometheus cannot scrape metrics from the captive portal"

      # Admin revocations spike
      - alert: UnusualRevocationActivity
        expr: rate(captive_portal_revocations_24h[1h]) > 5
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Unusual guest revocation activity"
          description: "{{ $value }} revocations per hour (threshold: 5/hour)"
```

### Alertmanager Setup

If you want email/Slack alerts, configure Alertmanager:

**alertmanager.yml:**
```yaml
global:
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alertmanager@example.com'
  smtp_auth_username: 'your-email@gmail.com'
  smtp_auth_password: 'your-app-password'

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'email-admin'

receivers:
  - name: 'email-admin'
    email_configs:
      - to: 'admin@example.com'
        headers:
          Subject: 'Captive Portal Alert: {{ .GroupLabels.alertname }}'
```

## Health Checks

The portal provides a health check endpoint at `GET /api/health`.

### Manual Check

```bash
curl http://localhost:3000/api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-19T10:00:00.000Z",
  "checks": {
    "database": { "status": "healthy" },
    "unifi": { "status": "healthy" },
    "email": { "status": "healthy" }
  }
}
```

### External Monitoring with UptimeRobot

1. Sign up at https://uptimerobot.com (free tier available)
2. Add monitor:
   - **Type:** HTTP(s)
   - **URL:** `https://portal.example.com/api/health`
   - **Interval:** 5 minutes
   - **Alert contacts:** Email/SMS/Slack
3. Configure keyword monitoring:
   - **Keyword:** `"status":"healthy"`
   - **Alert if not found:** Yes

### Healthchecks.io Integration

For cron job monitoring (backup jobs, sync jobs):

```bash
# In your cron script
curl -fsS --retry 3 https://hc-ping.com/YOUR-UUID-HERE || echo "Health check failed"
```

**Example backup script with health check:**
```bash
#!/bin/bash
# Daily backup with health check notification
pnpm db:backup && curl -fsS https://hc-ping.com/backup-job-uuid
```

## Log Aggregation

For production environments, consider centralized logging:

### Option 1: Loki + Grafana (Recommended)

**docker-compose.monitoring.yml addition:**
```yaml
  loki:
    image: grafana/loki:latest
    ports:
      - "3100:3100"
    volumes:
      - ./loki-config.yml:/etc/loki/local-config.yaml
    command: -config.file=/etc/loki/local-config.yaml

  promtail:
    image: grafana/promtail:latest
    volumes:
      - /var/log:/var/log:ro
      - ./promtail-config.yml:/etc/promtail/config.yml
    command: -config.file=/etc/promtail/config.yml
```

### Option 2: JSON Logs to File

Configure the portal to output structured logs:

```bash
# In production .env
NODE_ENV=production
LOG_LEVEL=info
LOG_FORMAT=json
```

**View logs:**
```bash
# Follow JSON logs
docker logs -f captive-portal | jq

# Filter for errors
docker logs captive-portal 2>&1 | jq 'select(.level == "error")'

# Count events by type
docker logs captive-portal 2>&1 | jq -r '.eventType' | sort | uniq -c
```

## Best Practices

### Retention Policies

- **Prometheus:** 30 days of metrics data (configurable via `--storage.tsdb.retention.time`)
- **Database backups:** 30 days (see `scripts/backup-database.ts`)
- **Activity logs:** Keep forever (audit trail), or implement archival after 1 year

### Monitoring Checklist

- [ ] Prometheus scraping successfully (check `/api/metrics/prometheus`)
- [ ] Grafana dashboard displaying metrics
- [ ] Alert rules configured in Prometheus
- [ ] Email/Slack alerts working (test with Alertmanager)
- [ ] Health check endpoint responding (`/api/health`)
- [ ] External uptime monitoring configured (UptimeRobot/Healthchecks.io)
- [ ] Backup job monitoring enabled
- [ ] Log aggregation configured (optional but recommended)

### Alert Severity Guidelines

| Severity | Response Time | Examples |
|----------|---------------|----------|
| **Critical** | Immediate | Portal down, database unreachable, Unifi connection failed |
| **Warning** | Within 1 hour | High auth failure rate, unusual revocation activity |
| **Info** | Next business day | Many guests expiring soon, no active guests (if unusual) |

### Grafana Dashboard Tips

1. **Create multiple dashboards:**
   - **Overview:** High-level metrics for daily monitoring
   - **Troubleshooting:** Detailed metrics for investigating issues
   - **Capacity Planning:** Trends over time for capacity decisions

2. **Use annotations:** Mark deployments, incidents, maintenance windows

3. **Set up variables:** Allow filtering by time range, environment

4. **Configure refresh interval:** Auto-refresh every 30s for real-time monitoring

### Security Considerations

- **Protect metrics endpoints:** Consider adding basic auth or IP whitelisting
- **Secure Grafana:** Change default admin password, disable sign-up
- **Firewall rules:** Only expose Prometheus/Grafana to admin network
- **HTTPS:** Use reverse proxy (Caddy/Nginx) for encrypted metrics scraping

### Cost Optimization

- **Reduce scrape frequency:** 60s instead of 30s if you don't need real-time data
- **Use recording rules:** Pre-compute expensive queries in Prometheus
- **Archive old data:** Move metrics older than 30 days to cold storage
- **Right-size retention:** 7-14 days may be sufficient for most home networks

## Troubleshooting

### Prometheus not scraping

1. Check targets: http://localhost:9090/targets
2. Verify endpoint responds: `curl http://localhost:3000/api/metrics/prometheus`
3. Check Docker networking: `docker inspect captive-portal-prometheus`
4. Review Prometheus logs: `docker logs captive-portal-prometheus`

### Grafana not showing data

1. Verify data source connection (Configuration → Data Sources → Test)
2. Check query syntax in panel editor
3. Verify time range matches available data
4. Check Grafana logs: `docker logs captive-portal-grafana`

### Alerts not firing

1. Verify alert rules loaded: http://localhost:9090/rules
2. Check alert evaluation: http://localhost:9090/alerts
3. Verify Alertmanager connection: http://localhost:9090/status
4. Test Alertmanager config: `docker logs captive-portal-alertmanager`

## Further Reading

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Alertmanager Configuration](https://prometheus.io/docs/alerting/latest/configuration/)
- [PromQL Basics](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Grafana Best Practices](https://grafana.com/docs/grafana/latest/best-practices/)
