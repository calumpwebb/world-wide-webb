# World Wide Webb - Captive Portal PRD

**Version:** 1.0
**Date:** 2026-01-18
**Project:** Guest WiFi Captive Portal for Home Network
**Network SSID:** `world-wide-webb`
**Brand Name:** World Wide Webb
**Domain:** worldwidewebb.co

---

## Executive Summary

A modern, minimal captive portal for the World Wide Webb guest WiFi network. Users authenticate via email verification (passwordless) to gain network access. Features unified authentication (Better Auth) for both guests and admin, real-time network monitoring, and comprehensive activity logging.

**Key Features:**
- Passwordless guest authentication (email + 2FA code)
- Admin panel with TOTP 2FA (Google Authenticator/Authy)
- Real-time device monitoring via Unifi API
- Guest self-service dashboard
- Activity logging (connections, bandwidth, domains)
- Single command setup + Docker support
- Dark mode UI (black background, Apple-style minimal)
- Git hooks for automatic code formatting (Prettier + ESLint)

---

## Technical Stack

### Core Technologies
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **UI:** React + Tailwind CSS + shadcn/ui (dark mode default)
- **Fonts:** Geist Sans + Geist Mono
- **Database:** SQLite (better-sqlite3 or Drizzle ORM)
- **Authentication:** Better Auth (unified for guests + admin)
- **Email:** Mailpit (dev) → Resend (prod)
- **Network Integration:** Unifi Controller API (node-unifi or custom client)
- **Code Quality:** Prettier + ESLint + Husky (git hooks) + lint-staged

### Infrastructure
- **Hardware:** Unifi Pro Max gateway + 5Gb AT&T fiber
- **Network:** Guest VLAN via Unifi Controller
- **Deployment:** Homelab server or Docker container
- **Environment:** `.env` configuration for all settings

---

## System Architecture

### Application Structure
```
world-wide-webb-portal/
├── app/
│   ├── (guest)/              # Guest captive portal
│   │   ├── page.tsx          # Landing (email entry)
│   │   ├── verify/page.tsx   # 2FA code verification
│   │   └── success/page.tsx  # Welcome screen
│   │
│   ├── portal/               # Guest self-service (auth required)
│   │   ├── page.tsx          # Guest dashboard
│   │   ├── devices/page.tsx  # Device management
│   │   └── usage/page.tsx    # Usage statistics
│   │
│   └── admin/                # Admin panel (role: admin)
│       ├── login/page.tsx    # Admin login
│       ├── setup-2fa/page.tsx # TOTP setup (forced first login)
│       ├── page.tsx          # Admin dashboard
│       ├── guests/page.tsx   # Guest management
│       ├── network/page.tsx  # Live network monitoring
│       └── logs/page.tsx     # Activity logs
│
├── api/
│   ├── auth/                 # Better Auth endpoints
│   ├── guest/                # Guest portal APIs
│   │   ├── verify-email/     # Send 2FA code
│   │   ├── verify-code/      # Verify code + authorize MAC
│   │   ├── resend-code/      # Resend verification code
│   │   └── status/           # Check authorization status
│   │
│   ├── admin/                # Admin APIs (protected)
│   │   ├── guests/           # CRUD guest operations
│   │   ├── network/status/   # Live device status
│   │   ├── logs/             # Activity logs
│   │   └── revoke/           # Revoke guest access
│   │
│   └── unifi/                # Unifi integration layer
│       ├── authorize/        # Authorize MAC on Unifi
│       ├── revoke/           # Revoke MAC authorization
│       ├── clients/          # Get active clients
│       └── dpi/              # Get DPI stats
│
├── lib/
│   ├── db.ts                 # SQLite + Drizzle ORM
│   ├── auth.ts               # Better Auth config
│   ├── unifi.ts              # Unifi Controller client
│   ├── email.ts              # Email service (Mailpit/Resend)
│   └── utils.ts              # Shared utilities
│
├── components/
│   ├── ui/                   # shadcn components
│   └── ...                   # Custom components
│
├── scripts/
│   ├── migrate.ts            # Database migrations
│   └── seed-admin.ts         # Create admin user
│
├── .env                      # Environment configuration
├── docker-compose.yml        # Docker setup
└── package.json              # Dependencies + scripts
```

---

## Database Schema

### Tables

```sql
-- Better Auth User Table
CREATE TABLE user (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  emailVerified BOOLEAN DEFAULT 0,
  name TEXT,
  password TEXT,                    -- NULL for guests (passwordless)
  role TEXT NOT NULL,               -- 'guest' | 'admin'
  twoFactorEnabled BOOLEAN DEFAULT 0,
  twoFactorSecret TEXT,             -- TOTP secret (admin only)
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Better Auth Session Table
CREATE TABLE session (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  expiresAt TIMESTAMP NOT NULL,
  ipAddress TEXT,
  userAgent TEXT,
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);

-- Better Auth Backup Codes (admin TOTP)
CREATE TABLE backup_codes (
  id INTEGER PRIMARY KEY,
  userId TEXT NOT NULL,
  code TEXT NOT NULL,
  used BOOLEAN DEFAULT 0,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);

-- Guest Network Authorization
CREATE TABLE guests (
  id INTEGER PRIMARY KEY,
  userId TEXT NOT NULL,             -- Links to Better Auth user
  macAddress TEXT NOT NULL,         -- Device MAC address
  ipAddress TEXT,                   -- Device IP
  deviceInfo TEXT,                  -- User agent, device type
  authorizedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expiresAt TIMESTAMP NOT NULL,     -- 7 days from authorization
  lastSeen TIMESTAMP,               -- Last connection timestamp
  authCount INTEGER DEFAULT 1,      -- Times re-authorized
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX idx_guests_mac ON guests(macAddress);
CREATE INDEX idx_guests_expires ON guests(expiresAt);

-- Email Verification Codes (2FA)
CREATE TABLE verification_codes (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,               -- 6-digit code
  expiresAt TIMESTAMP NOT NULL,     -- 10 min expiry
  used BOOLEAN DEFAULT 0,
  resendCount INTEGER DEFAULT 0,    -- Rate limiting
  lastResentAt TIMESTAMP,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_verification_email ON verification_codes(email);

-- Activity Logs
CREATE TABLE activity_logs (
  id INTEGER PRIMARY KEY,
  userId TEXT,
  macAddress TEXT,
  eventType TEXT NOT NULL,          -- 'connect' | 'disconnect' | 'auth_success' | 'auth_fail'
  ipAddress TEXT,
  details TEXT,                     -- JSON with event details
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE SET NULL
);

CREATE INDEX idx_logs_user ON activity_logs(userId);
CREATE INDEX idx_logs_type ON activity_logs(eventType);
CREATE INDEX idx_logs_created ON activity_logs(createdAt);

-- Rate Limiting
CREATE TABLE rate_limits (
  id INTEGER PRIMARY KEY,
  identifier TEXT NOT NULL,         -- email or IP
  action TEXT NOT NULL,             -- 'verify' | 'resend' | 'login'
  attempts INTEGER DEFAULT 0,
  lastAttempt TIMESTAMP,
  lockedUntil TIMESTAMP
);

CREATE INDEX idx_rate_identifier ON rate_limits(identifier, action);

-- Network Statistics (cached from Unifi)
CREATE TABLE network_stats (
  id INTEGER PRIMARY KEY,
  macAddress TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  bytesReceived INTEGER DEFAULT 0,
  bytesSent INTEGER DEFAULT 0,
  domains TEXT,                     -- JSON array of domains visited
  signalStrength INTEGER,           -- RSSI
  apMacAddress TEXT                 -- Connected AP
);

CREATE INDEX idx_stats_mac ON network_stats(macAddress);
CREATE INDEX idx_stats_timestamp ON network_stats(timestamp);
```

