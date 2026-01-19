# Technical Specifications - World Wide Webb Captive Portal

**Document Version:** 1.0
**Last Updated:** 2026-01-18
**Project:** World Wide Webb Guest WiFi Captive Portal
**Status:** Ready for Implementation

---

## 1. System Architecture

### 1.1 High-Level Architecture

```
[WiFi Guest Network]
    ↓ (Captive Portal Redirect)
[Next.js Portal Application]
    ↓ (APIs)
[Better Auth] ← [SQLite Database]
    ↓ (Device Authorization)
[Unifi Controller API]
    ↓ (Network Access)
[Guest VLAN Network Access]
```

### 1.2 Component Breakdown

**Frontend:**
- Guest Portal: Landing, verification, success screens (public routes)
- Guest Dashboard: Self-service portal (protected guest routes)
- Admin Panel: Authentication, dashboard, management (protected admin routes)

**Backend:**
- API Routes: Guest auth, admin operations, Unifi integration
- Database: SQLite with Drizzle ORM for guest/session management
- Authentication: Better Auth for unified guest+admin auth
- Integration: Unifi Controller API client for network control

**Infrastructure:**
- Next.js 14 App Router with TypeScript
- Tailwind CSS for dark mode UI (black background)
- shadcn/ui for component library
- Docker for containerization and development

### 1.3 Data Flow Examples

**Guest Authentication Flow:**
1. Guest connects to WiFi → Unifi redirects to portal with MAC
2. User enters email → Portal validates → API sends 2FA code
3. User enters code → API verifies → Creates Better Auth user
4. Better Auth session created → Unifi authorization called
5. Guest record saved → Activity logged → Success page shown

**Admin Session Flow:**
1. Admin enters email+password → Better Auth validates
2. Better Auth checks twoFactorEnabled flag
3. If false → Redirect to setup-2fa (forced setup)
4. Admin scans QR code → Generates TOTP secret
5. Admin enters 6-digit code → Better Auth validates TOTP
6. Backup codes generated → Session marked with TOTP verified
7. Access granted to /admin routes

---

## 2. Database Specifications

### 2.1 Schema Design

**Note:** All tables use Better Auth conventions where applicable. Drizzle ORM handles schema definition with migrations.

#### User Table (Better Auth)
```
id: TEXT PRIMARY KEY
email: TEXT UNIQUE NOT NULL
emailVerified: BOOLEAN DEFAULT 0
name: TEXT
password: TEXT (NULL for guests)
role: TEXT NOT NULL ('guest' | 'admin')
twoFactorEnabled: BOOLEAN DEFAULT 0
twoFactorSecret: TEXT (admin TOTP secret)
createdAt: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updatedAt: TIMESTAMP DEFAULT CURRENT_TIMESTAMP

INDEXES:
- email (for auth lookup)
- role (for guest/admin filtering)
```

**Constraints:**
- Admin must have password + role='admin'
- Guests have NULL password + role='guest'
- email field must be unique and valid
- TOTP secret only populated if twoFactorEnabled=true

#### Session Table (Better Auth)
```
id: TEXT PRIMARY KEY
userId: TEXT NOT NULL FOREIGN KEY
expiresAt: TIMESTAMP NOT NULL
ipAddress: TEXT
userAgent: TEXT
createdAt: TIMESTAMP DEFAULT CURRENT_TIMESTAMP

INDEXES:
- userId (for user's sessions)
- expiresAt (for cleanup queries)
```

**Constraints:**
- Foreign key to user.id with CASCADE delete
- expiresAt must be in future on creation
- Session is invalid if expiresAt < NOW()

#### Backup Codes Table (Better Auth TOTP Plugin)
```
id: INTEGER PRIMARY KEY AUTOINCREMENT
userId: TEXT NOT NULL FOREIGN KEY
code: TEXT NOT NULL
used: BOOLEAN DEFAULT 0
createdAt: TIMESTAMP DEFAULT CURRENT_TIMESTAMP

INDEXES:
- userId (for finding unused codes)
```

**Constraints:**
- Foreign key to user.id with CASCADE delete
- Each code can be used at most once
- 10 backup codes generated per admin user on TOTP setup

#### Guests Table (Custom)
```
id: INTEGER PRIMARY KEY AUTOINCREMENT
userId: TEXT NOT NULL FOREIGN KEY
macAddress: TEXT NOT NULL
ipAddress: TEXT
deviceInfo: TEXT (user agent, device type)
authorizedAt: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
expiresAt: TIMESTAMP NOT NULL
lastSeen: TIMESTAMP
authCount: INTEGER DEFAULT 1
createdAt: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updatedAt: TIMESTAMP DEFAULT CURRENT_TIMESTAMP

INDEXES:
- userId, macAddress (composite for guest device lookup)
- macAddress (for MAC-based lookups)
- expiresAt (for expiry checks and cleanup)
- lastSeen (for stale device detection)
```

**Constraints:**
- Foreign key to user.id with CASCADE delete
- macAddress is case-insensitive (store uppercase: AA:BB:CC:DD:EE:FF)
- expiresAt is typically authorizedAt + 604800 seconds (7 days)
- Same email can have multiple MACs (devices)
- One MAC can only be authorized to one user at a time
- authCount increments each time guest re-verifies

**Uniqueness:**
- No UNIQUE constraint on macAddress (allows re-authorization with same MAC after expiry)

#### Verification Codes Table (Custom)
```
id: INTEGER PRIMARY KEY AUTOINCREMENT
email: TEXT NOT NULL
code: TEXT NOT NULL (6-digit string)
expiresAt: TIMESTAMP NOT NULL
used: BOOLEAN DEFAULT 0
resendCount: INTEGER DEFAULT 0
lastResentAt: TIMESTAMP
createdAt: TIMESTAMP DEFAULT CURRENT_TIMESTAMP

INDEXES:
- email (for lookup by email)
- code (for validation)
- expiresAt (for cleanup)
```

