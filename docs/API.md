# World Wide Webb API Documentation

## Overview

The World Wide Webb captive portal provides a RESTful API for guest authentication and admin management.

**Base URL**: `http://localhost:3000` (development) or your production domain

**OpenAPI Spec**: See [`API.yaml`](./API.yaml) for full OpenAPI 3.0 specification

## Authentication

The API uses three authentication methods depending on the endpoint:

| Endpoint Type | Authentication | Cookie Name |
|--------------|----------------|-------------|
| Guest Auth (`/api/guest/*`) | None (public) | N/A |
| Guest Portal (`/api/portal/*`) | Better Auth session | `better-auth.session_token` |
| Admin Panel (`/api/admin/*`) | Better Auth session + Admin role + TOTP | `better-auth.session_token` |
| System (`/api/health`, `/api/metrics`) | None (public) | N/A |

### Session Management

Better Auth sessions are managed via HttpOnly, Secure cookies automatically set by the authentication endpoints.

**Session Lifetime**: 7 days (configurable in `lib/auth.ts`)

## Rate Limiting

Rate limits are enforced to prevent abuse:

| Endpoint | Limit | Reset Window |
|----------|-------|--------------|
| `POST /api/guest/verify-email` | 5 per email | 1 hour |
| `POST /api/guest/resend-code` | 3 per email | 1 hour |
| `POST /api/guest/resend-code` | 1 per 30 seconds | 30 seconds (cooldown) |
| `POST /api/guest/verify-code` | 3 attempts per code | N/A (code invalidated) |

When rate limited, the API returns:
- **Status**: `429 Too Many Requests`
- **Response**:
  ```json
  {
    "error": "Too many requests. Please try again in 45 minutes.",
    "code": "RATE_LIMIT_EXCEEDED",
    "retryAfter": 2700
  }
  ```

**`retryAfter`**: Seconds until the rate limit resets

## Error Codes

