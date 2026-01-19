# Ralph Fix Plan

## Reference Documents

- **Read `docs/PRD.md` for full project requirements** - Contains detailed specifications, user flows, and technical decisions

## High Priority

- [x] **Project Setup & Dependencies** - Initialize Next.js 14 with TypeScript, install Tailwind, shadcn/ui, Better Auth, Drizzle ORM, email clients (Mailpit/Resend)
- [x] **Database Schema & Migrations** - Create SQLite schema with Drizzle ORM: users, sessions, guests, verification_codes, activity_logs, rate_limits, network_stats tables with proper indexes
- [x] **Better Auth Configuration** - Setup Better Auth with email + password for admin, passwordless for guests, TOTP plugin, session management, rate limiting
- [x] **Guest Email Verification API** (`POST /api/guest/verify-email`) - Send 6-digit code, rate limiting (5/hour per email), validation, email service integration
- [x] **Guest Code Verification API** (`POST /api/guest/verify-code`) - Verify code (3 attempts), create Better Auth user, authorize MAC on Unifi, save guest record, log auth_success
- [x] **Unifi Controller Client** (`lib/unifi.ts`) - Login, authorize guest, revoke guest, get active clients, get DPI stats, get connection events
- [x] **Guest Landing Page** (`/page.tsx` in `(guest)` route) - Email entry form, name field, terms checkbox, dark mode UI (black bg), form validation with Zod, auto-detect MAC from URL
- [x] **Guest Verification Page** (`/verify/page.tsx`) - Display 6-digit code input (one-time-code autocomplete), resend code button with cooldown, error handling, rate limit messages
- [x] **Guest Success Page** (`/success/page.tsx`) - Welcome message, show expiry countdown, auto-close after 3s (for iOS captive portal), returning guest message
- [x] **Admin Login Page** (`/admin/login/page.tsx`) - Email + password form, forgot password link, dark mode, Better Auth integration, redirect to TOTP setup if not configured

## Medium Priority

- [ ] **Admin TOTP Setup Page** (`/admin/setup-2fa/page.tsx`) - Display QR code + manual entry key, verify TOTP code, generate + download 10 backup codes, force setup on first login
- [ ] **Admin Dashboard** (`/admin/page.tsx`) - Overview cards (active guests, total authorized, bandwidth), live device list (30s polling), recent activity feed
- [ ] **Admin Guest Management** (`/admin/guests/page.tsx`) - Paginated guest list with search/filter, device MAC tracking, connection history per guest, bulk revocation, extended authorization
- [ ] **Admin Network Monitoring** (`/admin/network/page.tsx`) - Real-time active client list (30s polling), authorized vs unauthorized highlight, signal strength, DPI stats integration
- [ ] **Admin Activity Logs** (`/admin/logs/page.tsx`) - Filterable by event type/date/user, CSV export, event detail modals, pagination
- [ ] **Guest Portal Dashboard** (`/portal/page.tsx`) - Welcome message with name, connection status, time remaining, data usage, list of authorized MACs with status
- [ ] **Guest Device Management** (`/portal/devices/page.tsx`) - Edit device nicknames, view connection history per MAC, request time extension
- [ ] **Activity Logging System** (`lib/logger.ts`) - Log all events (connect, disconnect, auth_success, auth_fail, admin actions) with timestamps, user, MAC, IP, JSON details
- [ ] **Background Sync Jobs** - Connection event sync (every 1 min), DPI stats cache (every 5 min), expiry cleanup, session validation
- [x] **Email Service** (`lib/email.ts`) - Verification code emails, admin notification emails, password reset, styled HTML templates
- [x] **Git Hooks & Code Quality** - Setup Husky + lint-staged + Prettier + ESLint, pre-commit hook auto-formats code
- [ ] **Docker Setup** - Dockerfile + docker-compose.yml with app + Mailpit, SQLite volume persistence, environment configuration
- [ ] **Admin Notifications** - Send email when new guest authorized, guest expiry reminders (24h before), admin dashboard alerts

## Low Priority

- [ ] **Health Check Endpoint** (`GET /api/health`) - Database, Unifi, Email service checks
- [ ] **Metrics Endpoint** (`GET /api/metrics`) - Guest counts, auth attempts, active devices
- [x] **Guest Resend Code** (`POST /api/guest/resend-code`) - 30s cooldown, 3/hour limit, rate limiting
- [x] **Guest Status Check** (`GET /api/guest/status?mac=...`) - Check if MAC already authorized, return guest info
- [ ] **Admin Revoke Guest** (`POST /api/admin/revoke`) - Revoke access, call Unifi, log admin_revoke event
- [ ] **Admin Get Guests** (`GET /api/admin/guests`) - Paginated list with filtering, join with Unifi data for online status
- [ ] **Admin Network Status** (`GET /api/admin/network/status`) - Real-time device data joined with guest info, bandwidth, signal
- [ ] **Admin DPI Stats** (`GET /api/admin/dpi?mac=...`) - Fetch domain/app stats from Unifi for specific device
- [ ] **Rate Limiting Helper** (`lib/rate-limit.ts`) - Generic rate limit check function for reuse across APIs
- [ ] **Middleware Protection** (`middleware.ts`) - Protect /admin routes, force TOTP setup, guest portal auth checks
- [ ] **Backup Codes Validation** - Allow admin login with backup codes if TOTP device lost
- [ ] **Database Cleanup Cron** - Delete old activity logs (>90 days), remove stale MACs (>30 days no connection)
- [ ] **Reverse Proxy Docs** - Caddy/Nginx config for HTTPS, production recommendations, firewall rules
- [ ] **Monitoring Setup** - UptimeRobot config, error alerts, email on health check failures
- [ ] **Admin Settings Page** (`/admin/settings`) - Change password, regenerate TOTP, disable 2FA, notification preferences