**Constraints:**
- Code generated fresh each time (not stored in user record)
- expiresAt is 10 minutes from creation time
- One code per email at a time (new request invalidates old)
- Code format: exactly 6 digits (000000-999999)
- resendCount increments for rate limiting (reset hourly)

#### Activity Logs Table (Custom)
```
id: INTEGER PRIMARY KEY AUTOINCREMENT
userId: TEXT FOREIGN KEY (nullable)
macAddress: TEXT
eventType: TEXT NOT NULL
  ('connect' | 'disconnect' | 'auth_success' | 'auth_fail' |
   'admin_revoke' | 'admin_extend' | 'code_sent' | 'code_resent')
ipAddress: TEXT
details: TEXT (JSON string)
createdAt: TIMESTAMP DEFAULT CURRENT_TIMESTAMP

INDEXES:
- userId (for user activity history)
- macAddress (for device activity)
- eventType (for filtering by event)
- createdAt (for time-range queries)
- (userId, createdAt) (composite for user's recent activity)
```

**Constraints:**
- Foreign key to user.id with SET NULL (keep logs even if user deleted)
- details is JSON string: { ap?: string, signalStrength?: number, ssid?: string, ... }
- No size limit on details, but keep entries reasonable
- Used for audit trail and analytics

#### Rate Limits Table (Custom)
```
id: INTEGER PRIMARY KEY AUTOINCREMENT
identifier: TEXT NOT NULL (email or IP)
action: TEXT NOT NULL ('verify' | 'resend' | 'login' | 'admin_login')
attempts: INTEGER DEFAULT 0
lastAttempt: TIMESTAMP
lockedUntil: TIMESTAMP
createdAt: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updatedAt: TIMESTAMP DEFAULT CURRENT_TIMESTAMP

INDEXES:
- (identifier, action) (composite for lookup)
- lockedUntil (for checking lock status)
```

**Constraints:**
- Composite unique constraint: (identifier, action)
- lockedUntil means access is blocked until this timestamp
- attempts resets if lastAttempt is outside the window
- Used for email verification and login rate limiting

#### Network Stats Table (Custom)
```
id: INTEGER PRIMARY KEY AUTOINCREMENT
macAddress: TEXT NOT NULL
timestamp: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
bytesReceived: INTEGER DEFAULT 0
bytesSent: INTEGER DEFAULT 0
domains: TEXT (JSON array of {domain, bytes} objects)
signalStrength: INTEGER (RSSI value, negative)
apMacAddress: TEXT (connected AP MAC)
createdAt: TIMESTAMP DEFAULT CURRENT_TIMESTAMP

INDEXES:
- macAddress (for device stats)
- timestamp (for time-series queries)
- (macAddress, timestamp) (composite for historical data)
```

**Constraints:**
- domains is JSON array string: [{ domain: "google.com", bytes: 1024 }, ...]
- signalStrength is RSSI in dBm (typically -30 to -90)
- Used for bandwidth tracking and DPI stats caching
- May accumulate large dataset; consider partitioning by date
- Data populated every 5 minutes from Unifi API

### 2.2 Data Retention Policy

| Table | Retention | Auto-Cleanup |
|-------|-----------|--------------|
| user | Forever | Manual deletion only |
| session | Per expiry | Cleanup old expired sessions weekly |
| guests | Forever (expires_at tracks authorization) | Manual revocation or auto-expire |
| verification_codes | 10 min expiry | Cleanup >1 hour old codes hourly |
| activity_logs | 90 days | Auto-delete logs >90 days old |
| network_stats | 30 days | Auto-delete stats >30 days old |
| rate_limits | 24 hours | Auto-cleanup expired locks |

### 2.3 Migration Strategy

- Use Drizzle ORM's migration system (declarative schema)
- Store migrations in `drizzle/` directory
- Run via `pnpm db:migrate` before app startup
- Idempotent migrations (safe to run multiple times)
- Schema version tracked in `_drizzle_migrations` table (automatic)

### 2.4 Indexing Strategy

**High-Traffic Queries (Optimize First):**
1. `SELECT * FROM guests WHERE macAddress = ? AND expiresAt > NOW()` → Index on (macAddress, expiresAt)
2. `SELECT * FROM users WHERE email = ?` → Index on email (already UNIQUE)
3. `SELECT * FROM activity_logs WHERE userId = ? ORDER BY createdAt DESC` → Index on (userId, createdAt)
4. `SELECT * FROM verification_codes WHERE email = ?` → Index on email

**Secondary Queries (Optimize if Slow):**
- `SELECT * FROM activity_logs WHERE eventType = ?`
- `SELECT * FROM network_stats WHERE macAddress = ? ORDER BY timestamp DESC`
- `SELECT * FROM guests WHERE expiresAt < NOW()` (cleanup queries)

---

## 3. API Specifications

### 3.1 Authentication Endpoints

#### POST /api/auth/signup (Better Auth)
**Purpose:** Register a new guest user
**Auth:** None (public)

**Request Body:**
```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "role": "guest"
}
```

**Response (201 Created):**
```json
{
  "user": {
    "id": "uuid-1234",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "guest",
    "emailVerified": false,
    "twoFactorEnabled": false
  },
  "session": {
    "token": "session-token",
    "expiresAt": "2026-01-25T10:00:00Z"
  }
}
```

**Error Cases:**
- 400: Invalid email format
- 409: Email already registered
- 422: Missing required fields (name, email, role)