All error responses follow this format:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {
    "optional": "additional context"
  }
}
```

### Standard HTTP Status Codes

| Status | Meaning | Common Causes |
|--------|---------|---------------|
| `400` | Bad Request | Invalid input, validation error, malformed JSON |
| `401` | Unauthorized | Not authenticated, session expired |
| `403` | Forbidden | Insufficient permissions (not admin, TOTP not set up) |
| `404` | Not Found | Resource doesn't exist |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Unexpected server error |
| `503` | Service Unavailable | External service down (Unifi, email) |

### Application Error Codes

| Error Code | HTTP Status | Meaning | Recovery Action |
|------------|-------------|---------|-----------------|
| `VALIDATION_ERROR` | 400 | Invalid input data | Check request schema, fix input |
| `INVALID_CODE` | 400 | Verification code wrong or expired | Request new code |
| `TOO_MANY_ATTEMPTS` | 400 | Exceeded 3 code verification attempts | Request new code |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests | Wait for `retryAfter` seconds |
| `COOLDOWN_ACTIVE` | 429 | Resend cooldown active | Wait 30 seconds |
| `UNIFI_UNAVAILABLE` | 503 | Unifi Controller unreachable | Check network, contact admin |
| `AUTH_REQUIRED` | 401 | Session missing or expired | Login again |
| `ADMIN_REQUIRED` | 403 | Admin role required | Use admin account |
| `TOTP_REQUIRED` | 403 | TOTP 2FA not configured | Complete TOTP setup |

## Guest Authentication Flow

### 1. Send Verification Email

**Endpoint**: `POST /api/guest/verify-email`

**Rate Limit**: 5 requests per hour per email

**Request**:
```bash
curl -X POST http://localhost:3000/api/guest/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "name": "John Doe",
    "macAddress": "aabbccddeeff"
  }'
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Verification code sent to john.doe@example.com",
  "expiresIn": 600
}
```

**Errors**:
- `400`: Invalid email or name
- `429`: Rate limit exceeded (5/hour)

**Notes**:
- `macAddress` is optional (auto-detected from captive portal URL)
- `name` is XSS sanitized before storage
- Code expires in 10 minutes (600 seconds)

### 2. Verify Code

**Endpoint**: `POST /api/guest/verify-code`

**Rate Limit**: 3 attempts per code

**Request**:
```bash
curl -X POST http://localhost:3000/api/guest/verify-code \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "code": "123456"
  }'
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Device authorized successfully",
  "expiresAt": "2026-01-26T10:30:00.000Z",
  "guestId": 42,
  "userId": "cm4v8x9y0000008l2b3c4d5e6"
}
```

**Errors**:
- `400`: Invalid or expired code
- `400`: Too many attempts (code invalidated after 3 failures)
- `503`: Unifi Controller unavailable (fail-fast mode)

**Side Effects**:
1. Creates Better Auth user (if new email)
2. Authorizes MAC on Unifi Controller (7-day access)
3. Creates guest record in database
4. Sends admin notification email
5. Logs `auth_success` event

**Offline Mode** (`ALLOW_OFFLINE_AUTH=true`):
- If Unifi fails, returns 200 with warning (development only)
- Production should use `ALLOW_OFFLINE_AUTH=false` for fail-fast

### 3. Resend Code

**Endpoint**: `POST /api/guest/resend-code`

**Rate Limits**:
- 30 second cooldown between resends
- 3 resends per hour

**Request**:
```bash
curl -X POST http://localhost:3000/api/guest/resend-code \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com"
  }'
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Verification code resent",
  "expiresIn": 600
}
```

**Errors**:
- `400`: No pending verification found
- `429`: Cooldown active (wait 30 seconds)
- `429`: Rate limit exceeded (3/hour)

**Notes**:
- Generates new code (invalidates old one)
- Resets attempt counter
- Logs `code_resent` event

### 4. Check Authorization Status

**Endpoint**: `GET /api/guest/status?mac=aabbccddeeff`

**Request**:
```bash
curl http://localhost:3000/api/guest/status?mac=aabbccddeeff
```

**Response** (200 OK):
```json
{
  "authorized": true,
  "expiresAt": "2026-01-26T10:30:00.000Z",
  "authorizedAt": "2026-01-19T10:30:00.000Z",
  "user": {
    "name": "John Doe",
    "email": "john.doe@example.com"
  }
}
```

**Response** (unauthorized):
```json
{
  "authorized": false
}
```

**Errors**:
- `400`: Invalid MAC address format

**Use Case**: Captive portal checks if returning guest is still authorized

## Guest Portal (Authenticated Users)

### List User's Devices

**Endpoint**: `GET /api/portal/devices`

**Auth**: Requires guest session cookie

**Request**:
```bash
curl http://localhost:3000/api/portal/devices \
  -H "Cookie: better-auth.session_token=YOUR_SESSION_TOKEN"
```

**Response** (200 OK):
```json
{
  "devices": [
    {
      "id": 42,
      "macAddress": "aa:bb:cc:dd:ee:ff",
      "ipAddress": "192.168.1.100",
      "nickname": "iPhone 15 Pro",
      "deviceInfo": "Apple iPhone",
      "authorizedAt": "2026-01-19T10:30:00.000Z",
      "expiresAt": "2026-01-26T10:30:00.000Z",
      "lastSeen": "2026-01-19T12:45:00.000Z",
      "authCount": 3,
      "isOnline": true,
      "isExpired": false,
      "signalStrength": -45
    }
  ],
  "stats": {
    "total": 5,
    "active": 3,
    "online": 2,
    "expired": 2
  }
}
```

**Errors**:
- `401`: Not authenticated

**Notes**:
- Shows all devices (MACs) authorized for the logged-in user
- `isOnline` and `signalStrength` from Unifi (if available)

### Update Device Nickname

**Endpoint**: `PATCH /api/portal/devices/{id}`

**Auth**: Requires guest session cookie + ownership

**Request**:
```bash
curl -X PATCH http://localhost:3000/api/portal/devices/42 \
  -H "Cookie: better-auth.session_token=YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nickname": "My iPhone"
  }'