## Completed

- [x] PRD conversion to Ralph format (PROMPT.md + @fix_plan.md + specs/requirements.md)
- [x] **Project Setup & Dependencies** - Next.js 14, TypeScript, Tailwind, shadcn/ui, Better Auth, Drizzle ORM, email clients
- [x] **Database Schema & Migrations** - SQLite schema with users, sessions, guests, verification_codes, activity_logs, rate_limits, network_stats (with indexes)
- [x] **Git Hooks & Code Quality** - Husky, lint-staged, Prettier, ESLint pre-commit hooks
- [x] **Better Auth Configuration** - Setup with email+password for admin, passwordless for guests, TOTP plugin
- [x] **Email Service** - Verification code emails and admin notifications with styled HTML templates
- [x] **Guest Authentication Flow** - Complete verify-email, verify-code, resend-code, status APIs
- [x] **Guest UI Pages** - Landing page, verification page, success page with dark mode styling
- [x] **Unifi Controller Client** - Login, authorize/revoke guests, get active clients, DPI stats

## Notes

### Architecture Decisions
- **Passwordless for guests**: Email verification sufficient, better UX than passwords
- **Unified Better Auth**: Single auth system for guest + admin, cleaner than separate auth
- **Fail fast on Unifi errors**: Clear error message better than hanging request
- **7-day authorization**: Renewable via re-verification, balances convenience and security
- **Polling over WebSockets**: Simpler for home network scale, 30s is responsive enough
- **Keep all data forever**: Analytics and easy returns outweigh storage concerns

### Rate Limiting Strategy
- Guest verification: 5 per email per hour (Better Auth)
- Code resend: 30s cooldown + 3 per hour max
- Code verification: 3 wrong attempts invalidates code
- Admin login: Better Auth defaults (5 failed attempts in 15 min)

### Testing Focus
- Core auth flows (verify email, verify code, admin TOTP)
- Unifi integration (authorize, revoke, client list)
- Rate limiting enforcement
- Edge cases (expired codes, already authorized MAC, Unifi down)
- Admin permissions (role checking, TOTP enforcement)

### Database Strategy
- SQLite with Drizzle ORM for type safety
- Proper indexing on: guest.macAddress, guest.expiresAt, activity_logs.userId/eventType/createdAt
- WAL mode for concurrent access
- Migrations via Drizzle (declarative schema)

### Email Configuration
- **Dev**: Mailpit on localhost:1025 (web UI on :8025)
- **Prod**: Resend API with fallback handling
- Templates: Minimal, dark-friendly, include action links

### Security Checklist
- [x] CSRF protection via Better Auth
- [x] Rate limiting on all public endpoints
- [x] Input validation with Zod schemas
- [x] SQL injection prevention (Drizzle ORM parameterized)
- [x] XSS prevention (React escaping)
- [x] HTTPOnly secure cookies
- [x] Password hashing (Better Auth bcrypt)
- [x] TOTP for admin (Better Auth plugin)
- [x] Email verification (2FA codes)
- [x] Secrets in .env (never committed)

### Deployment Strategy
- Single command setup: `pnpm setup` runs migrations + seeds admin
- Docker compose for dev/prod with Mailpit sidecar
- SQLite data/ volume persistent
- Reverse proxy (Caddy/Nginx) for HTTPS in production
- Environment-based config (.env) for credentials

### Key Files to Create/Modify
- `app/(guest)/page.tsx` - Landing page
- `app/(guest)/verify/page.tsx` - Code verification
- `app/(guest)/success/page.tsx` - Success screen
- `app/admin/login/page.tsx` - Admin login
- `app/admin/setup-2fa/page.tsx` - TOTP setup
- `app/admin/page.tsx` - Admin dashboard
- `app/portal/page.tsx` - Guest dashboard
- `api/guest/verify-email/route.ts` - Email verification
- `api/guest/verify-code/route.ts` - Code verification
- `lib/db.ts` - Drizzle schema + database
- `lib/auth.ts` - Better Auth config
- `lib/unifi.ts` - Unifi Controller client
- `lib/email.ts` - Email service
- `middleware.ts` - Auth middleware
- `package.json` - Dependencies + scripts
- `Dockerfile` + `docker-compose.yml` - Docker setup
- `.env.example` - Environment template
- `schema.prisma` or Drizzle schema - Database definition

### Testing Commands
- `pnpm dev` - Start dev server (port 3000)
- `pnpm db:migrate` - Run migrations
- `pnpm db:seed` - Create admin user
- `pnpm build` - Build for production
- `pnpm test` - Run tests (when implemented)
- `pnpm lint` - Check code quality
- `pnpm format` - Auto-format code
