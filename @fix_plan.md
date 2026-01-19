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

- [x] **Admin TOTP Setup Page** (`/admin/setup-2fa/page.tsx`) - Display QR code + manual entry key, verify TOTP code, generate + download 10 backup codes, force setup on first login
- [x] **Admin Dashboard** (`/admin/page.tsx`) - Overview cards (active guests, total authorized, bandwidth), live device list (30s polling), recent activity feed
- [x] **Admin Guest Management** (`/admin/guests/page.tsx`) - Paginated guest list with search/filter, device MAC tracking, connection history per guest, bulk revocation, extended authorization
- [x] **Admin Network Monitoring** (`/admin/network/page.tsx`) - Real-time active client list (30s polling), authorized vs unauthorized highlight, signal strength, DPI stats integration
- [x] **Admin Activity Logs** (`/admin/logs/page.tsx`) - Filterable by event type/date/user, CSV export, event detail modals, pagination
- [x] **Guest Portal Dashboard** (`/portal/page.tsx`) - Welcome message with name, connection status, time remaining, data usage, list of authorized MACs with status
- [x] **Guest Device Management** (`/portal/devices/page.tsx`) - Edit device nicknames, view connection history per MAC, request time extension
- [x] **Activity Logging System** (`lib/logger.ts`) - Log all events (connect, disconnect, auth_success, auth_fail, admin actions) with timestamps, user, MAC, IP, JSON details
- [x] **Background Sync Jobs** - Use `instrumentation.ts` with `setInterval`. Connection event sync (1 min), DPI stats cache (5 min), expiry cleanup, session cleanup
- [x] **Email Service** (`lib/email.ts`) - Verification code emails, admin notification emails, password reset, styled HTML templates
- [x] **Git Hooks & Code Quality** - Setup Husky + lint-staged + Prettier + ESLint, pre-commit hook auto-formats code
- [x] **Docker Setup** - Dockerfile + docker-compose.yml with app + Mailpit, SQLite volume persistence, environment configuration
- [x] **Admin Notifications** - Email on new guest authorized, guest expiry reminders (24h before via cron), dashboard alerts API

## Low Priority

- [x] **Health Check Endpoint** (`GET /api/health`) - Database, Unifi, Email service checks
- [x] **Metrics Endpoint** (`GET /api/metrics`) - Guest counts, auth attempts, active devices
- [x] **Guest Resend Code** (`POST /api/guest/resend-code`) - 30s cooldown, 3/hour limit, rate limiting
- [x] **Guest Status Check** (`GET /api/guest/status?mac=...`) - Check if MAC already authorized, return guest info
- [x] **Admin Revoke Guest** (`POST /api/admin/guests/revoke`) - Revoke access, call Unifi, log admin_revoke event
- [x] **Admin Extend Guest** (`POST /api/admin/guests/extend`) - Extend guest access by specified days, update Unifi auth, log admin_extend event
- [x] **Admin Get Guests** (`GET /api/admin/guests`) - Paginated list with filtering, join with Unifi data for online status
- [x] **Admin Network Status** (`GET /api/admin/network/status`) - Real-time device data joined with guest info, bandwidth, signal
- [x] **Admin DPI Stats** (`GET /api/admin/dpi?mac=...`) - Fetch domain/app stats from Unifi for specific device
- [x] **Rate Limiting Helper** (`lib/rate-limit.ts`) - Generic rate limit check function for reuse across APIs
- [x] **Middleware Protection** (`middleware.ts`) - Protect /admin routes, force TOTP setup, guest portal auth checks
- [x] **Backup Codes Validation** - Allow admin login with backup codes if TOTP device lost
- [x] **Reverse Proxy Docs** - Caddy/Nginx config for HTTPS, production recommendations, firewall rules
- [x] **Monitoring Setup** - UptimeRobot config, error alerts, email on health check failures
- [x] **Admin Settings Page** (`/admin/settings`) - Change password, regenerate TOTP, disable 2FA, notification preferences
- [x] **Server-side Session Validation** (`lib/session.ts`) - Session validation helper for API routes with requireAdmin(), requireAuth(), AdminAuthError handling

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
- [x] **Admin TOTP Setup Page** - QR code, manual entry, verification, backup codes download
- [x] **Admin Dashboard** - Stats cards, active devices list, activity feed with 30s polling
- [x] **Middleware Protection** - Protect /admin routes with session cookie check
- [x] **Activity Logging System** (`lib/logger.ts`) - Centralized logging with typed events and IP extraction
- [x] **Health Check Endpoint** (`GET /api/health`) - Database, Unifi, Email service connectivity checks
- [x] **Metrics Endpoint** (`GET /api/metrics`) - Guest counts, auth attempts, active devices, admin stats
- [x] **Background Sync Jobs** - instrumentation.ts with setInterval for connection sync, DPI cache, cleanup jobs, expiry reminders
- [x] **Admin Notifications** - Email on new guest, expiry reminders (24h before), dashboard alerts API (`/api/admin/alerts`)
- [x] **Rate Limiting Helper** (`lib/rate-limit.ts`) - Generic checkRateLimit, resetRateLimit, getRateLimitStatus, formatRateLimitError functions
- [x] **Admin Settings Page** (`/admin/settings`) - Change password, regenerate TOTP (via disable+re-enable flow), generate new backup codes

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
- `lib/cron.ts` - Background sync job functions
- `instrumentation.ts` - Startup script with setInterval for background jobs

### Testing Commands
- `pnpm dev` - Start dev server (port 3000)
- `pnpm db:migrate` - Run migrations
- `pnpm db:seed` - Create admin user
- `pnpm build` - Build for production
- `pnpm test` - Run tests (when implemented)
- `pnpm lint` - Check code quality
- `pnpm format` - Auto-format code