```

**Response** (200 OK):
```json
{
  "success": true,
  "device": {
    "id": 42,
    "macAddress": "aa:bb:cc:dd:ee:ff",
    "nickname": "My iPhone",
    ...
  }
}
```

**Errors**:
- `401`: Not authenticated
- `403`: Device does not belong to user
- `404`: Device not found

## Admin Panel (Admin Users)

### List All Guests

**Endpoint**: `GET /api/admin/guests`

**Auth**: Requires admin session + TOTP 2FA

**Query Parameters**:
- `page` (default: 1): Page number
- `limit` (default: 20, max: 100): Results per page
- `search`: Search by name, email, or MAC
- `status` (default: all): Filter by `all`, `active`, or `expired`

**Request**:
```bash
curl "http://localhost:3000/api/admin/guests?page=1&limit=20&status=active" \
  -H "Cookie: better-auth.session_token=ADMIN_SESSION_TOKEN"
```

**Response** (200 OK):
```json
{
  "guests": [
    {
      "id": 42,
      "mac": "aa:bb:cc:dd:ee:ff",
      "ip": "192.168.1.100",
      "device": "Apple iPhone",
      "nickname": "John's iPhone",
      "authorizedAt": "2026-01-19T10:30:00.000Z",
      "expiresAt": "2026-01-26T10:30:00.000Z",
      "lastSeen": "2026-01-19T12:45:00.000Z",
      "authCount": 2,
      "isActive": true,
      "isOnline": true,
      "user": {
        "id": "cm4v8x9y0000008l2b3c4d5e6",
        "name": "John Doe",
        "email": "john.doe@example.com"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 47,
    "totalPages": 3
  }
}
```

**Errors**:
- `401`: Not authenticated
- `403`: Not admin or TOTP not configured

### Extend Guest Access

**Endpoint**: `POST /api/admin/guests/extend`

**Auth**: Requires admin session + TOTP 2FA

**Request**:
```bash
curl -X POST http://localhost:3000/api/admin/guests/extend \
  -H "Cookie: better-auth.session_token=ADMIN_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "guestIds": [1, 2, 3],
    "days": 7
  }'
```

**Response** (200 OK):
```json
{
  "success": true,
  "extended": 2,
  "failed": 1,
  "errors": [
    "Failed to extend guest 3: Unifi authorization failed"
  ]
}
```

**Request Schema**:
- `guestIds`: Array of guest IDs (required, min 1)
- `days`: Number of days to extend (default: 7, min: 1, max: 30)

**Side Effects**:
1. Updates Unifi authorization expiry
2. Updates database `expiresAt` field
3. Logs `admin_extend` event per guest

### Revoke Guest Access

**Endpoint**: `POST /api/admin/guests/revoke`

**Auth**: Requires admin session + TOTP 2FA

**Request**:
```bash
curl -X POST http://localhost:3000/api/admin/guests/revoke \
  -H "Cookie: better-auth.session_token=ADMIN_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "guestIds": [1, 2, 3]
  }'
```

**Response** (200 OK):
```json
{
  "success": true,
  "revoked": 2,
  "failed": 1,
  "errors": [
    "Failed to revoke guest 3: Unifi operation failed"
  ]
}
```

**Side Effects**:
1. Unauthorizes MAC on Unifi
2. Kicks device from network (if online)
3. Sets `expiresAt` to now in database
4. Logs `admin_revoke` event per guest

### List Network Devices

**Endpoint**: `GET /api/admin/devices`

**Auth**: Requires admin session + TOTP 2FA

**Request**:
```bash
curl http://localhost:3000/api/admin/devices \
  -H "Cookie: better-auth.session_token=ADMIN_SESSION_TOKEN"