---

#### POST /api/auth/sign-in (Better Auth)
**Purpose:** Sign in admin user
**Auth:** None (public)

**Request Body:**
```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

**Response (200 OK):**
```json
{
  "user": {
    "id": "uuid-5678",
    "email": "admin@example.com",
    "role": "admin",
    "twoFactorEnabled": true,
    "emailVerified": true
  },
  "session": {
    "token": "session-token",
    "expiresAt": "2026-01-25T10:00:00Z"
  }
}
```

**Response (202 Accepted - TOTP Required):**
```json
{
  "twoFactorRequired": true,
  "sessionToken": "temp-session-token"
}
```

**Error Cases:**
- 401: Invalid email or password
- 429: Too many failed attempts (rate limited)

---

### 3.2 Guest Portal APIs

#### POST /api/guest/verify-email
**Purpose:** Send 2FA verification code to email
**Auth:** None (public, rate limited)

**Request Body:**
```json
{
  "email": "guest@example.com",
  "name": "Guest Name",
  "macAddress": "AA:BB:CC:DD:EE:FF",
  "agreedToTerms": true
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Verification code sent to guest@example.com",
  "expiresIn": 600
}
```

**Validations:**
- email: Valid email format, not disposable (optional block list)
- name: Non-empty, max 100 chars
- macAddress: Valid MAC format (AA:BB:CC:DD:EE:FF)
- agreedToTerms: Must be true
- Rate limit: 5 per email per hour

**Process:**
1. Validate all input with Zod schema
2. Check rate limit by email
3. Generate 6-digit code (000000-999999)
4. Save to verification_codes table with 10-min expiry
5. Send email with code
6. Log event: code_sent
7. Return success

**Error Cases:**
- 400: Invalid email, name, MAC format, or terms not agreed
- 400: Disposable email (if block list enabled)
- 429: Rate limit exceeded (too many requests from email)
- 500: Email service failed

---

#### POST /api/guest/verify-code
**Purpose:** Verify 2FA code and authorize device
**Auth:** None (public, rate limited)

**Request Body:**
```json
{
  "email": "guest@example.com",
  "code": "123456",
  "macAddress": "AA:BB:CC:DD:EE:FF"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "sessionToken": "session-token-xyz",
  "expiresAt": "2026-01-25T10:00:00Z",
  "guestName": "Guest Name"
}
```

**Validations:**
- email: Must match the one from verify-email request
- code: Exactly 6 digits, must match generated code
- macAddress: Valid format, must match verify-email request
- Code must not be expired (>10 min)
- Code must not be already used
- Rate limit: 3 wrong attempts per code invalidates it

**Process:**
1. Find verification_code by email and code
2. Check if expired → reject with "Code expired"
3. Check if already used → reject with "Code already used"
4. Check attempts (increment on each try)
5. If attempts >= 3 → mark code as used, reject with "Too many attempts"
6. Find or create Better Auth user with role='guest'
7. Call Unifi API to authorize MAC (7-day duration)
8. If Unifi fails → return 503 "Network unavailable"
9. Create guest record in guests table
10. Mark verification_code as used
11. Create Better Auth session
12. Log event: auth_success
13. Send admin notification email
14. Return session token + expiry

**Error Cases:**
- 400: Code expired (>10 minutes)
- 400: Code already used
- 400: Invalid code for this email
- 400: Too many attempts (after 3rd try)
- 429: Rate limit exceeded on IP
- 503: Unifi API unavailable (fail fast)
- 500: Database error

---

#### POST /api/guest/resend-code
**Purpose:** Resend verification code to email
**Auth:** None (public, rate limited)

**Request Body:**
```json
{
  "email": "guest@example.com"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Code sent to guest@example.com",
  "canResendAt": "2026-01-18T10:00:30Z"
}
```

**Rate Limits:**
- 30-second cooldown between resends
- Max 3 resends per hour per email
- Enforce via rate_limits table

**Process:**
1. Check rate limit (30s cooldown + 3/hour)
2. If locked → return when can resend
3. Find verification_code by email (most recent)
4. Invalidate old code (mark as used or delete)
5. Generate new 6-digit code
6. Save to verification_codes table
7. Send email with new code
8. Increment resendCount in rate_limits
9. Update lastResentAt timestamp
10. Return canResendAt timestamp

**Error Cases:**
- 400: No active verification code for email
- 429: Rate limit exceeded (too soon, or too many resends)
- 500: Email service failed

---

#### GET /api/guest/status?mac=AA:BB:CC:DD:EE:FF
**Purpose:** Check if MAC is already authorized
**Auth:** None (public)

**Query Parameters:**
- mac: Device MAC address (required)

**Response (200 OK - Authorized):**
```json
{
  "authorized": true,
  "expiresAt": "2026-01-25T10:00:00Z",
  "timeRemaining": 432000,
  "user": {
    "name": "Guest Name",
    "email": "guest@example.com"
  }
}
```

**Response (200 OK - Not Authorized):**
```json
{
  "authorized": false,
  "reason": "MAC not found"
}
```

**Response (200 OK - Expired):**
```json
{
  "authorized": false,
  "reason": "authorization expired"
}
```

**Process:**
1. Find guest record by macAddress
2. Check if expiresAt > NOW()
3. If found and valid → return authorized=true with expiry
4. If found but expired → return authorized=false with reason
5. If not found → return authorized=false

**Error Cases:**
- 400: Invalid MAC format

---

### 3.3 Admin APIs

All admin APIs require:
- Valid Better Auth session (admin role)
- TOTP verified (if twoFactorEnabled=true)
- Authenticated via middleware

#### GET /api/admin/guests
**Purpose:** Get paginated list of guests
**Auth:** Admin session + TOTP verified

**Query Parameters:**
- page: 1-indexed page number (default: 1)
- limit: Items per page, max 100 (default: 50)
- status: 'active' | 'expired' | 'all' (default: 'all')
- search: Filter by name, email, or MAC (optional)
- sort: 'name' | 'email' | 'authorized' | 'expires' (default: 'authorized')
- order: 'asc' | 'desc' (default: 'desc')

**Response (200 OK):**
```json
{
  "guests": [
    {
      "id": "guest-123",
      "userId": "user-456",
      "name": "John Doe",
      "email": "john@example.com",
      "macAddresses": [
        {
          "mac": "AA:BB:CC:DD:EE:FF",
          "authorized": true,
          "authorizedAt": "2026-01-18T10:00:00Z",
          "expiresAt": "2026-01-25T10:00:00Z",
          "lastSeen": "2026-01-18T12:30:00Z"
        }
      ],
      "isOnline": true,
      "totalAuthCount": 1,
      "firstAuthorizedAt": "2026-01-18T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "pages": 3
  }
}
```

**Process:**
1. Query guests table with filters (status, search)
2. Join with users table for name/email
3. Group by userId (consolidate multiple MACs per user)
4. Count total results before limiting
5. Apply pagination
6. Return paginated results

---

#### GET /api/admin/network/status
**Purpose:** Real-time network monitoring (active devices)
**Auth:** Admin session + TOTP verified

**Query Parameters:**
- onlineOnly: 'true' | 'false' (default: 'false')
- filter: 'guests' | 'all' (default: 'all') - show only guest devices or all

**Response (200 OK):**
```json
{
  "devices": [
    {
      "macAddress": "AA:BB:CC:DD:EE:FF",
      "hostname": "johns-iphone",
      "name": "John Doe",
      "email": "john@example.com",
      "ipAddress": "192.168.10.105",
      "isOnline": true,
      "isGuest": true,
      "connectedDuration": 7200,
      "signalStrength": -45,
      "apName": "Living Room",
      "ssid": "world-wide-webb",
      "dataUsage": {
        "sent": 1048576,
        "received": 5242880,
        "total": 6291456
      },
      "expiresAt": "2026-01-25T10:00:00Z"
    }
  ],
  "summary": {
    "totalDevices": 15,
    "onlineDevices": 8,
    "guestDevices": 3,
    "totalBandwidth": 104857600
  }
}
```

**Process:**
1. Call Unifi API `/api/s/{site}/stat/sta` for active clients
2. Join with guests table (match by MAC)
3. Enrich with guest user info (name, email)
4. Call Unifi DPI API for bandwidth per device
5. Filter by online/guest status if requested
6. Return merged data with summary stats
7. Cache for 30 seconds (don't hammer Unifi)

**Error Cases:**
- 503: Unifi API unavailable

---

#### POST /api/admin/revoke
**Purpose:** Revoke guest access immediately
**Auth:** Admin session + TOTP verified

**Request Body:**
```json
{
  "macAddress": "AA:BB:CC:DD:EE:FF"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Guest access revoked",
  "macAddress": "AA:BB:CC:DD:EE:FF",
  "revokedAt": "2026-01-18T12:30:00Z"
}
```

**Process:**
1. Find guest by macAddress
2. Call Unifi API to unauthorize MAC
3. Update DB: set expiresAt = NOW() for this MAC
4. Log event: admin_revoke with admin user ID
5. Return success response
6. Device disconnects from network immediately

**Error Cases:**
- 404: MAC not found
- 503: Unifi API unavailable
- 500: Database error

---

#### GET /api/admin/logs
**Purpose:** Activity logs with filtering
**Auth:** Admin session + TOTP verified

**Query Parameters:**
- eventType: 'connect' | 'disconnect' | 'auth_success' | 'auth_fail' | 'admin_*' | 'all' (default: 'all')
- userId: Filter by user ID (optional)
- macAddress: Filter by MAC address (optional)
- from: ISO timestamp for start of range (optional)
- to: ISO timestamp for end of range (optional)
- limit: Results per page, max 500 (default: 100)
- page: Pagination (default: 1)

**Response (200 OK):**
```json
{
  "logs": [
    {
      "id": "log-123",
      "eventType": "auth_success",
      "timestamp": "2026-01-18T10:00:00Z",
      "user": {
        "id": "user-456",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "macAddress": "AA:BB:CC:DD:EE:FF",
      "ipAddress": "203.0.113.45",
      "details": {
        "ap": "Living Room AP",
        "signalStrength": -45,
        "authDuration": 604800
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 100,
    "total": 1523,
    "pages": 16
  }
}
```

**Process:**
1. Query activity_logs with filters (type, user, MAC, date range)
2. Join with users table for name/email
3. Parse JSON details field
4. Apply pagination
5. Return logs in reverse chronological order (newest first)

**Exports (if requested via header):**
- Accept: application/csv → Return as CSV file
- Accept: application/json → Return as JSON (default)

---

#### GET /api/admin/dpi?mac=AA:BB:CC:DD:EE:FF
**Purpose:** Deep Packet Inspection stats (domains, apps) for a device
**Auth:** Admin session + TOTP verified

**Query Parameters:**
- mac: Device MAC address (required)
- timeframe: '24h' | '7d' | '30d' (default: '24h')

**Response (200 OK):**
```json
{
  "macAddress": "AA:BB:CC:DD:EE:FF",
  "timeframe": "24h",
  "domains": [
    {
      "domain": "google.com",
      "requests": 145,
      "bytes": 2048576,
      "percentOfTotal": 15.2
    },
    {
      "domain": "youtube.com",
      "requests": 23,
      "bytes": 52428800,
      "percentOfTotal": 48.3
    }
  ],
  "applications": [
    {
      "name": "YouTube",
      "category": "Video Streaming",
      "bytes": 52428800,
      "percentOfTotal": 48.3
    },
    {
      "name": "Google Search",
      "category": "Search Engines",
      "bytes": 2048576,
      "percentOfTotal": 15.2
    }
  ],
  "totalBytes": 108789824
}
```

**Process:**
1. Query Unifi DPI API: `/api/s/{site}/stat/report/hourly.user`
2. Filter by MAC address and time range
3. Parse response for domain and app stats
4. Calculate percentages
5. Sort by bytes (descending)
6. Return formatted DPI stats

**Error Cases:**
- 400: Invalid MAC address
- 503: Unifi API unavailable
- 404: No DPI data for this MAC (might not be connected)

---

#### POST /api/admin/extend
**Purpose:** Manually extend guest authorization
**Auth:** Admin session + TOTP verified

**Request Body:**
```json
{
  "macAddress": "AA:BB:CC:DD:EE:FF",
  "days": 7
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "macAddress": "AA:BB:CC:DD:EE:FF",
  "newExpiresAt": "2026-01-25T10:00:00Z",
  "extendedAt": "2026-01-18T12:30:00Z"
}
```

**Process:**
1. Find guest by macAddress
2. Calculate new expiresAt = NOW() + (days * 86400 seconds)
3. Update guests table: set expiresAt = newExpiresAt
4. Call Unifi API to update authorization duration
5. Log event: admin_extend
6. Return new expiry timestamp

**Error Cases:**
- 404: MAC not found
- 503: Unifi API unavailable

---

### 3.4 TOTP Endpoints

#### POST /api/auth/totp/verify
**Purpose:** Verify TOTP code during login
**Auth:** Requires temp session from email+password auth

**Request Body:**
```json
{
  "code": "123456",
  "sessionToken": "temp-session-from-login"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "sessionToken": "new-verified-session-token",
  "expiresAt": "2026-01-25T10:00:00Z"
}
```

**Error Cases:**
- 400: Invalid 6-digit code
- 401: Code doesn't match TOTP secret
- 429: Too many failed attempts

---

#### POST /api/auth/totp/setup
**Purpose:** Generate TOTP secret and QR code for setup
**Auth:** Requires new admin session (first login after password)

**Request Body:** (empty)

**Response (200 OK):**
```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "manualEntry": "JBSWY3DPEHPK3PXP"
}
```

**Process:**
1. Generate random TOTP secret (32 bytes, base32 encoded)
2. Generate QR code image for secret (Google Authenticator format)
3. Return both for user to scan and/or manually enter

---

#### POST /api/auth/totp/confirm
**Purpose:** Confirm TOTP setup by verifying initial code
**Auth:** Requires admin session (during setup flow)

**Request Body:**
```json
{
  "code": "123456",
  "secret": "JBSWY3DPEHPK3PXP"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "backupCodes": [
    "ABCD-EFGH-IJKL-MNOP",
    "PQRS-TUVW-XYZA-BCDE",
    "FGHI-JKLM-NOPQ-RSTU"
  ]
}
```

**Process:**
1. Verify provided code matches secret (TOTP validation)
2. Save secret to user.twoFactorSecret
3. Set user.twoFactorEnabled = true
4. Generate 10 backup codes
5. Save backup codes to backup_codes table (all unused)
6. Return backup codes for user to download/save
7. Log event: totp_setup

**Error Cases:**
- 400: Invalid 6-digit code
- 401: Code doesn't match secret
- 422: Invalid secret format

---

### 3.5 Health & Diagnostics

#### GET /api/health
**Purpose:** Health check endpoint for monitoring
**Auth:** None (public)

**Response (200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2026-01-18T10:00:00Z",
  "checks": {
    "database": {
      "status": "ok",
      "latency": 2
    },
    "unifi": {
      "status": "ok",
      "latency": 45
    },
    "email": {
      "status": "ok",
      "latency": 120
    }
  }
}
```

**Response (503 Service Unavailable):**
```json
{
  "status": "degraded",
  "timestamp": "2026-01-18T10:00:00Z",
  "checks": {
    "database": {
      "status": "ok",
      "latency": 2
    },
    "unifi": {
      "status": "error",
      "error": "Connection timeout",
      "latency": 5000
    },
    "email": {
      "status": "ok",
      "latency": 120
    }
  }
}
```

---

#### GET /api/metrics
**Purpose:** Metrics for monitoring
**Auth:** None (public) - consider protecting in future

**Response (200 OK):**
```json
{
  "timestamp": "2026-01-18T10:00:00Z",
  "guests": {
    "total": 45,
    "active": 12,
    "expired": 33
  },
  "auth": {
    "attempts_24h": 128,
    "success_rate": 0.89,
    "failed_attempts_24h": 14
  },
  "network": {
    "devices_online": 8,
    "total_bandwidth_24h": 104857600
  }
}
```

---

## 4. Authentication & Authorization

### 4.1 Better Auth Configuration

**Key Settings:**
```typescript
{
  // Email + Password for admins
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false  // Admin is pre-verified
  },

  // Email OTP for guests (passwordless)
  emailOTP: {
    enabled: true,
    expiresIn: 600  // 10 minutes
  },

  // TOTP 2FA plugin for admins
  plugins: [
    twoFactor({
      issuer: "World Wide Webb",
      otpOptions: {
        period: 30,
        digits: 6
      },
      backupCodeLength: 10,
      backupCodeSize: 12
    })
  ],

  // Session configuration
  session: {
    expiresIn: 604800,      // 7 days
    updateAge: 86400,        // Update every 24 hours
    absoluteTimeout: 2592000 // 30 days absolute max
  },

  // Rate limiting (per Better Auth)
  rateLimit: {
    enabled: true,
    window: 60,    // 1 minute
    max: 10        // 10 requests per window
  }
}
```

### 4.2 Authorization Matrix

| Route | Guest | Admin | Middleware | Notes |
|-------|-------|-------|------------|-------|
| `/` (landing) | ✅ | ✅ | None | Public |
| `/verify` | ✅ | ✅ | None | Public |
| `/success` | ✅ | ✅ | None | Public |
| `/portal/*` | ✅ | ✅ | Guest auth | Requires session |
| `/admin/login` | ✅ | ✅ | None | Public |
| `/admin/setup-2fa` | ✗ | ✅ | Admin auth | Only on first login |
| `/admin/*` (except login) | ✗ | ✅ | Admin auth + TOTP | Protected |

### 4.3 Session Validation

**On Each Protected Request:**
1. Extract session token from secure cookie
2. Query session record from database
3. Verify expiresAt > NOW()
4. For admin routes: verify user.role = 'admin'
5. For admin routes (except setup-2fa): verify user.twoFactorEnabled = true
6. Update lastActivity timestamp (optional)
7. Allow or reject request

**Session Hijacking Prevention:**
- HTTPOnly secure cookies (no JavaScript access)
- SameSite=Strict CSRF protection
- Optional IP binding (can break mobile)

---

## 5. Unifi Controller Integration

### 5.1 Unifi Client Requirements

**Connection Details:**
- Base URL: `https://{controller-ip}:8443` (e.g., 192.168.1.1:8443)
- Site: `default` (or configured via UNIFI_SITE)
- Username: Admin account with API permissions
- Password: Admin password (stored in .env)

**API Endpoints Used:**
```
POST /api/login                              → Authenticate
POST /proxy/network/api/s/{site}/cmd/stamgr → Authorize/revoke guest
GET /proxy/network/api/s/{site}/stat/sta    → Get active clients
GET /proxy/network/api/s/{site}/stat/guest  → Get authorized guests
GET /proxy/network/api/s/{site}/stat/dpi    → Get DPI stats
GET /proxy/network/api/s/{site}/stat/event  → Get connection events
```

### 5.2 Authorization Process

**Authorize Guest:**
```
POST /proxy/network/api/s/{site}/cmd/stamgr
{
  "cmd": "authorize-guest",
  "mac": "AA:BB:CC:DD:EE:FF",
  "minutes": 10080  // 7 days * 1440 min/day
}
```

**Response:**
```json
{
  "meta": { "rc": "ok" },
  "data": [{ "result": true }]
}
```

**Revoke Guest:**
```
POST /proxy/network/api/s/{site}/cmd/stamgr
{
  "cmd": "unauthorize-guest",
  "mac": "AA:BB:CC:DD:EE:FF"
}
```

### 5.3 Real-time Monitoring

**Get Active Clients:**
```
GET /proxy/network/api/s/{site}/stat/sta

Response: Array of client objects:
{
  "mac": "AA:BB:CC:DD:EE:FF",
  "hostname": "johns-iphone",
  "ip": "192.168.10.105",
  "is_guest": true,
  "uptime": 7200,
  "rssi": -45,
  "ap_mac": "BB:CC:DD:EE:FF:AA",
  "essid": "world-wide-webb",
  "bytes_u": 1048576,    // uploaded
  "bytes_d": 5242880,    // downloaded
  "last_seen": 1705575600
}
```

### 5.4 DPI Stats

**Get DPI Data:**
```
GET /proxy/network/api/s/{site}/stat/report/hourly.user?mac=AA:BB:CC:DD:EE:FF&time_range=3600000

Response: Array with domain/app breakdowns
```

### 5.5 Error Handling

**Unifi API Failures → Fail Fast:**
- Connection timeout → 503 Service Unavailable
- Invalid credentials → Log error, try reconnect
- Invalid MAC format → 400 Bad Request
- No response → Return clear user message

**Retry Strategy:**
- No automatic retries on initial request
- Single login per session (session persists)
- Log errors for admin review

---

## 6. Security Requirements

### 6.1 Input Validation

**Use Zod schemas for all inputs:**
```typescript
// Email validation
const emailSchema = z.string().email().toLowerCase();

// 6-digit code validation
const codeSchema = z.string().regex(/^\d{6}$/);

// MAC address validation
const macSchema = z.string().regex(/^([A-Fa-f0-9]{2}:){5}([A-Fa-f0-9]{2})$/);

// Password validation (for admin)
const passwordSchema = z.string().min(12);
```

### 6.2 Data Protection

- **Passwords**: Better Auth bcrypt hashing (auto)
- **TOTP Secret**: Encrypted at rest (consider)
- **Backup Codes**: Hashed before storage (consider)
- **Session Tokens**: Cryptographically secure (Better Auth)

### 6.3 Rate Limiting

| Endpoint | Limit | Window | Implementation |
|----------|-------|--------|-----------------|
| POST /api/guest/verify-email | 5 | 1 hour | rate_limits table |
| POST /api/guest/verify-code | 3 wrong | per code | verification_codes.attempts |
| POST /api/guest/resend-code | 30s cooldown | per request | rate_limits table |
| POST /api/guest/resend-code | 3 | 1 hour | rate_limits table |
| POST /api/auth/sign-in | 5 failed | 15 min | Better Auth |
| POST /api/auth/totp/verify | 5 failed | 15 min | Better Auth |

### 6.4 CSRF Protection

- Better Auth provides CSRF tokens automatically
- Next.js API routes use stricter SameSite cookies
- All state-changing requests use POST/PUT/DELETE

### 6.5 XSS Prevention

- React auto-escapes all interpolated values
- Avoid dangerouslySetInnerHTML
- Validate and sanitize user input

### 6.6 SQL Injection

- Drizzle ORM uses parameterized queries (safe)
- Never concatenate user input into queries
- Always use prepared statements

---

## 7. UI/UX Specifications

### 7.1 Design System

**Color Palette:**
- Background: `#000000` (black) - primary bg
- Foreground: `#FFFFFF` (white) - primary text
- Muted Background: `#171717` (zinc-900) - secondary bg
- Muted Foreground: `#A1A1AA` (zinc-400) - secondary text
- Border: `#27272A` (zinc-800) - dividers, borders
- Input: `#27272A` (zinc-800) - form inputs bg
- Error: `#EF4444` (red-500) - error states

**Typography:**
- Font Stack: Geist Sans (primary), Geist Mono (code)
- Sizes: 12px (text-xs), 14px (text-sm), 16px (text-base), 18px (text-lg), 20px (text-xl), 24px (text-2xl)
- Weight: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)

**Spacing:**
- Scale: 4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px, 48px
- Use Tailwind classes: `p-1` through `p-12`, `m-1` through `m-12`, `gap-1` through `gap-12`

**Shadows:**
- None (minimal aesthetic per brand)
- Or very subtle: `shadow-sm` on interactive elements

**Border Radius:**
- Buttons/inputs: `rounded-lg` (8px)
- Cards: `rounded-lg` (8px)
- Modals: `rounded-lg` (8px)

### 7.2 Component Library (shadcn/ui)

**Installed Components:**
- Button
- Input
- Label
- Card
- Table
- Badge
- Separator
- Dialog
- Dropdown Menu
- Checkbox
- Toast

**Customization:**
- Dark mode default (no light mode toggle)
- Remove light mode styles from generated components
- Extend with custom Tailwind config

### 7.3 Guest Portal Flow

**Page 1: Landing (/)**
```
┌─────────────────────────────────────┐
│  World Wide Webb                    │ (Heading)
│                                     │
│  Sign in to connect                 │ (Subheading)
│                                     │
│  [Your Name             ]           │ (Text Input)
│  [your@email.com       ]           │ (Email Input)
│                                     │
│  [✓] I agree to the terms           │ (Checkbox)
│                                     │
│  [Continue          ]               │ (Button, full width)
│                                     │
│  By continuing, you agree to the    │ (Help text)
│  terms of service                   │
└─────────────────────────────────────┘
```

**Page 2: Verify (/verify)**
```
┌─────────────────────────────────────┐
│  Check your email                   │ (Heading)
│                                     │
│  We sent a code to:                 │
│  user@example.com [Edit]            │ (Editable email)
│                                     │
│  [0][0][0][0][0][0]                │ (6 input fields)
│                                     │
│  Didn't receive it?                 │
│  Resend code (in 27s)               │ (Button or countdown)
│                                     │
│  [Error message here]               │ (Error display)
└─────────────────────────────────────┘
```

**Page 3: Success (/success)**
```
┌─────────────────────────────────────┐
│              ✓                      │ (Checkmark icon)
│                                     │
│  Welcome to the                     │ (Heading)
│  World Wide Webb!                   │
│                                     │
│  You're connected                   │ (Subheading)
│                                     │
│  Closing in 3s...                   │ (Auto-close message)
│                                     │
└─────────────────────────────────────┘
```

### 7.4 Admin Panel Layout

**Header:**
- Logo / Title left
- Admin name / Logout dropdown right
- Border bottom (zinc-800)

**Sidebar (Optional):**
- Dashboard
- Guests
- Network
- Logs
- Settings (future)

**Dashboard Cards:**
- Active Guests: Number + icon
- Total Authorized: Number + icon
- Pending Verifications: Number + icon
- Bandwidth (24h): Data + unit

**Tables:**
- Sortable columns (click header)
- Pagination controls
- Search/filter bar
- Compact design

### 7.5 Mobile Responsiveness

- Base width: 100% (mobile first)
- Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- Guest portal: Center layout on all sizes
- Admin: Sidebar → hamburger menu on mobile
- Tables: Horizontal scroll on mobile

---

## 8. Performance & Scalability

### 8.1 Caching Strategy

**Browser Cache:**
- Static assets: 1 year (CSS, JS, fonts)
- HTML pages: No cache (always fresh)

**Server Cache:**
- Network status: 30 seconds (in-memory)
- DPI stats: 5 minutes (in-memory)
- Unifi session: Until expiry (in-memory)

**Database Optimization:**
- Indexes on frequently queried columns (see 2.4)
- Query timeouts: 5 seconds (fail fast)

### 8.2 Scalability Considerations

**Current Scope:**
- Home network (~20-100 concurrent guests)
- Single SQLite database (sufficient)
- Next.js single instance

**Future Scaling:**
- Multi-user admin (role-based access)
- Multi-site support (Unifi multi-controller)
- Migrate SQLite → PostgreSQL
- Redis for session store
- Load balancer for multiple instances

### 8.3 Database Performance

**Query Optimization:**
- Use indexes for WHERE, JOIN, ORDER BY clauses
- Paginate large result sets (limit 500 max)
- Avoid N+1 queries (use JOIN)

**Maintenance:**
- PRAGMA optimize; (weekly)
- VACUUM; (monthly)
- Monitor file size (SQLite grows, doesn't shrink)

---

## 9. Deployment & Operations

### 9.1 Docker Deployment

**Build & Run:**
```bash
docker build -t world-wide-webb-portal .
docker run -p 3000:3000 \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  world-wide-webb-portal
```

**Docker Compose:**
```yaml
app:
  build: .
  ports: ["3000:3000"]
  env_file: .env
  volumes:
    - ./data:/app/data
  depends_on: [mailpit]

mailpit:
  image: axllent/mailpit:latest
  ports: ["1025:1025", "8025:8025"]
```

### 9.2 Environment Variables

```bash
# App
NODE_ENV=production
BETTER_AUTH_URL=https://portal.worldwidewebb.co
BETTER_AUTH_SECRET=long-random-secret-key

# Database
DATABASE_URL=file:./data/captive-portal.db

# Admin Setup
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=temporary-password

# Unifi
UNIFI_CONTROLLER_URL=https://192.168.1.1:8443
UNIFI_USERNAME=admin
UNIFI_PASSWORD=controller-password
UNIFI_SITE=default

# Email
EMAIL_PROVIDER=resend
FROM_EMAIL=wifi@worldwidewebb.co
FROM_NAME=World Wide Webb
RESEND_API_KEY=re_xxxxxxxxxxxxx

# Admin Notifications
ADMIN_NOTIFY_EMAIL=calumpeterwebb@icloud.com
```

### 9.3 Monitoring & Alerts

**Health Checks:**
- `/api/health` - Every 5 minutes
- Alert on any component failure
- Email notification to admin

**Metrics Collection:**
- `/api/metrics` - Log every hour
- Track: Active guests, auth success rate, bandwidth

**Logging:**
- Structured JSON logs (pino)
- Include: timestamp, userId, macAddress, eventType, error details
- Retention: 30 days

### 9.4 Backup Strategy

**Database:**
- Daily automated backup: `cp data/captive-portal.db data/backups/`
- Off-site backup (USB, cloud)
- Test restore weekly

**.env File:**
- Store securely (not in repo)
- Backup copy offline
- Document recovery procedure

**Configuration:**
- Document Unifi settings (screenshots)
- Portal URL and network SSID
- Admin account recovery procedure

---

## 10. Testing Requirements

### 10.1 Unit Tests

**Core Functions to Test:**
- Verification code generation (randomness, format)
- TOTP validation (time-based, window)
- MAC address validation (format)
- Email validation (format, disposable)
- Rate limit checking (window, cooldown)
- Session expiry calculation

### 10.2 Integration Tests

**Auth Flows:**
- Guest email → code → verification → authorization
- Admin password → TOTP setup → login
- Session creation and validation

**API Tests:**
- POST /api/guest/verify-email (success, rate limit, validation)
- POST /api/guest/verify-code (success, wrong code, expired)
- GET /api/admin/guests (pagination, filtering)

**Unifi Integration:**
- Mock Unifi API (success case)
- Mock Unifi API (failure case - timeout, invalid response)

### 10.3 E2E Tests (Playwright)

**Guest Flow:**
1. Navigate to portal
2. Enter email + name
3. Receive code in Mailpit
4. Enter code
5. Verify success page
6. Check authorization in Unifi (via mock)

**Admin Flow:**
1. Login with password
2. Complete TOTP setup
3. Verify backup codes downloadable
4. Access admin dashboard
5. Verify guest list populated

---

## 11. Compliance & Legal

### 11.1 Privacy

- Guests must agree to terms before connecting
- Data retention: Keep activity logs 90 days max
- Guest deletion: Allow self-service opt-out (future)
- No tracking off-network

### 11.2 Terms of Service

**Suggest including:**
- Acceptable use policy
- Data retention period
- No illegal content
- Admin right to revoke access
- Contact for disputes

---

## Appendix: Reference Tables

### A.1 HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful request |
| 201 | Created | New resource created |
| 202 | Accepted | Async request accepted |
| 400 | Bad Request | Invalid input |
| 401 | Unauthorized | Auth required/failed |
| 403 | Forbidden | Auth successful but insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Email already registered |
| 422 | Unprocessable | Schema validation failed |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Error | Server error |
| 503 | Service Unavailable | Unifi/email down |

### A.2 Event Types

| Type | Trigger | Log | Notify |
|------|---------|-----|--------|
| code_sent | Guest requests verify code | Yes | No |
| code_resent | Guest resends code | Yes | No |
| auth_success | Guest verifies code + authorizes | Yes | Email admin |
| auth_fail | Guest enters wrong code (3x) | Yes | No |
| connect | Guest device connects to WiFi | Yes (via Unifi sync) | No |
| disconnect | Guest device disconnects | Yes (via Unifi sync) | No |
| admin_revoke | Admin revokes access | Yes | No |
| admin_extend | Admin extends expiry | Yes | No |
| totp_setup | Admin completes TOTP setup | Yes | No |

### A.3 Time Constants

| Name | Value | Usage |
|------|-------|-------|
| Code Expiry | 10 min (600 sec) | Verification code validity |
| Access Duration | 7 days (604800 sec) | Guest network authorization |
| Session Expiry | 7 days (604800 sec) | Login session validity |
| Resend Cooldown | 30 sec | Minimum between resends |
| Resend Max Per Hour | 3 | Rate limit on resends |
| Code Attempts Max | 3 | Wrong guesses before invalidation |
| Network Stats Cache | 5 min | Unifi polling interval |
| Activity Log Retention | 90 days | Auto-cleanup old logs |

---

**Document Complete**

This technical specification provides detailed guidance for implementing the World Wide Webb captive portal. All API endpoints, database tables, authentication flows, and UI requirements are defined above.
