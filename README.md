# World Wide Webb - Guest WiFi Captive Portal

Modern, passwordless captive portal for home network guest WiFi authentication with unified admin management.

## Features

### Guest Experience
- **Passwordless Authentication**: Email + 6-digit verification code (no password needed)
- **7-Day Access**: Automatic network authorization for one week (renewable)
- **Self-Service Dashboard**: View devices, connection status, and data usage
- **Multiple Devices**: Unlimited device support per guest

### Admin Features
- **Secure Authentication**: Email + password + TOTP 2FA (Google Authenticator/Authy)
- **Real-Time Monitoring**: Live device list with 30-second polling
- **Guest Management**: View, search, filter, revoke, or extend guest access
- **Activity Logging**: Complete audit trail of all authentication and connection events
- **Network Analytics**: DPI stats, bandwidth usage, and domain tracking via Unifi integration

### Technical Highlights
- **Next.js 14** (App Router) with TypeScript
- **Better Auth** for unified guest + admin authentication
- **SQLite** with Drizzle ORM for zero-config database
- **Unifi Controller API** for network device authorization
- **Dark Mode UI** with Apple-style minimal aesthetic (Tailwind + shadcn/ui)
- **Docker Support** with docker-compose for easy deployment
- **Auto-Formatting** via Husky git hooks (Prettier + ESLint)

## Quick Start

### Prerequisites
- Node.js 20+ and pnpm
- Unifi Controller (for network integration)
- SMTP server (Mailpit for dev, Resend for prod)

### Installation

```bash
# Install dependencies
pnpm install

# Setup database and admin user
pnpm setup

# Start development server
pnpm dev
```

The setup command will:
1. Generate and run database migrations
2. Create an admin user (admin@example.com / admin123)
3. Prompt for TOTP setup on first admin login

### Environment Variables

**Option 1: Generate Secrets Automatically (Recommended)**

Use the secrets generator script for a guided setup with secure random secrets:

```bash
# Interactive mode - prompts for configuration
pnpm generate-secrets

# Automatic mode - generates all secrets without prompting
pnpm generate-secrets:auto

# Generate secrets for production
pnpm generate-secrets --output .env.production
```

The script will:
- Generate a cryptographically secure `BETTER_AUTH_SECRET` (32+ characters)
- Generate a strong random admin password (or prompt for your own)
- Guide you through Unifi and email configuration
- Create a ready-to-use `.env` file with proper formatting

**Option 2: Manual Configuration**

Copy `.env.example` to `.env.local` and configure:

```bash
# Auth
BETTER_AUTH_SECRET=your-secret-min-32-chars
BETTER_AUTH_URL=http://localhost:3000

# Admin Credentials
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your-secure-password

# Unifi Controller
UNIFI_CONTROLLER_URL=https://your-unifi-controller:8443
UNIFI_USERNAME=your-username
UNIFI_PASSWORD=your-password
UNIFI_SITE=default
UNIFI_SKIP_SSL_VERIFY=true

# Email (Development)
EMAIL_PROVIDER=mailpit
SMTP_HOST=localhost
SMTP_PORT=1025

# Email (Production)
EMAIL_PROVIDER=resend
RESEND_API_KEY=your-resend-api-key
```

**Important Security Notes:**
- `BETTER_AUTH_SECRET` must be at least 32 characters for production
- Admin password should be 12+ characters with mixed case, numbers, and symbols
- Never commit `.env` or `.env.local` to version control

## Tilt Development (Recommended)

For the best development experience, use Tilt for a single-command setup with live reload:

### Prerequisites
- [Tilt](https://docs.tilt.dev/install.html) - `brew install tilt-dev/tap/tilt`
- Docker (for Mailpit)
- Node.js 20+ and pnpm

### Usage

```bash
# Start everything (Next.js dev server + Mailpit + migrations)
tilt up

# Tilt dashboard opens at http://localhost:10350
# - View real-time logs (color-coded, searchable)
# - Click links to open App (port 3000) or Mailpit UI (port 8025)
# - Click "seed-admin" button to create admin user when needed

# Make code changes → browser auto-refreshes instantly (no rebuild)

# Stop everything (data persists)
tilt down
```

### What Tilt Does
1. Starts Mailpit in Docker (email testing)
2. Runs database migrations automatically
3. Starts Next.js dev server with hot module reload
4. Provides unified dashboard with logs and quick links
5. Persists SQLite and Mailpit data across restarts

### Benefits vs docker-compose
- ⚡ **Instant feedback**: Code changes reflect immediately (no Docker rebuild)
- 🎯 **Unified UI**: All logs, status, and links in one dashboard
- 🔄 **Smart updates**: Only re-runs migrations when schema changes
- 🚀 **Faster startup**: 10-20 seconds vs 2-3 minutes for full Docker build

## Docker Deployment

```bash
# Development (with Mailpit)
docker compose -f docker-compose.dev.yml up

# Production
docker compose up -d
```

Includes:
- App container with SQLite volume persistence
- Mailpit container for email testing (dev only)
- Health checks and auto-restart

## Project Structure

```
src/
├── app/
│   ├── (guest)/              # Guest captive portal routes
│   │   ├── page.tsx          # Landing page (email entry)
│   │   ├── verify/           # Code verification
│   │   └── success/          # Welcome screen
│   ├── portal/               # Guest self-service dashboard (auth required)
│   │   ├── page.tsx          # Device status
│   │   └── devices/          # Device management
│   └── admin/                # Admin panel (admin role + TOTP required)
│       ├── login/            # Admin login
│       ├── setup-2fa/        # TOTP setup (forced on first login)
│       ├── page.tsx          # Dashboard
│       ├── guests/           # Guest management
│       ├── network/          # Network monitoring
│       ├── logs/             # Activity logs
│       └── settings/         # Admin settings
├── lib/
│   ├── auth.ts               # Better Auth configuration
│   ├── db.ts                 # Drizzle ORM + SQLite schema
│   ├── unifi.ts              # Unifi Controller client
│   ├── email.ts              # Email service (Mailpit/Resend)
│   ├── logger.ts             # Activity logging
│   ├── rate-limit.ts         # Rate limiting helper
│   ├── session.ts            # Session validation
│   ├── cron.ts               # Background sync jobs
│   └── cron-runner.ts        # Job scheduler
└── middleware.ts             # Route protection
```

## API Endpoints

### Guest APIs
- `POST /api/guest/verify-email` - Send verification code
- `POST /api/guest/verify-code` - Verify code + authorize MAC
- `POST /api/guest/resend-code` - Resend verification code
- `GET /api/guest/status` - Check authorization status

### Admin APIs (Protected)
- `GET /api/admin/guests` - List guests with pagination/filtering
- `POST /api/admin/guests/revoke` - Revoke guest access
- `POST /api/admin/guests/extend` - Extend guest authorization
- `GET /api/admin/network/status` - Real-time device list
- `GET /api/admin/activity` - Activity logs
- `GET /api/admin/stats` - Dashboard statistics
- `GET /api/admin/alerts` - Unread notifications
- `GET /api/admin/dpi` - DPI stats for device

### Monitoring
- `GET /api/health` - Health check (database, Unifi, email)
- `GET /api/metrics` - System metrics

## Database Schema

SQLite with Drizzle ORM:
- `user` - Better Auth users (guests + admin)
- `session` - Better Auth sessions
- `account` - Better Auth accounts (OAuth support)
- `verification` - Better Auth verification tokens
- `guests` - MAC authorizations linked to users
- `verification_codes` - Email 2FA codes
- `activity_logs` - Connection/auth events
- `rate_limits` - Rate limiting state
- `network_stats` - Cached DPI/bandwidth data

## Authentication Flows

### Guest Flow
1. Enter name + email on landing page
2. Receive 6-digit code via email (10 min expiry)
3. Verify code → MAC authorized on Unifi (7 days)
4. Access self-service portal to manage devices

### Admin Flow
1. Login with email + password
2. First login: forced TOTP setup (QR code + backup codes)
3. Subsequent logins require TOTP code
4. Access admin dashboard for guest/network management

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| verify-email | 5/hour per email |
| verify-code | 3 attempts per code |
| resend-code | 3/hour, 30s cooldown |

## Background Jobs

Runs via `instrumentation.ts` with setInterval:
- **Connection Sync** (1 min) - Sync Unifi client events
- **DPI Cache** (5 min) - Cache bandwidth/domain stats
- **Expiry Cleanup** (1 hour) - Clean up expired authorizations
- **Session Cleanup** (1 hour) - Remove stale sessions
- **Expiry Reminders** (1 hour) - Email guests 24h before expiry

## Development Commands

### Tilt (Recommended)
```bash
tilt up               # Start full dev environment (Mailpit + migrations + Next.js)
tilt down             # Stop all services (data persists)
```

### Manual Development
```bash
pnpm dev              # Start dev server
pnpm build            # Build for production
pnpm start            # Start production server
pnpm lint             # Check code quality
pnpm format           # Auto-format all files
pnpm test             # Run unit tests (Vitest)
pnpm test:e2e         # Run E2E tests (Playwright)
pnpm test:coverage    # Run tests with coverage
pnpm db:generate      # Generate Drizzle migrations
pnpm db:migrate       # Run migrations
pnpm db:push          # Push schema changes
pnpm db:studio        # Open Drizzle Studio
pnpm db:seed          # Create admin user
pnpm setup            # Full setup (migrate + seed)
```

## Testing

### Unit Tests (Vitest)
```bash
pnpm test              # Run all unit tests
pnpm test:ui           # Interactive test UI
pnpm test:coverage     # Run with coverage report
```

Current coverage:
- ✅ Guest authentication flow (verify-email, verify-code)
- ✅ Rate limiting enforcement
- ✅ Input sanitization and XSS prevention
- ✅ Edge cases (expired codes, Unifi failures)

**Test files**: `src/__tests__/`

### E2E Tests (Playwright)
```bash
pnpm test:e2e          # Run all E2E tests
pnpm test:e2e:ui       # Interactive UI mode
pnpm test:e2e:headed   # Run with visible browser
pnpm test:e2e:debug    # Debug mode
```

Current coverage:
- ✅ Guest signup flow (email entry, verification, success)
- ✅ Guest validation (email format, required fields)
- ✅ Rate limiting UI behavior
- ✅ Admin login form
- ✅ Admin TOTP setup
- ✅ Dashboard authentication

**Test files**: `e2e/`

See `e2e/README.md` for detailed E2E testing documentation.

## Security Features

- ✅ CSRF protection (Better Auth)
- ✅ Rate limiting on all public endpoints
- ✅ Input validation (Zod schemas)
- ✅ SQL injection prevention (Drizzle ORM parameterized queries)
- ✅ XSS prevention (React escaping + input sanitization)
- ✅ HTTPOnly secure cookies
- ✅ Password hashing (bcrypt via Better Auth)
- ✅ TOTP 2FA for admin (Better Auth plugin)
- ✅ Email verification (6-digit codes)
- ✅ Secrets in .env (never committed)
- ✅ Content Security Policy headers
- ✅ Timing-safe code comparison

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Passwordless guests | Simpler UX, more secure than weak passwords |
| 7-day access | Balance convenience and security |
| Unlimited devices per user | Family-friendly, handles MAC randomization |
| Fail fast on Unifi errors | Clear errors better than hanging |
| Keep data forever | Analytics, easy returns |
| Polling (not WebSockets) | Simpler for home network scale |
| SQLite | Zero-config deployment, perfect for single-server home use |
| Better Auth | Modern, unified authentication for guests + admin |

## Deployment Notes

### Production Checklist
1. Change `ADMIN_PASSWORD` and `BETTER_AUTH_SECRET` in `.env`
2. Configure Resend API key for email delivery
3. Set up reverse proxy (Caddy/Nginx) for HTTPS
4. Configure firewall rules for guest VLAN
5. Set `NODE_ENV=production`
6. Ensure Unifi Controller is accessible from app server

### Reverse Proxy Example (Caddy)

```
worldwidewebb.co {
    reverse_proxy localhost:3000
}
```

### Firewall Rules
- Allow guest VLAN → app server (port 3000/443)
- Allow app server → Unifi Controller (port 8443)
- Allow app server → SMTP (port 587/465)

## Troubleshooting

### Unifi Connection Errors
- Verify `UNIFI_CONTROLLER_URL` is correct
- Set `UNIFI_SKIP_SSL_VERIFY=true` for self-signed certs
- Check Unifi credentials have admin access

### Email Not Sending
- Dev: Ensure Mailpit is running (docker-compose)
- Prod: Verify Resend API key is valid
- Check SMTP settings in `.env`

### Database Issues
- Run `pnpm db:migrate` to ensure schema is up to date
- Check `data/captive-portal.db` file permissions
- Use `pnpm db:studio` to inspect database

### Build Errors
- Clear `.next` folder: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && pnpm install`
- Check TypeScript errors: `pnpm tsc --noEmit`

## License

Private project for home network use.

## Documentation

### Project Overview
- **[Project Status Report](docs/PROJECT_STATUS.md)** - Comprehensive feature completion and production readiness assessment
- **[Product Requirements Document](docs/PRD.md)** - Original requirements and specifications

### API Documentation
- **[API Reference](docs/API.md)** - Complete API documentation with request/response examples
- **[OpenAPI Specification](docs/API.yaml)** - Machine-readable API spec (OpenAPI 3.0)
- **[Error Code Reference](docs/ERROR_CODES.md)** - Comprehensive error handling guide

### Operations & Deployment
- **[Deployment Guide](DEPLOYMENT.md)** - Production setup, reverse proxy, systemd, Docker
- **[Monitoring Guide](docs/MONITORING.md)** - Prometheus + Grafana setup with alerting
- **[Backup Guide](scripts/BACKUP_README.md)** - Database backup/restore procedures

### Maintenance
- **[Dependency Migration Plan](docs/DEPENDENCY_MIGRATION_PLAN.md)** - Major version upgrade guide (Next.js 16, React 19, ESLint 9, Tailwind 4)

### Development
- **[E2E Testing](e2e/README.md)** - End-to-end test documentation (Playwright)
- **[Project Requirements](docs/PRD.md)** - Full PRD with specifications
- **[Fix Plan](@fix_plan.md)** - Implementation tracking and architecture notes

## Support

For issues or questions, refer to:
- **CLAUDE.md**: Project instructions and tech stack details
- **GitHub Issues**: Report bugs or feature requests