```

**Response** (200 OK):
```json
{
  "devices": [
    {
      "mac": "aa:bb:cc:dd:ee:ff",
      "name": "John's iPhone",
      "ip": "192.168.1.100",
      "signalStrength": -45,
      "lastSeen": "2026-01-19T12:45:00.000Z",
      "authorized": true
    }
  ],
  "total": 15
}
```

**Notes**:
- Combines Unifi active clients + database guests
- Falls back to database if Unifi unavailable

### Real-time Network Status

**Endpoint**: `GET /api/admin/network/status`

**Auth**: Requires admin session + TOTP 2FA

**Request**:
```bash
curl http://localhost:3000/api/admin/network/status \
  -H "Cookie: better-auth.session_token=ADMIN_SESSION_TOKEN"
```

**Response** (200 OK):
```json
{
  "clients": [
    {
      "mac": "aa:bb:cc:dd:ee:ff",
      "name": "iPhone-Pro",
      "ip": "192.168.1.100",
      "hostname": "iphone-pro.local",
      "signalStrength": -45,
      "rssi": -45,
      "noise": -95,
      "txRate": 866,
      "rxRate": 866,
      "txBytes": 1234567890,
      "rxBytes": 9876543210,
      "uptime": 3600,
      "lastSeen": "2026-01-19T12:45:00.000Z",
      "firstSeen": "2026-01-19T10:30:00.000Z",
      "isAuthorized": true,
      "isGuest": true,
      "isWired": false,
      "channel": 36,
      "radio": "na",
      "essid": "Guest WiFi",
      "apMac": "ff:ee:dd:cc:bb:aa",
      "guest": {
        "userId": "cm4v8x9y0000008l2b3c4d5e6",
        "userName": "John Doe",
        "userEmail": "john.doe@example.com",
        "expiresAt": "2026-01-26T10:30:00.000Z",
        "nickname": "John's iPhone"
      }
    }
  ],
  "stats": {
    "total": 20,
    "guests": 5,
    "wired": 8,
    "wireless": 12,
    "authorized": 5
  },
  "unifiConnected": true,
  "timestamp": "2026-01-19T13:00:00.000Z"
}
```

**Notes**:
- Sorted by: authorized guests first, then signal strength descending
- Rich client data from Unifi (bandwidth, uptime, RSSI, etc.)
- Guest info joined from database

### Get DPI Statistics

**Endpoint**: `GET /api/admin/dpi?mac=aabbccddeeff`

**Auth**: Requires admin session + TOTP 2FA

**Request**:
```bash
curl "http://localhost:3000/api/admin/dpi?mac=aabbccddeeff" \
  -H "Cookie: better-auth.session_token=ADMIN_SESSION_TOKEN"
```

**Response** (200 OK):
```json
{
  "mac": "aa:bb:cc:dd:ee:ff",
  "categories": [
    {
      "id": 4,
      "name": "Video Streaming",
      "rxBytes": 1234567890,
      "txBytes": 123456789,
      "rxFormatted": "1.15 GB",
      "txFormatted": "117.74 MB",
      "totalBytes": 1358024679,
      "totalFormatted": "1.26 GB"
    }
  ],
  "applications": [
    {
      "id": 5000,
      "categoryId": 4,
      "categoryName": "Video Streaming",
      "rxBytes": 800000000,
      "txBytes": 50000000,
      "rxFormatted": "762.94 MB",
      "txFormatted": "47.68 MB",
      "totalBytes": 850000000,
      "totalFormatted": "810.62 MB"
    }
  ],
  "totalRx": "5.2 GB",
  "totalTx": "1.8 GB",
  "totalRxBytes": 5581619200,
  "totalTxBytes": 1932735283,
  "available": true
}
```

**Notes**:
- DPI data from Unifi Controller (requires DPI enabled)
- Applications sorted by total bandwidth (top 20)
- `available: false` if DPI not enabled or no data

**Errors**:
- `400`: Invalid MAC address

### Dashboard Statistics

**Endpoint**: `GET /api/admin/stats`

**Auth**: Requires admin session + TOTP 2FA

**Request**:
```bash
curl http://localhost:3000/api/admin/stats \
  -H "Cookie: better-auth.session_token=ADMIN_SESSION_TOKEN"