---

## Authentication Flows

### Guest Authentication (Passwordless)

#### First-Time Guest
```
1. User connects to "world-wide-webb" WiFi
2. Unifi redirects to portal: /?id=AA:BB:CC:DD:EE:FF&ssid=world-wide-webb
3. Landing page: Enter name + email + checkbox "I agree to terms"
4. Submit → API generates 6-digit code, sends via email
5. Redirect to /verify?email=user@example.com
6. User enters 6-digit code (autocomplete="one-time-code" for 1Password)
7. API verifies code:
   - Create Better Auth user (role: guest, password: null)
   - Authorize MAC on Unifi (7 day duration)
   - Save guest record to DB
   - Send admin notification email
   - Log event: auth_success
8. Redirect to /success
9. Show "Welcome to World Wide Webb!" + auto-close after 3s
10. Guest has internet access
```

#### Returning Guest (Within 7 Days)
```
1. User connects to "world-wide-webb" WiFi
2. Portal loads, checks MAC in DB
3. If authorized and not expired:
   → Redirect to /success ("Welcome back!")
4. If expired:
   → Show login form
   → Enter email → Get new 2FA code
   → Verify → Extend authorization (new 7-day period)
   → Increment authCount
```

#### Returning Guest (Multiple Devices)
```
1. Same email, different MAC
2. Better Auth session exists (logged in on phone)
3. Portal detects: "Authorize this device?"
4. One-click authorize (no new 2FA needed, session valid)
5. New MAC added to guests table
```

### Admin Authentication (Password + TOTP)

#### First-Time Admin Setup
```
1. Run: pnpm db:seed
   → Creates admin user from ADMIN_EMAIL in .env
   → Random temp password (unused)
   → twoFactorEnabled: false

2. Admin visits /admin/login
   → Enter: calumpeterwebb@icloud.com + password from .env

3. Better Auth logs in, middleware detects !twoFactorEnabled
   → Force redirect to /admin/setup-2fa

4. Setup TOTP:
   → Display QR code + manual entry key
   → User scans with Google Authenticator/Authy/1Password
   → Enter 6-digit code to verify setup
   → Generate 10 backup codes
   → Force download backup codes
   → Mark twoFactorEnabled: true

5. Redirect to /admin
```

#### Admin Login (After Setup)
```
1. Visit /admin/login
2. Enter email + password
3. Better Auth validates credentials
4. Redirect to /admin/verify-totp
5. Enter 6-digit code from authenticator app
6. Better Auth validates TOTP
7. Create session, redirect to /admin dashboard
```

#### Admin Password Reset
```
1. Visit /admin/login → "Forgot password?"
2. Enter email → Better Auth sends reset link
3. Click link → Set new password
4. Login with new password + TOTP (TOTP unchanged)
```

---

## User Flows

### Guest Flow: First Visit

```
┌─────────────────────────────────────┐
│         world-wide-webb             │
│         Sign in to connect          │
│                                     │
│  [Your name        ]                │
│  [your@email.com   ]                │
│                                     │
│  [✓] I agree to the terms           │
│                                     │
│  [Continue          ]               │
│                                     │
│  By continuing, you agree to the    │
│  terms of service                   │
└─────────────────────────────────────┘

↓ Submit

┌─────────────────────────────────────┐
│      Check your email               │
│                                     │
│  We sent a code to:                 │
│  john@example.com  [Edit]           │
│                                     │
│  [0][0][0][0][0][0]                │
│                                     │
│  Didn't receive it?                 │
│  Resend code (in 27s)               │
│                                     │
└─────────────────────────────────────┘

↓ Verify

┌─────────────────────────────────────┐
│             ✓                       │
│                                     │
│  Welcome to the                     │
│  World Wide Webb!                   │
│                                     │
│  You're connected                   │
│                                     │
│  Closing in 3s...                   │
│                                     │
└─────────────────────────────────────┘
```

### Admin Flow: First Login

```
┌─────────────────────────────────────┐
│         Admin Login                 │
│                                     │
│  [calumpeterwebb@icloud.com]        │
│  [●●●●●●●●●●] Password              │
│                                     │
│  [Login          ]                  │
│                                     │
│  Forgot password?                   │
└─────────────────────────────────────┘

↓ First login (no TOTP setup)

┌─────────────────────────────────────┐
│  Setup Two-Factor Authentication    │
│                                     │
│  Scan this QR code with your        │
│  authenticator app:                 │
│                                     │
│     ███████████████████             │
│     ███ ▄▄▄▄▄ █▀█ ███              │
│     ███ █   █ ██▄ ███              │
│                                     │
│  Or enter manually:                 │
│  JBSWY3DPEHPK3PXP                   │
│                                     │
│  [______] Enter code to verify      │
│                                     │
│  [Complete Setup]                   │
└─────────────────────────────────────┘

↓ Verify TOTP

┌─────────────────────────────────────┐
│  Save Your Backup Codes             │
│                                     │
│  Store these securely. You'll need  │
│  them if you lose your device.      │
│                                     │
│  1. ABCD-EFGH-IJKL-MNOP             │
│  2. PQRS-TUVW-XYZA-BCDE             │
│  3. FGHI-JKLM-NOPQ-RSTU             │
│  ... (7 more)                       │
│                                     │
│  [Download]  [✓] I've saved these   │
│  [Continue to Dashboard]            │
└─────────────────────────────────────┘
```

---

## API Endpoints

### Guest Portal APIs

#### POST /api/guest/verify-email
**Purpose:** Send 2FA code to email
**Auth:** None (rate limited by IP + email)

**Request:**
```json
{
  "email": "john@example.com",
  "name": "John Doe",
  "macAddress": "AA:BB:CC:DD:EE:FF",
  "agreedToTerms": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Verification code sent",
  "expiresIn": 600
}
```

**Error Cases:**
- 429: Rate limit exceeded
- 400: Invalid email format
- 400: Terms not agreed

---

#### POST /api/guest/verify-code
**Purpose:** Verify 2FA code and authorize device
**Auth:** None

**Request:**
```json
{
  "email": "john@example.com",
  "code": "123456",
  "macAddress": "AA:BB:CC:DD:EE:FF"
}
```

**Response:**
```json
{
  "success": true,
  "sessionToken": "...",
  "expiresAt": "2026-01-25T10:00:00Z"
}
```

**Process:**
1. Validate code (not expired, not used, matches email)
2. Check/create Better Auth user (role: guest)
3. Call Unifi API to authorize MAC (7 days)
4. Save guest record to DB
5. Mark code as used
6. Send admin notification email
7. Log: auth_success
8. Return session

**Error Cases:**
- 400: Invalid code
- 400: Code expired
- 429: Too many attempts
- 500: Unifi API failure (fail fast)

---

#### POST /api/guest/resend-code
**Purpose:** Resend verification code
**Auth:** None (rate limited)

**Request:**
```json
{
  "email": "john@example.com"
}
```

**Rate Limits:**
- 30 second cooldown between sends
- Max 3 resends per hour per email

**Response:**
```json
{
  "success": true,
  "canResendAt": "2026-01-18T10:00:30Z"
}
```

---

#### GET /api/guest/status?mac=AA:BB:CC:DD:EE:FF
**Purpose:** Check if MAC is already authorized
**Auth:** None