```

**Response** (200 OK):
```json
{
  "activeGuests": 12,
  "totalAuthorized": 47,
  "expiringToday": 3,
  "totalBandwidth": "2.5 GB"
}
```

**Metrics**:
- `activeGuests`: Not expired authorizations
- `totalAuthorized`: All-time authorizations
- `expiringToday`: Expiring in next 24 hours
- `totalBandwidth`: Last 24 hours (from `network_stats` table)

### Activity Log

**Endpoint**: `GET /api/admin/activity`

**Auth**: Requires admin session + TOTP 2FA

**Query Parameters**:
- `page` (default: 1): Page number
- `limit` (default: 20, max: 100): Results per page
- `type`: Filter by event type (see Event Types below)
- `search`: Search by name, email, MAC, or IP
- `startDate`: Start of date range (ISO 8601)
- `endDate`: End of date range (ISO 8601)

**Event Types**:
- `connect`: Guest device connected
- `disconnect`: Guest device disconnected
- `auth_success`: Successful verification
- `auth_fail`: Failed verification attempt
- `admin_revoke`: Admin revoked access
- `admin_extend`: Admin extended access
- `code_sent`: Verification code sent
- `code_resent`: Verification code resent
- `admin_login`: Admin logged in
- `admin_logout`: Admin logged out

**Request**:
```bash
curl "http://localhost:3000/api/admin/activity?page=1&type=auth_success" \
  -H "Cookie: better-auth.session_token=ADMIN_SESSION_TOKEN"
```

**Response** (200 OK):
```json
{
  "events": [
    {
      "id": 123,
      "type": "auth_success",
      "description": "John Doe successfully authenticated",
      "timestamp": "2026-01-19T10:30:00.000Z",
      "user": "John Doe",
      "userEmail": "john.doe@example.com",
      "mac": "aa:bb:cc:dd:ee:ff",
      "ip": "192.168.1.100",
      "details": {
        "duration": "7 days"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 245,
    "totalPages": 13
  }
}
```

### Dashboard Alerts

**Endpoint**: `GET /api/admin/alerts`

**Auth**: Requires admin session + TOTP 2FA

**Request**:
```bash
curl http://localhost:3000/api/admin/alerts \
  -H "Cookie: better-auth.session_token=ADMIN_SESSION_TOKEN"
```

**Response** (200 OK):
```json
{
  "alerts": [
    {
      "id": "expiring-42",
      "type": "expiring",
      "severity": "warning",
      "title": "Guest Expiring Soon",
      "message": "John Doe's access expires in 4 hours",
      "timestamp": "2026-01-19T10:30:00.000Z",
      "link": "/admin/guests?search=john.doe@example.com"
    }
  ],
  "summary": {
    "total": 5,
    "critical": 1,
    "warning": 3,
    "info": 1
  }
}
```

**Alert Types**:
- `expiring`: Guest expiring in 24 hours (severity: warning)
- `failed_auth`: Failed auth attempts in last hour (severity: warning)
- `new_guest`: New guest authorized today (severity: info)
- `high_bandwidth`: Device exceeding bandwidth threshold (severity: critical)

## System Endpoints

### Health Check

**Endpoint**: `GET /api/health`

**Auth**: None (public)

**Request**:
```bash
curl http://localhost:3000/api/health
```

**Response** (200 OK - Healthy):
```json
{
  "status": "healthy",
  "timestamp": "2026-01-19T10:30:00.000Z",
  "checks": {
    "database": {
      "status": "pass",
      "latencyMs": 2
    },
    "unifi": {
      "status": "pass",
      "latencyMs": 45
    },
    "email": {
      "status": "pass",
      "latencyMs": 120
    }
  },
  "version": "1.0.0"
}
```

**Response** (200 OK - Degraded):
```json
{
  "status": "degraded",
  "timestamp": "2026-01-19T10:30:00.000Z",
  "checks": {
    "database": {
      "status": "pass",
      "latencyMs": 3
    },
    "unifi": {
      "status": "fail",
      "message": "Connection timeout"
    },
    "email": {
      "status": "pass",
      "latencyMs": 110
    }
  },
  "version": "1.0.0"
}
```

**Response** (503 Service Unavailable - Unhealthy):
```json
{
  "status": "unhealthy",
  "timestamp": "2026-01-19T10:30:00.000Z",
  "checks": {
    "database": {
      "status": "fail",
      "message": "Connection refused"
    },
    "unifi": {
      "status": "fail",
      "message": "Unreachable"
    },
    "email": {
      "status": "pass",
      "latencyMs": 95
    }
  },
  "version": "1.0.0"
}
```

**Status Definitions**:
- `healthy`: All checks passed
- `degraded`: Some non-critical checks failed (email or Unifi)
- `unhealthy`: Critical checks failed (database)

**Use Cases**:
- Load balancer health checks
- Monitoring systems (UptimeRobot, Healthchecks.io)
- Deployment verification

### System Metrics (JSON)

**Endpoint**: `GET /api/metrics`

**Auth**: None (public)

**Request**:
```bash
curl http://localhost:3000/api/metrics
```

**Response** (200 OK):
```json
{
  "timestamp": "2026-01-19T10:30:00.000Z",
  "guests": {
    "total": 47,
    "activeAuthorizations": 12,
    "expiredAuthorizations": 35,
    "expiringSoon": 3,
    "uniqueUsers": 28
  },
  "authentication": {
    "successfulAuths": 8,
    "failedAuths": 2,
    "pendingVerifications": 3
  },
  "admin": {
    "totalAdmins": 2,
    "revocationsLast24h": 1
  },
  "devices": {
    "totalDevices": 47,
    "activeDevices": 12
  }
}
```

**Use Cases**:
- Custom monitoring dashboards
- Alerting systems
- Analytics integration

### Prometheus Metrics

**Endpoint**: `GET /api/metrics/prometheus`

**Auth**: None (public)

**Content-Type**: `text/plain; version=0.0.4; charset=utf-8`

**Request**:
```bash
curl http://localhost:3000/api/metrics/prometheus
```

**Response** (200 OK):
```
# HELP captive_portal_guests_total Total number of guest authorizations
# TYPE captive_portal_guests_total counter
captive_portal_guests_total 47

# HELP captive_portal_guests_active Number of active (not expired) guest authorizations
# TYPE captive_portal_guests_active gauge
captive_portal_guests_active 12

# HELP captive_portal_guests_expired Number of expired guest authorizations
# TYPE captive_portal_guests_expired gauge
captive_portal_guests_expired 35

# HELP captive_portal_guests_expiring_soon Guests expiring in next 24 hours
# TYPE captive_portal_guests_expiring_soon gauge
captive_portal_guests_expiring_soon 3

# HELP captive_portal_guests_unique_users Number of unique guest users (email addresses)
# TYPE captive_portal_guests_unique_users gauge
captive_portal_guests_unique_users 28

# HELP captive_portal_auth_success_total Successful authentication attempts in last 24 hours
# TYPE captive_portal_auth_success_total counter
captive_portal_auth_success_total 8

# HELP captive_portal_auth_fail_total Failed authentication attempts in last 24 hours
# TYPE captive_portal_auth_fail_total counter
captive_portal_auth_fail_total 2

# HELP captive_portal_verifications_pending Active verification codes awaiting verification
# TYPE captive_portal_verifications_pending gauge
captive_portal_verifications_pending 3

# HELP captive_portal_admins_total Total number of admin users
# TYPE captive_portal_admins_total gauge
captive_portal_admins_total 2

# HELP captive_portal_revocations_24h Number of guest revocations in last 24 hours
# TYPE captive_portal_revocations_24h counter
captive_portal_revocations_24h 1

# HELP captive_portal_devices_total Total number of devices in database
# TYPE captive_portal_devices_total counter
captive_portal_devices_total 47

# HELP captive_portal_devices_active Number of active (authorized) devices
# TYPE captive_portal_devices_active gauge
captive_portal_devices_active 12
```

**Prometheus Setup**:

Add this scrape config to `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'captive-portal'
    scrape_interval: 30s
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/api/metrics/prometheus'
```

See [`MONITORING.md`](./MONITORING.md) for full Prometheus + Grafana setup guide.

## Integration Examples

### JavaScript/TypeScript (fetch)

```typescript
// Guest verification flow
async function verifyGuest(email: string, name: string, macAddress?: string) {
  // Step 1: Send verification code
  const verifyEmailRes = await fetch('/api/guest/verify-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name, macAddress })
  });

  if (!verifyEmailRes.ok) {
    const error = await verifyEmailRes.json();
    throw new Error(error.error);
  }

  const { expiresIn } = await verifyEmailRes.json();
  console.log(`Code sent, expires in ${expiresIn} seconds`);

  // Step 2: User enters code (from email)
  const code = prompt('Enter 6-digit code from email:');

  // Step 3: Verify code
  const verifyCodeRes = await fetch('/api/guest/verify-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code })
  });

  if (!verifyCodeRes.ok) {
    const error = await verifyCodeRes.json();
    throw new Error(error.error);
  }

  const { expiresAt, guestId } = await verifyCodeRes.json();
  console.log(`Authorized until ${expiresAt}, guest ID: ${guestId}`);
}
```

### Python (requests)

```python
import requests