**Response:**
```json
{
  "authorized": true,
  "expiresAt": "2026-01-25T10:00:00Z",
  "user": {
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

---

### Admin APIs (Protected)

All admin APIs require:
- Valid Better Auth session
- User role: admin
- TOTP verified (if enabled)

#### GET /api/admin/guests
**Purpose:** List all guests with pagination
**Auth:** Admin session required

**Query Params:**
- `page` (default: 1)
- `limit` (default: 50)
- `status` (active | expired | all)

**Response:**
```json
{
  "guests": [
    {
      "id": "123",
      "name": "John Doe",
      "email": "john@example.com",
      "macAddress": "AA:BB:CC:DD:EE:FF",
      "ipAddress": "192.168.1.100",
      "authorizedAt": "2026-01-18T10:00:00Z",
      "expiresAt": "2026-01-25T10:00:00Z",
      "lastSeen": "2026-01-18T12:30:00Z",
      "isOnline": true,
      "authCount": 1
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 123,
    "pages": 3
  }
}
```

---

#### GET /api/admin/network/status
**Purpose:** Real-time network device status
**Auth:** Admin session required

**Response:**
```json
{
  "devices": [
    {
      "macAddress": "AA:BB:CC:DD:EE:FF",
      "name": "John Doe",
      "email": "john@example.com",
      "ipAddress": "192.168.1.100",
      "hostname": "Johns-iPhone",
      "isOnline": true,
      "connectedDuration": 7200,
      "signalStrength": -45,
      "dataUsage": {
        "sent": 1048576,
        "received": 5242880
      },
      "expiresAt": "2026-01-25T10:00:00Z"
    }
  ],
  "summary": {
    "totalDevices": 3,
    "onlineDevices": 2,
    "totalBandwidth": 6291456
  }
}
```

**Process:**
1. Query Unifi API: `/api/s/{site}/stat/sta` (active clients)
2. Join with guests table (get names/emails)
3. Enrich with DPI stats (domains, bandwidth)
4. Return merged data

---

#### POST /api/admin/revoke
**Purpose:** Revoke guest access immediately
**Auth:** Admin session required

**Request:**
```json
{
  "macAddress": "AA:BB:CC:DD:EE:FF"
}
```

**Process:**
1. Call Unifi API to unauthorize MAC
2. Update DB: set expiresAt = NOW()
3. Log: admin_revoke
4. Disconnect device from network

**Response:**
```json
{
  "success": true,
  "message": "Guest access revoked"
}
```

---

#### GET /api/admin/logs
**Purpose:** Activity logs with filtering
**Auth:** Admin session required

**Query Params:**
- `type` (connect | disconnect | auth_success | auth_fail | all)
- `userId` (filter by user)
- `from` (timestamp)
- `to` (timestamp)
- `limit` (default: 100)

**Response:**
```json
{
  "logs": [
    {
      "id": "456",
      "eventType": "connect",
      "timestamp": "2026-01-18T12:30:00Z",
      "user": {
        "name": "John Doe",
        "email": "john@example.com"
      },
      "macAddress": "AA:BB:CC:DD:EE:FF",
      "ipAddress": "192.168.1.100",
      "details": {
        "ap": "Living Room AP",
        "signalStrength": -45
      }
    }
  ]
}
```

---

#### GET /api/admin/dpi?mac=AA:BB:CC:DD:EE:FF
**Purpose:** Get DPI stats (domains visited) for a device
**Auth:** Admin session required

**Response:**
```json
{
  "macAddress": "AA:BB:CC:DD:EE:FF",
  "timeframe": "24h",
  "domains": [
    {
      "domain": "google.com",
      "requests": 145,
      "bytes": 2048576
    },
    {
      "domain": "youtube.com",
      "requests": 23,
      "bytes": 52428800
    }
  ],
  "applications": [
    {
      "name": "YouTube",
      "category": "Video",
      "bytes": 52428800
    }
  ]
}
```

**Process:**
1. Query Unifi DPI API: `/api/s/{site}/stat/report/hourly.user`
2. Filter by MAC address
3. Parse and return domain stats

---

## Unifi Controller Integration

### Configuration
```bash
# .env
UNIFI_CONTROLLER_URL=https://192.168.1.1:8443
UNIFI_USERNAME=admin
UNIFI_PASSWORD=your-password
UNIFI_SITE=default
UNIFI_GUEST_ACCESS_DURATION=604800  # 7 days in seconds
```

### API Client (`lib/unifi.ts`)

```typescript
import fetch from 'node-fetch';

export class UnifiClient {
  private baseUrl: string;
  private site: string;
  private cookie: string | null = null;

  constructor(url: string, site: string) {
    this.baseUrl = url;
    this.site = site;
  }

  async login(username: string, password: string) {
    const response = await fetch(`${this.baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    this.cookie = response.headers.get('set-cookie');
    return response.json();
  }

  async authorizeGuest(macAddress: string, durationSeconds: number) {
    const response = await fetch(
      `${this.baseUrl}/proxy/network/api/s/${this.site}/cmd/stamgr`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': this.cookie,
        },
        body: JSON.stringify({
          cmd: 'authorize-guest',
          mac: macAddress,
          minutes: durationSeconds / 60,
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Unifi authorization failed');
    }

    return response.json();
  }

  async unauthorizeGuest(macAddress: string) {
    const response = await fetch(
      `${this.baseUrl}/proxy/network/api/s/${this.site}/cmd/stamgr`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': this.cookie,
        },
        body: JSON.stringify({
          cmd: 'unauthorize-guest',
          mac: macAddress,
        }),
      }
    );

    return response.json();
  }

  async getActiveClients() {
    const response = await fetch(
      `${this.baseUrl}/proxy/network/api/s/${this.site}/stat/sta`,
      {
        headers: { 'Cookie': this.cookie },
      }
    );

    const data = await response.json();
    return data.data; // Array of client objects
  }

  async getAuthorizedGuests() {
    const response = await fetch(
      `${this.baseUrl}/proxy/network/api/s/${this.site}/stat/guest`,
      {
        headers: { 'Cookie': this.cookie },
      }
    );

    const data = await response.json();
    return data.data;
  }

  async getDPIStats(macAddress?: string) {
    const endpoint = macAddress
      ? `/proxy/network/api/s/${this.site}/stat/report/hourly.user?mac=${macAddress}`
      : `/proxy/network/api/s/${this.site}/stat/dpi`;

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: { 'Cookie': this.cookie },
    });

    const data = await response.json();
    return data.data;
  }

  async getConnectionEvents(hours = 24) {
    const response = await fetch(
      `${this.baseUrl}/proxy/network/api/s/${this.site}/stat/event?within=${hours}`,
      {
        headers: { 'Cookie': this.cookie },
      }
    );

    const data = await response.json();
    // Filter for connect/disconnect events
    return data.data.filter(e =>
      ['EVT_WU_Connected', 'EVT_WU_Disconnected'].includes(e.key)
    );
  }
}

// Singleton instance
export const unifi = new UnifiClient(
  process.env.UNIFI_CONTROLLER_URL!,
  process.env.UNIFI_SITE || 'default'
);

// Initialize on app start
await unifi.login(
  process.env.UNIFI_USERNAME!,
  process.env.UNIFI_PASSWORD!
);
```

### Error Handling

**Unifi API Failures:**
- Fail fast with clear error message
- Log error details for admin
- Don't queue or retry (per decision)

```typescript
try {
  await unifi.authorizeGuest(macAddress, duration);
} catch (error) {
  // Log for admin
  console.error('Unifi authorization failed:', error);

  // Return clear error to user
  return Response.json(
    {
      error: 'Network configuration unavailable. Please try again in a moment.',
      code: 'UNIFI_UNAVAILABLE'
    },
    { status: 503 }
  );
}
```

---

## Email Service

### Configuration
```bash
# .env
EMAIL_PROVIDER=mailpit              # or 'resend'
FROM_EMAIL=wifi@worldwidewebb.co
FROM_NAME=World Wide Webb

# Mailpit (dev)
MAILPIT_HOST=localhost
MAILPIT_PORT=1025

# Resend (prod)
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

### Email Client (`lib/email.ts`)

```typescript
import nodemailer from 'nodemailer';
import { Resend } from 'resend';

const provider = process.env.EMAIL_PROVIDER || 'mailpit';

// Mailpit (dev)
const mailpitTransport = nodemailer.createTransport({
  host: process.env.MAILPIT_HOST || 'localhost',
  port: parseInt(process.env.MAILPIT_PORT || '1025'),
});

// Resend (prod)
const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendVerificationEmail(
  email: string,
  code: string,
  name: string
) {
  const subject = 'Your verification code for World Wide Webb';
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
          .code {
            font-size: 32px;
            font-family: 'Courier New', monospace;
            letter-spacing: 8px;
            text-align: center;
            padding: 20px;
            background: #000;
            color: #fff;
            border-radius: 8px;
            margin: 30px 0;
          }
          .footer { color: #666; font-size: 12px; margin-top: 40px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Welcome to World Wide Webb</h1>
          <p>Hi ${name},</p>
          <p>Your verification code is:</p>
          <div class="code">${code}</div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this code, you can safely ignore this email.</p>
          <div class="footer">
            <p>World Wide Webb<br>
            <a href="https://worldwidewebb.co">worldwidewebb.co</a></p>
          </div>
        </div>
      </body>
    </html>
  `;

  if (provider === 'resend') {
    return resend.emails.send({
      from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
      to: email,
      subject,
      html,
    });
  } else {
    return mailpitTransport.sendMail({
      from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
      to: email,
      subject,
      html,
    });
  }
}

export async function sendAdminNotification(guest: {
  name: string;
  email: string;
  macAddress: string;
  ipAddress: string;
  authorizedAt: Date;
  expiresAt: Date;
}) {
  const subject = 'New guest connected to World Wide Webb';
  const html = `
    <!DOCTYPE html>
    <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <h2>New Guest Authorization</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-weight: 600;">Name:</td>
              <td style="padding: 8px 0;">${guest.name}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: 600;">Email:</td>
              <td style="padding: 8px 0;">${guest.email}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: 600;">MAC Address:</td>
              <td style="padding: 8px 0; font-family: monospace;">${guest.macAddress}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: 600;">IP Address:</td>
              <td style="padding: 8px 0; font-family: monospace;">${guest.ipAddress}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: 600;">Authorized:</td>
              <td style="padding: 8px 0;">${guest.authorizedAt.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: 600;">Expires:</td>
              <td style="padding: 8px 0;">${guest.expiresAt.toLocaleString()}</td>
            </tr>
          </table>
          <p style="margin-top: 30px;">
            <a href="${process.env.BETTER_AUTH_URL}/admin/guests"
               style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View in Admin Panel
            </a>
          </p>
        </div>
      </body>
    </html>
  `;

  const adminEmail = process.env.ADMIN_EMAIL!;

  if (provider === 'resend') {
    return resend.emails.send({
      from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
      to: adminEmail,
      subject,
      html,
    });
  } else {
    return mailpitTransport.sendMail({
      from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
      to: adminEmail,
      subject,
      html,
    });
  }
}
```

---

## Better Auth Configuration

### Setup (`lib/auth.ts`)

```typescript
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from './db';
import { twoFactor } from 'better-auth/plugins/two-factor';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'sqlite',
  }),

  // Email OTP for guests (passwordless)
  emailOTP: {
    enabled: true,
    expiresIn: 600, // 10 minutes
    sendVerificationOTP: async ({ email, otp, type }) => {
      if (type === 'sign-in') {
        // Guest login with 2FA code
        const user = await db.query.user.findFirst({
          where: eq(user.email, email)
        });

        await sendVerificationEmail(email, otp, user?.name || 'Guest');
      }
    },
  },

  // Email + Password for admin
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Admin is pre-verified
    sendResetPassword: async ({ user, url }) => {
      // Send password reset email to admin
      await sendPasswordResetEmail(user.email, url);
    },
  },

  // TOTP 2FA for admin
  plugins: [
    twoFactor({
      issuer: 'World Wide Webb',
      otpOptions: {
        period: 30,
        digits: 6,
      },
      skipVerificationOnSetup: false,
      backupCodeLength: 10,
      backupCodeSize: 12,
    }),
  ],

  // Session config
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update every 24 hours
  },

  // Advanced options
  advanced: {
    generateId: () => crypto.randomUUID(),
  },

  // Rate limiting (Better Auth defaults)
  rateLimit: {
    window: 60, // 1 minute
    max: 10, // 10 requests per window
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.User;
```

### Middleware (`middleware.ts`)

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from './lib/auth';

export async function middleware(req: NextRequest) {
  const session = await auth.api.getSession({
    headers: req.headers,
  });

  // Admin routes protection
  if (req.nextUrl.pathname.startsWith('/admin')) {
    // Exclude login page
    if (req.nextUrl.pathname === '/admin/login') {
      return NextResponse.next();
    }

    // Require auth
    if (!session) {
      return NextResponse.redirect(new URL('/admin/login', req.url));
    }

    // Require admin role
    if (session.user.role !== 'admin') {
      return NextResponse.redirect(new URL('/', req.url));
    }

    // Force TOTP setup if not enabled
    if (
      !session.user.twoFactorEnabled &&
      req.nextUrl.pathname !== '/admin/setup-2fa'
    ) {
      return NextResponse.redirect(new URL('/admin/setup-2fa', req.url));
    }
  }

  // Guest portal routes
  if (req.nextUrl.pathname.startsWith('/portal')) {
    if (!session) {
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/portal/:path*'],
};
```

---

## UI/UX Design

### Design System

**Colors:**
```typescript
// tailwind.config.ts
export default {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#000000',      // Pure black
        foreground: '#ffffff',      // Pure white
        muted: {
          DEFAULT: '#171717',       // zinc-900
          foreground: '#a1a1aa',    // zinc-400
        },
        border: '#27272a',          // zinc-800
        input: '#27272a',           // zinc-800
      },
    },
  },
};
```

**Typography:**
```typescript
// app/layout.tsx
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`dark ${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans bg-black text-white antialiased">
        {children}
      </body>
    </html>
  );
}
```

### Component Standards

**Input Fields:**
```tsx
<Input
  type="email"
  name="email"
  id="email"
  autoComplete="email"
  placeholder="your@email.com"
  className="bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-zinc-700 focus:ring-0"
/>
```

**Buttons:**
```tsx
<Button className="w-full bg-white text-black hover:bg-zinc-200">
  Continue
</Button>
```

**2FA Code Input (1Password-friendly):**
```tsx
<Input
  type="text"
  inputMode="numeric"
  pattern="[0-9]*"
  maxLength={6}
  autoComplete="one-time-code"  // iOS + 1Password auto-fill
  placeholder="000000"
  className="text-center text-2xl tracking-widest font-mono"
/>
```

### Page Layouts

**Centered Layout (Guest Portal):**
```tsx
<div className="min-h-screen bg-black flex items-center justify-center p-4">
  <div className="w-full max-w-md space-y-8">
    {/* Content */}
  </div>
</div>
```

**Admin Dashboard:**
```tsx
<div className="min-h-screen bg-black">
  <nav className="border-b border-zinc-800">
    {/* Navigation */}
  </nav>
  <main className="max-w-7xl mx-auto p-6">
    {/* Dashboard content */}
  </main>
</div>
```

### shadcn Components

**Required Components:**
```bash
npx shadcn@latest add button
npx shadcn@latest add input
npx shadcn@latest add label
npx shadcn@latest add card
npx shadcn@latest add table
npx shadcn@latest add badge
npx shadcn@latest add separator
npx shadcn@latest add dialog
npx shadcn@latest add dropdown-menu
npx shadcn@latest add checkbox
npx shadcn@latest add toast
```

---

## Admin Panel Features

### Dashboard (`/admin`)

**Overview Cards:**
- Active Guests (online now)
- Total Authorized Guests
- Pending Verifications
- Total Bandwidth (24h)

**Live Device List:**
- Table with: Name, Email, MAC, IP, Status (online/offline), Expires, Signal, Actions
- Refresh every 30s (polling)
- Actions: View Details, Kick, Extend (manual)

**Recent Activity:**
- Last 10 connection/disconnection events
- Link to full logs

### Guest Management (`/admin/guests`)

**Features:**
- Search by name/email/MAC
- Filter: Active | Expired | All
- Sort by: Name, Email, Authorized Date, Expiry
- Bulk actions: Revoke selected, Export CSV

**Guest Detail Modal:**
- All MACs for this user (devices)
- Connection history
- Bandwidth usage (chart)
- Domains visited (DPI)
- Auth count (how many times re-verified)
- Actions: Revoke, Manually extend, Delete

### Network Monitoring (`/admin/network`)

**Real-time View (30s polling):**
- List of all active clients (even non-guests)
- Highlight authorized vs unauthorized
- Show signal strength, data usage, connected AP
- Filter by guest/non-guest

**DPI Stats:**
- Top domains accessed
- Top applications (YouTube, Netflix, etc.)
- Bandwidth by category

### Activity Logs (`/admin/logs`)

**Filters:**
- Event type: Connect, Disconnect, Auth Success, Auth Fail, Admin Action
- Date range picker
- User search
- Export to CSV

**Log Entry Details:**
- Timestamp
- Event type
- User (name + email)
- MAC address
- IP address
- Details (AP name, signal, etc.)

### Admin Settings (`/admin/settings`)

**Change Password:**
- Current password
- New password
- Confirm password

**TOTP Management:**
- View backup codes
- Regenerate backup codes
- Disable 2FA (requires password confirmation)

**Notification Preferences:**
- Toggle: New guest notifications
- Email digest frequency (future)

---

## Guest Self-Service Portal

### Dashboard (`/portal`)

**Overview:**
- Welcome message with name
- Connection status (Connected / Disconnected)
- Time remaining (5 days 3 hours)
- Data used (145 MB)

**Your Devices:**
- List of authorized MACs
- Device nickname (editable)
- Last seen timestamp
- Status (online/offline)

**Usage Statistics:**
- Bandwidth chart (last 7 days)
- Total data consumed
- Average session duration

### Device Management (`/portal/devices`)

**Features:**
- List all devices (MACs) for this user
- Add nickname to devices ("John's iPhone")
- View connection history per device
- Request more time (sends email to admin)

---

## Edge Case Handling

### 1. Email Resend Flow

**UI State:**
```tsx
const [countdown, setCountdown] = useState(30);
const [resendCount, setResendCount] = useState(0);

useEffect(() => {
  if (countdown > 0) {
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }
}, [countdown]);

return (
  <Button
    disabled={countdown > 0 || resendCount >= 3}
    onClick={handleResend}
  >
    {countdown > 0
      ? `Resend in ${countdown}s`
      : resendCount >= 3
      ? 'Too many attempts'
      : 'Resend code'
    }
  </Button>
);
```

**Rate Limits:**
- 30 second cooldown
- Max 3 resends per hour per email
- API enforces limits

### 2. Wrong Email / Edit Flow

**UI:**
```tsx
<div className="flex items-center justify-between">
  <span className="text-sm text-zinc-400">
    Sent to: {email}
  </span>
  <Button
    variant="ghost"
    size="sm"
    onClick={() => router.back()}
  >
    Edit
  </Button>
</div>
```

**State Preservation:**
- Store email in URL param: `/verify?email=user@example.com`
- Back button returns to landing with email pre-filled
- Don't lose name field data

### 3. Invalid 2FA Code

**Handling:**
```typescript
// API
const attempts = await getCodeAttempts(email, code);
if (attempts >= 3) {
  // Invalidate code, require new one
  await invalidateCode(code);
  return { error: 'Too many attempts. Request a new code.' };
}

// Increment attempts
await incrementAttempts(email, code);
return { error: 'Invalid code. Try again.' };
```

**UI Feedback:**
```tsx
{error && (
  <p className="text-sm text-red-500">
    {error}
  </p>
)}
```

### 4. Code Expiry

**Check on Submit:**
```typescript
if (Date.now() > code.expiresAt.getTime()) {
  return {
    error: 'Code expired. Please request a new one.',
    expired: true
  };
}
```

**UI:**
```tsx
{error.expired && (
  <div>
    <p className="text-sm text-red-500">{error.message}</p>
    <Button onClick={requestNewCode}>
      Get new code
    </Button>
  </div>
)}
```

### 5. MAC Address Randomization

**Detection:**
- iOS/Android randomize MACs
- User accumulates multiple MACs
- DB tracks all MACs per user

**Handling:**
- No limit on MACs per user (per decision)
- Guest dashboard shows all devices
- Admin sees all MACs for a user
- Auto-cleanup: Delete MACs not seen in 30+ days (optional)

### 6. MAC Not Detected

**Fallback:**
```typescript
const macFromUrl = searchParams.get('id');
const macFromUnifi = await unifi.getClientByIP(req.ip);

const macAddress = macFromUrl || macFromUnifi || null;

if (!macAddress) {
  return (
    <div>
      <p>Please ensure you're connected to world-wide-webb network</p>
    </div>
  );
}
```

### 7. Already Authorized

**Fast Path:**
```typescript
// Check on portal load
const guest = await db.query.guests.findFirst({
  where: and(
    eq(guests.macAddress, macAddress),
    gt(guests.expiresAt, new Date())
  )
});

if (guest) {
  // Skip auth, redirect to success
  redirect('/success?returning=true');
}
```

**UI:**
```tsx
// /success?returning=true
{searchParams.get('returning') ? (
  <h1>Welcome back!</h1>
) : (
  <h1>Welcome to the World Wide Webb!</h1>
)}
```

### 8. Unifi API Failure

**Error Handling:**
```typescript
try {
  await unifi.authorizeGuest(macAddress, duration);
} catch (error) {
  console.error('Unifi error:', error);

  // Fail fast (per decision)
  return Response.json(
    {
      error: 'Network unavailable. Please try again shortly.',
      code: 'UNIFI_DOWN'
    },
    { status: 503 }
  );
}
```

**UI:**
```tsx
<div className="text-center space-y-4">
  <p className="text-red-500">
    Network configuration temporarily unavailable
  </p>
  <Button onClick={() => router.refresh()}>
    Try Again
  </Button>
</div>
```

### 9. Database Inconsistency

**Sync Job (Background):**
```typescript
// Run every 5 minutes
setInterval(async () => {
  // Get authorized guests from Unifi
  const unifiGuests = await unifi.getAuthorizedGuests();
  const unifiMacs = new Set(unifiGuests.map(g => g.mac));

  // Get guests from DB that should be authorized
  const dbGuests = await db.query.guests.findMany({
    where: gt(guests.expiresAt, new Date())
  });

  // Find mismatches
  for (const guest of dbGuests) {
    if (!unifiMacs.has(guest.macAddress)) {
      // DB says yes, Unifi says no
      // Re-authorize on Unifi
      await unifi.authorizeGuest(guest.macAddress, /* remaining time */);
      console.log('Re-authorized:', guest.macAddress);
    }
  }
}, 5 * 60 * 1000);
```

### 10. Session Hijacking

**Mitigation:**
```typescript
// Bind session to IP (optional, can break mobile)
session: {
  updateAge: 60 * 60 * 24, // Update daily
  // Optionally: validate IP on each request
}

// Better Auth handles:
// - CSRF tokens
// - Secure cookies
// - HTTPOnly cookies
```

### 11. iOS Captive Portal Browser

**Detection:**
```typescript
const userAgent = req.headers.get('user-agent');
const isCaptivePortal = userAgent?.includes('CaptiveNetworkSupport');

if (isCaptivePortal) {
  // Auto-close after success
  // Don't set long-lived session (won't persist)
}
```

**Success Page:**
```tsx
{isCaptivePortal && (
  <p className="text-sm text-zinc-400">
    You can now close this window
  </p>
)}
```

### 12. Disposable Email

**Block List (Optional):**
```typescript
// lib/disposable-domains.ts
export const disposableDomains = [
  '10minutemail.com',
  'guerrillamail.com',
  'tempmail.com',
  // ... hundreds more
];

// Validation
const domain = email.split('@')[1];
if (disposableDomains.includes(domain)) {
  return { error: 'Disposable email addresses not allowed' };
}
```

**Alternative:** Allow but flag for admin review

### 13. Multiple Tabs Open

**Sync with BroadcastChannel:**
```typescript
// Client-side
const channel = new BroadcastChannel('auth_channel');

// When verified in one tab
channel.postMessage({ type: 'verified' });

// Other tabs listen
channel.onmessage = (event) => {
  if (event.data.type === 'verified') {
    router.push('/success');
  }
};
```

### 14. Access Expires While Online

**Unifi Behavior:**
- Automatically disconnects user
- Portal can't prevent this

**Grace Period (Optional):**
- Authorize for 7 days + 1 hour
- DB shows 7 days
- Gives slight buffer

**Email Reminder:**
```typescript
// Cron job: Daily at 9am
async function sendExpiryReminders() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const expiringGuests = await db.query.guests.findMany({
    where: and(
      lt(guests.expiresAt, tomorrow),
      gt(guests.expiresAt, new Date())
    )
  });

  for (const guest of expiringGuests) {
    await sendExpiryReminderEmail(guest);
  }
}
```

---

## Rate Limiting

### Better Auth Defaults

**Email OTP:**
- 5 requests per hour per email
- 10 requests per hour per IP

**Login:**
- 5 failed attempts per 15 minutes per email
- 10 failed attempts per 15 minutes per IP

### Custom Rate Limits

**2FA Code Verification:**
```typescript
// 3 wrong codes = invalidate code
const attempts = await getAttempts(email, code);
if (attempts >= 3) {
  await invalidateCode(code);
  return { error: 'Too many attempts. Request new code.' };
}
```

**Resend Code:**
```typescript
// 30 second cooldown
const lastSent = await getLastSentTime(email);
if (Date.now() - lastSent < 30000) {
  return { error: 'Please wait before requesting another code' };
}

// Max 3 per hour
const hourlyCount = await getHourlyResendCount(email);
if (hourlyCount >= 3) {
  return { error: 'Too many resend attempts. Try again later.' };
}
```

**Implementation:**
```typescript
// lib/rate-limit.ts
export async function checkRateLimit(
  identifier: string,
  action: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; resetAt?: Date }> {
  const record = await db.query.rate_limits.findFirst({
    where: and(
      eq(rate_limits.identifier, identifier),
      eq(rate_limits.action, action)
    )
  });

  const now = Date.now();

  if (!record) {
    // First attempt
    await db.insert(rate_limits).values({
      identifier,
      action,
      attempts: 1,
      lastAttempt: new Date(),
    });
    return { allowed: true };
  }

  // Check if locked
  if (record.lockedUntil && now < record.lockedUntil.getTime()) {
    return {
      allowed: false,
      resetAt: record.lockedUntil
    };
  }

  // Check window
  const windowStart = now - windowMs;
  if (record.lastAttempt.getTime() < windowStart) {
    // Reset window
    await db.update(rate_limits)
      .set({ attempts: 1, lastAttempt: new Date() })
      .where(eq(rate_limits.id, record.id));
    return { allowed: true };
  }

  // Within window
  if (record.attempts >= limit) {
    // Lock
    const lockUntil = new Date(now + windowMs);
    await db.update(rate_limits)
      .set({ lockedUntil: lockUntil })
      .where(eq(rate_limits.id, record.id));
    return { allowed: false, resetAt: lockUntil };
  }

  // Increment
  await db.update(rate_limits)
    .set({
      attempts: record.attempts + 1,
      lastAttempt: new Date()
    })
    .where(eq(rate_limits.id, record.id));

  return { allowed: true };
}
```

---

## Activity Logging

### Event Types

```typescript
enum EventType {
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  AUTH_SUCCESS = 'auth_success',
  AUTH_FAIL = 'auth_fail',
  ADMIN_REVOKE = 'admin_revoke',
  ADMIN_EXTEND = 'admin_extend',
  CODE_SENT = 'code_sent',
  CODE_RESENT = 'code_resent',
}
```

### Log Function

```typescript
// lib/logger.ts
export async function logActivity(
  eventType: EventType,
  data: {
    userId?: string;
    macAddress?: string;
    ipAddress?: string;
    details?: Record<string, any>;
  }
) {
  await db.insert(activity_logs).values({
    eventType,
    userId: data.userId,
    macAddress: data.macAddress,
    ipAddress: data.ipAddress,
    details: JSON.stringify(data.details || {}),
  });
}
```

### Connection Event Sync

**Background Job (Every 1 minute):**
```typescript
let lastSync = Date.now();

setInterval(async () => {
  const events = await unifi.getConnectionEvents(1); // Last 1 hour

  for (const event of events) {
    const eventTime = new Date(event.time);
    if (eventTime <= new Date(lastSync)) continue; // Already logged

    // Find guest by MAC
    const guest = await db.query.guests.findFirst({
      where: eq(guests.macAddress, event.client_mac)
    });

    if (guest) {
      await logActivity(
        event.key === 'EVT_WU_Connected' ? 'connect' : 'disconnect',
        {
          userId: guest.userId,
          macAddress: event.client_mac,
          ipAddress: event.client_ip,
          details: {
            ap: event.ap_name,
            ssid: event.ssid,
            signalStrength: event.rssi,
          }
        }
      );

      // Update lastSeen
      await db.update(guests)
        .set({ lastSeen: eventTime })
        .where(eq(guests.id, guest.id));
    }
  }

  lastSync = Date.now();
}, 60 * 1000);
```

### DPI Logging (Optional)

**Sync Domain Stats (Every 5 minutes):**
```typescript
setInterval(async () => {
  const activeGuests = await db.query.guests.findMany({
    where: gt(guests.expiresAt, new Date())
  });

  for (const guest of activeGuests) {
    const dpiStats = await unifi.getDPIStats(guest.macAddress);

    // Parse top domains
    const domains = dpiStats.by_app.map(app => ({
      domain: app.app,
      bytes: app.tx_bytes + app.rx_bytes,
    }));

    // Save to network_stats
    await db.insert(network_stats).values({
      macAddress: guest.macAddress,
      bytesReceived: dpiStats.rx_bytes,
      bytesSent: dpiStats.tx_bytes,
      domains: JSON.stringify(domains),
    });
  }
}, 5 * 60 * 1000);
```

---

## Environment Variables

### Complete `.env` File

```bash
# App
NODE_ENV=development
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=generate-a-long-random-string-here

# Database
DATABASE_URL=file:./data/captive-portal.db

# Admin User (for seeding)
ADMIN_EMAIL=calumpeterwebb@icloud.com
ADMIN_PASSWORD=change-on-first-login

# Unifi Controller
UNIFI_CONTROLLER_URL=https://192.168.1.1:8443
UNIFI_USERNAME=admin
UNIFI_PASSWORD=your-unifi-password
UNIFI_SITE=default

# Guest Network Config
WIFI_SSID=world-wide-webb
GUEST_ACCESS_DURATION=604800  # 7 days in seconds

# Email Service
EMAIL_PROVIDER=mailpit                    # or 'resend'
FROM_EMAIL=wifi@worldwidewebb.co
FROM_NAME=World Wide Webb

# Mailpit (dev)
MAILPIT_HOST=localhost
MAILPIT_PORT=1025

# Resend (prod)
RESEND_API_KEY=re_xxxxxxxxxxxxx

# Admin Notifications
ADMIN_NOTIFY_EMAIL=calumpeterwebb@icloud.com
ENABLE_ADMIN_NOTIFICATIONS=true

# Rate Limiting
RESEND_COOLDOWN=30                        # seconds
MAX_RESENDS_PER_HOUR=3
MAX_2FA_ATTEMPTS=3

# Logging
LOG_LEVEL=info
```

---

## Setup & Deployment

### Prerequisites

- Node.js 18+
- pnpm (or npm/yarn)
- Git (for version control and hooks)
- Unifi Controller with admin access
- SMTP service (Mailpit for dev, Resend for prod)

### Installation

```bash
# Clone repository
git clone <repo-url>
cd world-wide-webb-portal

# Install dependencies (includes git hooks via 'prepare' script)
pnpm install

# Install shadcn components
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button input label card table badge separator dialog dropdown-menu checkbox toast

# Setup database and admin user
pnpm setup

# Start development server
pnpm dev
```

**Note:** Git hooks are automatically installed via the `prepare` script when you run `pnpm install`. The pre-commit hook will automatically format and lint your code before each commit.

### Git Hooks & Code Quality

**Setup Husky + lint-staged for automatic formatting:**

```bash
# Install development dependencies
pnpm add -D husky lint-staged prettier eslint-config-prettier

# Initialize Husky
pnpm exec husky init

# Create pre-commit hook
echo "pnpm lint-staged" > .husky/pre-commit
chmod +x .husky/pre-commit
```

**Configuration Files:**

**`.prettierrc`**
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "endOfLine": "lf"
}
```

**`.prettierignore`**
```
node_modules
.next
dist
build
coverage
*.md
pnpm-lock.yaml
package-lock.json
data/
```

**`package.json` (add lint-staged config):**
```json
{
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": [
      "prettier --write",
      "eslint --fix"
    ],
    "*.{json,css,md}": [
      "prettier --write"
    ]
  }
}
```

**What the pre-commit hook does:**
- Runs Prettier to format code
- Runs ESLint to fix linting issues
- Only on staged files (fast)
- Blocks commit if errors remain

**Manual formatting commands:**
```bash
# Format all files
pnpm prettier --write .

# Check formatting
pnpm prettier --check .

# Lint all files
pnpm lint

# Fix linting issues
pnpm lint --fix
```

### Scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "db:migrate": "tsx scripts/migrate.ts",
    "db:seed": "tsx scripts/seed-admin.ts",
    "setup": "pnpm install && pnpm db:migrate && pnpm db:seed",
    "docker:build": "docker build -t world-wide-webb-portal .",
    "docker:up": "docker compose up -d",
    "docker:down": "docker compose down",
    "lint": "next lint",
    "lint:fix": "next lint --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "type-check": "tsc --noEmit",
    "prepare": "husky"
  }
}
```

### Database Migration (`scripts/migrate.ts`)

```typescript
import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

async function migrate() {
  console.log('Running database migrations...');

  // Create tables (using Drizzle schema)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS user (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      emailVerified BOOLEAN DEFAULT 0,
      name TEXT,
      password TEXT,
      role TEXT NOT NULL,
      twoFactorEnabled BOOLEAN DEFAULT 0,
      twoFactorSecret TEXT,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ... create other tables ...

  console.log('✓ Database migrated successfully');
}

migrate().catch(console.error);
```

### Admin Seeding (`scripts/seed-admin.ts`)

```typescript
import { auth } from '../lib/auth';
import crypto from 'crypto';

async function seedAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.error('X Missing ADMIN_EMAIL or ADMIN_PASSWORD in .env');
    process.exit(1);
  }

  try {
    await auth.api.signUpEmail({
      body: {
        email: adminEmail,
        password: adminPassword,
        name: 'Admin',
        role: 'admin',
        emailVerified: true,
      }
    });

    console.log('✓ Admin user created:', adminEmail);
    console.log('  Login at:', process.env.BETTER_AUTH_URL + '/admin/login');
    console.log('  You will be prompted to setup TOTP on first login');

  } catch (error) {
    if (error.message?.includes('already exists')) {
      console.log('i Admin user already exists');
    } else {
      console.error('X Failed to create admin:', error);
      process.exit(1);
    }
  }
}

seedAdmin();
```

### Docker Setup

**Dockerfile:**
```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM node:18-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package.json .
COPY --from=builder /app/pnpm-lock.yaml .
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts

RUN npm install -g pnpm

EXPOSE 3000

CMD ["sh", "-c", "pnpm db:migrate && pnpm start"]
```

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    volumes:
      - ./data:/app/data  # SQLite persistence
    restart: unless-stopped
    depends_on:
      - mailpit

  mailpit:
    image: axllent/mailpit:latest
    ports:
      - "1025:1025"  # SMTP
      - "8025:8025"  # Web UI
    restart: unless-stopped
```

**Start with Docker:**
```bash
# Build and start
docker compose up -d

# View logs
docker compose logs -f app

# Stop
docker compose down
```

---

## Unifi Controller Configuration

### Enable External Portal

1. Login to Unifi Controller
2. Settings → Guest Control
3. Enable Guest Portal
4. Portal Type: **External Portal Server**
5. Redirect URL: `http://[HOMELAB-IP]:3000`
6. Redirect HTTPS: `No` (or setup reverse proxy)
7. Authentication: **None** (portal handles it)
8. Save

### Guest Network Settings

1. Networks → Create New Network
2. Name: `world-wide-webb`
3. Purpose: **Guest**
4. VLAN ID: (optional, e.g., 10)
5. Guest Policy:
   - Pre-Authorization Access: **None**
   - Post-Authorization Restrictions: **None** (or customize)
6. Apply to WiFi network: `world-wide-webb`

### Test Captive Portal

1. Connect to `world-wide-webb` on phone
2. Should auto-redirect to portal
3. If not, open browser → any HTTP site (e.g., http://example.com)

---

## Testing Strategy

### Unit Tests

```typescript
// __tests__/lib/auth.test.ts
describe('Guest Authentication', () => {
  it('generates 6-digit code', () => {
    const code = generateVerificationCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it('validates code expiry', () => {
    const code = { expiresAt: new Date(Date.now() - 1000) };
    expect(isCodeExpired(code)).toBe(true);
  });
});

// __tests__/lib/unifi.test.ts
describe('Unifi Client', () => {
  it('authorizes guest on network', async () => {
    const result = await unifi.authorizeGuest('AA:BB:CC:DD:EE:FF', 604800);
    expect(result.success).toBe(true);
  });
});
```

### Integration Tests

```typescript
// __tests__/api/guest.test.ts
describe('POST /api/guest/verify-email', () => {
  it('sends verification code to valid email', async () => {
    const response = await fetch('/api/guest/verify-email', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        name: 'Test User',
        macAddress: 'AA:BB:CC:DD:EE:FF',
        agreedToTerms: true,
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  it('enforces rate limiting', async () => {
    // Send 6 requests
    for (let i = 0; i < 6; i++) {
      await fetch('/api/guest/verify-email', { ... });
    }

    const response = await fetch('/api/guest/verify-email', { ... });
    expect(response.status).toBe(429);
  });
});
```

### E2E Tests (Playwright)

```typescript
// __tests__/e2e/guest-flow.spec.ts
test('guest can authenticate and access network', async ({ page }) => {
  await page.goto('/?id=AA:BB:CC:DD:EE:FF');

  // Fill form
  await page.fill('[name="name"]', 'Test User');
  await page.fill('[name="email"]', 'test@example.com');
  await page.check('[name="agreedToTerms"]');
  await page.click('button[type="submit"]');

  // Check email sent
  await page.waitForURL('**/verify?email=test@example.com');

  // Get code from Mailpit
  const code = await getCodeFromMailpit('test@example.com');

  // Enter code
  await page.fill('[name="code"]', code);
  await page.click('button[type="submit"]');

  // Success
  await page.waitForURL('**/success');
  await expect(page.locator('h1')).toContainText('Welcome');
});
```

---

## Monitoring & Observability

### Health Checks

**Endpoint: `GET /api/health`**
```typescript
export async function GET() {
  const checks = {
    database: false,
    unifi: false,
    email: false,
  };

  try {
    // Check database
    await db.execute(sql`SELECT 1`);
    checks.database = true;
  } catch (e) {
    console.error('DB health check failed:', e);
  }

  try {
    // Check Unifi
    await unifi.getActiveClients();
    checks.unifi = true;
  } catch (e) {
    console.error('Unifi health check failed:', e);
  }

  try {
    // Check email (test connection)
    await emailClient.verify();
    checks.email = true;
  } catch (e) {
    console.error('Email health check failed:', e);
  }

  const healthy = Object.values(checks).every(Boolean);

  return Response.json(
    { healthy, checks },
    { status: healthy ? 200 : 503 }
  );
}
```

### Logging

**Structured Logging:**
```typescript
// lib/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  },
});

// Usage
logger.info({ userId, macAddress }, 'Guest authorized');
logger.error({ error, macAddress }, 'Unifi authorization failed');
```

### Metrics (Optional)

**Prometheus Endpoint: `GET /api/metrics`**
```typescript
export async function GET() {
  const metrics = {
    guests_total: await db.select({ count: sql`count(*)` }).from(guests),
    guests_active: await db.select({ count: sql`count(*)` })
      .from(guests)
      .where(gt(guests.expiresAt, new Date())),
    auth_attempts_24h: await db.select({ count: sql`count(*)` })
      .from(activity_logs)
      .where(
        and(
          eq(activity_logs.eventType, 'auth_success'),
          gt(activity_logs.createdAt, new Date(Date.now() - 86400000))
        )
      ),
  };

  return Response.json(metrics);
}
```

---

## Security Considerations

### Checklist

- [x] HTTPS (via reverse proxy for production)
- [x] CSRF protection (Better Auth)
- [x] Rate limiting (API + Better Auth)
- [x] Input validation (Zod schemas)
- [x] SQL injection prevention (Drizzle ORM parameterized queries)
- [x] XSS prevention (React auto-escaping)
- [x] Session security (HTTPOnly cookies, Better Auth)
- [x] Password hashing (Better Auth bcrypt)
- [x] TOTP for admin (Better Auth two-factor plugin)
- [x] Email verification (2FA codes)
- [x] Secrets in .env (never committed)

### Production Recommendations

1. **Reverse Proxy (Caddy/Nginx):**
   ```nginx
   server {
     listen 443 ssl http2;
     server_name portal.worldwidewebb.co;

     ssl_certificate /path/to/cert.pem;
     ssl_certificate_key /path/to/key.pem;

     location / {
       proxy_pass http://localhost:3000;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
     }
   }
   ```

2. **Firewall Rules:**
   - Allow port 3000 only from guest VLAN
   - Or use reverse proxy on port 443

3. **Backup Strategy:**
   - Daily SQLite backups: `cp data/captive-portal.db backups/`
   - Backup .env securely
   - Document Unifi config

4. **Monitoring:**
   - Uptime monitoring (UptimeRobot)
   - Health check endpoint
   - Admin email alerts on errors

---

## Future Enhancements

### Phase 2 Features
- [ ] Guest bandwidth throttling
- [ ] Custom landing page per SSID
- [ ] Multi-language support
- [ ] SMS 2FA (Twilio)
- [ ] Social login (Google, Apple)

### Phase 3 Features
- [ ] Guest voucher system (print codes)
- [ ] QR code for easy connection
- [ ] Analytics dashboard (charts, trends)
- [ ] API for third-party integrations
- [ ] Mobile app (React Native)

### Phase 4 Features
- [ ] Multi-site support (multiple locations)
- [ ] White-label customization
- [ ] Billing integration (Stripe)
- [ ] Advanced DPI filtering
- [ ] Guest feedback system

---

## Troubleshooting

### Common Issues

**1. Captive Portal Not Redirecting**
- Check Unifi Guest Portal settings
- Ensure redirect URL is correct
- Try HTTP site (not HTTPS)
- Disable VPN on device

**2. Email Not Sending**
- Check Mailpit is running: `docker compose ps`
- Verify SMTP settings in .env
- Check logs: `docker compose logs app`
- For Resend: Verify API key

**3. Unifi API Errors**
- Verify controller URL and credentials
- Check controller is accessible from homelab
- Test with: `curl -k https://192.168.1.1:8443`
- Ensure API user has admin permissions

**4. Database Locked**
- Stop app: `docker compose down`
- Enable WAL mode: `sqlite3 data/captive-portal.db "PRAGMA journal_mode=WAL;"`
- Restart: `docker compose up -d`

**5. TOTP Setup Not Working**
- Ensure time is synced on server: `timedatectl`
- Check Better Auth TOTP config
- Try backup codes if locked out

---

## Support & Documentation

**Official Docs:**
- Next.js: https://nextjs.org/docs
- Better Auth: https://www.better-auth.com/docs
- shadcn/ui: https://ui.shadcn.com
- Unifi API: https://ubntwiki.com/products/software/unifi-controller/api

**Project Repository:**
- GitHub: [repo-url]
- Issues: [repo-url]/issues
- Discussions: [repo-url]/discussions

**Contact:**
- Admin: calumpeterwebb@icloud.com
- Website: https://worldwidewebb.co

---

## Appendix

### Decision Log

| Decision | Rationale |
|----------|-----------|
| No WiFi password gate | Email verification is sufficient security |
| Unified Better Auth | Single auth system, cleaner architecture |
| Passwordless for guests | Simpler UX, more secure than weak passwords |
| TOTP for admin | Industry standard, secure 2FA |
| 7-day access | Balance convenience and security |
| Keep data forever | Analytics, easy returns, minimal storage cost |
| Unlimited devices | Family-friendly, matches home use case |
| Fail fast on Unifi errors | Clear errors better than hanging |
| Polling vs WebSockets | Simpler for home network scale |
| Black UI | Brand aesthetic, modern minimal |

### API Rate Limits Summary

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/guest/verify-email` | 5 per email | 1 hour |
| `/api/guest/verify-code` | 3 attempts per code | 10 min |
| `/api/guest/resend-code` | 3 per email | 1 hour |
| `/api/guest/resend-code` | 30s cooldown | Per request |
| Admin APIs | Better Auth defaults | - |

### Database Size Estimates

**Assumptions:**
- 100 guests over time
- Average 2 devices per guest
- 30 days activity logs
- DPI stats every 5 min

**Estimated Size:**
- guests: ~200 rows × 500 bytes = 100 KB
- activity_logs: ~10K rows × 300 bytes = 3 MB
- network_stats: ~100K rows × 200 bytes = 20 MB
- **Total: ~25 MB after 1 month**

### Color Reference

| Usage | Color | Tailwind Class |
|-------|-------|----------------|
| Background | #000000 | bg-black |
| Text | #FFFFFF | text-white |
| Muted BG | #171717 | bg-zinc-900 |
| Muted Text | #A1A1AA | text-zinc-400 |
| Border | #27272A | border-zinc-800 |
| Input BG | #09090B | bg-zinc-950 |
| Placeholder | #52525B | placeholder:text-zinc-600 |

---

**End of PRD**

_Last Updated: 2026-01-18_
_Version: 1.0_
_Author: Claude Code_