def check_guest_status(mac: str) -> dict:
    """Check if MAC address is authorized"""
    response = requests.get(
        'http://localhost:3000/api/guest/status',
        params={'mac': mac}
    )
    response.raise_for_status()
    return response.json()

def extend_guest_access(session_token: str, guest_ids: list[int], days: int = 7):
    """Extend guest access (admin only)"""
    response = requests.post(
        'http://localhost:3000/api/admin/guests/extend',
        json={'guestIds': guest_ids, 'days': days},
        cookies={'better-auth.session_token': session_token}
    )
    response.raise_for_status()
    result = response.json()
    print(f"Extended {result['extended']} guests, {result['failed']} failed")
    return result
```

### curl Scripts

**Check Health**:
```bash
#!/bin/bash
curl -s http://localhost:3000/api/health | jq .
```

**Admin: List Active Guests**:
```bash
#!/bin/bash
SESSION_TOKEN="your-admin-session-token"
curl -s "http://localhost:3000/api/admin/guests?status=active" \
  -H "Cookie: better-auth.session_token=$SESSION_TOKEN" | jq .
```

**Admin: Revoke Guest**:
```bash
#!/bin/bash
SESSION_TOKEN="your-admin-session-token"
GUEST_ID=42

curl -X POST "http://localhost:3000/api/admin/guests/revoke" \
  -H "Cookie: better-auth.session_token=$SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"guestIds\": [$GUEST_ID]}" | jq .
```

## Testing

The API includes comprehensive test coverage:

**Unit Tests** (Vitest):
```bash
pnpm test
```

**E2E Tests** (Playwright):
```bash
pnpm test:e2e
```

See [`e2e/README.md`](../e2e/README.md) for E2E test documentation.

## Related Documentation

- [OpenAPI Specification](./API.yaml) - Machine-readable API spec
- [Deployment Guide](../DEPLOYMENT.md) - Production setup
- [Monitoring Guide](./MONITORING.md) - Prometheus + Grafana setup
- [Backup Guide](../scripts/BACKUP_README.md) - Database backup procedures
- [E2E Testing](../e2e/README.md) - End-to-end test documentation

## Support

For issues or questions:
- GitHub Issues: [github.com/yourusername/world-wide-webb/issues](https://github.com/anthropics/claude-code/issues)
- Documentation: [Project README](../README.md)
