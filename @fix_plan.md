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
- [x] **Error Handling & Structured Logging** (2026-01-19) - Added try-catch blocks around all database .run() operations, created structured logger for production observability, added error boundaries for all route groups, improved Unifi authorization error feedback
- [x] **Critical Bug Fixes** (2026-01-19) - Fixed admin guests route filtering, timing-safe code verification, MAC normalization, N+1 query optimization, DPI stats population

## Production Readiness Gaps (2026-01-19)

### 🔴 P0 - Critical (Must Fix Before Production)

- [x] **Test Coverage** - ✅ **COMPLETED (2026-01-19)** - Unit tests and E2E test infrastructure implemented
  - [x] Set up Vitest + @testing-library/react + @testing-library/jest-dom
  - [x] Set up Playwright for E2E tests
  - [x] Unit tests for guest auth flow (verify-email, verify-code with rate limiting)
  - [x] Unit tests for rate limiting enforcement (5/hour email, 3 attempts code, lockout behavior)
  - [x] Unit tests for sanitization (XSS, MAC validation, HTML escaping)
  - [x] E2E tests for complete user journeys (guest signup, admin login)
  - [x] Test edge cases (expired codes, invalid tokens, Unifi failures)
  - [ ] Unit tests for admin auth flow (TOTP setup, session validation) - Optional
  - [ ] Integration tests for Unifi client (authorize, revoke, client list with mocks) - Optional
  - **Coverage:** 39 passing unit tests (Vitest), E2E tests for guest and admin flows (Playwright)
  - **Implementation:**
    - Vitest: `src/__tests__/` with guest auth, rate limiting, and sanitization tests
    - Playwright: `e2e/` with guest-signup.spec.ts and admin-login.spec.ts
    - Commands: `pnpm test` (unit), `pnpm test:e2e` (E2E), `pnpm test:coverage`
    - Documentation: `e2e/README.md` with usage guide and test structure

- [x] **Middleware Security** - ✅ **COMPLETED (2026-01-19)** - Edge-compatible auth with server-side validation
  - [x] Edge-compatible middleware (cookie-based redirects for UX)
  - [x] Server-side session validation in pages/API routes (not middleware due to Edge runtime)
  - [x] Role-based access control (verify `role === 'admin'` in routes)
  - [x] TOTP enforcement check (pages check TOTP status)
  - [x] Handle expired sessions server-side (check expiresAt in DB)
  - **Implementation:** src/middleware.ts does optimistic redirects, lib/session.ts has requireAdmin/requireAuth for actual security

- [x] **Secret Validation** - ✅ **COMPLETED (2026-01-19)** - Startup validation for production secrets
  - [x] Startup validation in instrumentation.ts for BETTER_AUTH_SECRET != default
  - [x] Admin password complexity validation (12+ chars in production)
  - [x] Generate secrets script for initial setup - ✅ **COMPLETED (2026-01-19 PM)**
  - [ ] Force password change on first admin login
  - **Implementation:** src/instrumentation.ts now validates secrets on startup, fails in production if critical errors found
  - **Secrets Script:** scripts/generate-secrets.ts - Interactive and auto modes for secure secret generation with password complexity validation

### 🟡 P1 - High Priority (Should Fix Soon)

- [x] **Production Deployment Guide** - ✅ **COMPLETED (2026-01-19)** - Comprehensive production setup documentation
  - [x] Create DEPLOYMENT.md with complete production setup guide
  - [x] Systemd service file example (with auto-restart)
  - [x] Nginx/Caddy reverse proxy config with SSL/TLS (Let's Encrypt)
  - [x] Unifi Controller configuration guide (captive portal setup with screenshots)
  - [x] Firewall rules and network configuration
  - [x] Environment variable security checklist
  - [x] Database backup/restore procedures
  - **Implementation:** Created comprehensive 866-line DEPLOYMENT.md covering server setup, Unifi configuration, Docker/systemd deployment, reverse proxy (Caddy & Nginx), backups, monitoring, security checklist, troubleshooting, and production checklists

- [x] **Unifi Error Handling Strategy** - ✅ **COMPLETED (2026-01-19)** - Configurable fail-fast vs graceful degradation
  - [x] Add ALLOW_OFFLINE_AUTH env var to configure fail-fast vs graceful degradation
  - [x] Fail request if Unifi authorization fails (when not in offline mode)
  - [x] Better user error messaging with recovery steps
  - [x] Document decision in architecture notes
  - **Implementation:** Added ALLOW_OFFLINE_AUTH env var (default: false for production)
    - `false` (production): Fail-fast with HTTP 503 and recovery steps when Unifi fails
    - `true` (development): Graceful degradation, returns success with warning
    - Error responses include actionable recovery steps for users
    - Proper logging of Unifi failures with auth_fail events

- [x] **Input Sanitization** - ✅ **COMPLETED (2026-01-19)** - XSS protection implemented
  - [x] Sanitize user names before storage (prevent stored XSS in admin panel)
  - [x] Stricter MAC address regex validation
  - [x] Add Content Security Policy headers
  - [x] HTML escape user input in email templates
  - **Implementation:** Created sanitization utilities (escapeHtml, sanitizeName, isValidMac, sanitizeEmail)
    - All user input sanitized at entry points (verify-email, guest status APIs)
    - HTML escaping applied to all email templates (verification, admin notifications, expiry reminders)
    - MAC addresses validated for exact 12 hex character format
    - CSP headers: default-src 'self', frame-ancestors 'none', form-action 'self'
    - Security headers: X-Frame-Options DENY, X-Content-Type-Options nosniff, X-XSS-Protection
    - 11 sanitization tests added, all 39 tests passing

### 🟢 P2 - Medium Priority (Nice to Have)

- [x] **Monitoring & Alerting** - ✅ **COMPLETED (2026-01-19)** - Prometheus integration and comprehensive monitoring guide
  - [x] Prometheus metrics endpoint (`/api/metrics/prometheus`) with 12 metrics in standard text format
  - [x] Grafana dashboard JSON config with 4 panels (active guests, auth rate, devices, timeline)
  - [x] Alert rules for critical failures (6 rules: auth failures, downtime, revocations, expiry warnings)
  - [x] UptimeRobot and Healthchecks.io setup guide with examples
  - [x] Log aggregation setup (Loki/Grafana configuration included)
  - **Implementation:** Created `/api/metrics/prometheus` endpoint, comprehensive `docs/MONITORING.md` with Docker Compose setup, Prometheus config, Grafana dashboard, alerting rules, external monitoring integration, and troubleshooting guide

- [x] **Database Backups** - ✅ **COMPLETED (2026-01-19)** - Comprehensive backup/restore system implemented
  - [x] Automated SQLite backup script (daily snapshots with VACUUM INTO)
  - [x] Backup rotation policy (keep 30 days, configurable)
  - [x] Restore procedure documentation + testing (scripts/BACKUP_README.md)
  - [x] Offsite backup configuration (NFS/CIFS mount + rclone cloud sync)
  - [x] Systemd timer for automated daily backups at 2 AM
  - [x] Integrity verification (--verify flag for backup validation)
  - [x] Pre-restore safety (auto-creates backup before restore)
  - [x] NPM scripts: pnpm db:backup, pnpm db:restore, pnpm db:restore:list
  - [x] Disaster recovery procedures and quarterly drill instructions
  - [x] Backup monitoring scripts and health checks
  - **Implementation:** Created backup-database.ts, restore-database.ts, systemd timer, comprehensive BACKUP_README.md documentation, updated DEPLOYMENT.md with production setup guide

- [x] **API Documentation** - ✅ **COMPLETED (2026-01-19)** - Comprehensive API documentation suite
  - [x] OpenAPI 3.0 specification (docs/API.yaml) with all 19 endpoints documented
  - [x] Request/response examples for all endpoints (docs/API.md)
  - [x] Error code reference with recovery actions (docs/ERROR_CODES.md)
  - [x] Rate limit documentation with client-side handling examples
  - [x] Integration examples (TypeScript, Python, curl)
  - [x] Common error scenarios and recovery flows
  - [x] Updated README.md with Documentation section
  - **Implementation:** Created comprehensive API documentation covering all guest auth, admin, portal, and system endpoints with detailed examples, error handling patterns, retry logic, and Prometheus integration

### 🔵 P3 - Low Priority (Future Enhancements)

- [x] **Code Cleanup** - ✅ **COMPLETED (2026-01-19)** - Deprecated code removed, magic numbers refactored, JSDoc documentation added
  - [x] Remove deprecated normalizeMac wrapper in src/lib/unifi.ts (replaced all calls with direct imports)
  - [x] Replace magic numbers with named constants (e.g., 600000 → CODE_EXPIRY_MS)
  - [x] Add JSDoc comments to complex functions (9+ critical functions documented)
  - [ ] Extract hardcoded values to configuration

- [ ] **Performance Optimization**
  - [ ] Add caching layer for Unifi API calls (Redis or in-memory)
  - [ ] Database query profiling and optimization
  - [ ] Connection pooling for better-sqlite3
  - [ ] Frontend bundle size optimization

- [ ] **User Experience**
  - [ ] Loading states for all async buttons
  - [ ] Better error messages with actionable recovery steps
  - [ ] Toast notifications for background actions
  - [ ] Progressive web app (PWA) support for guest portal

### Missing Features from PRD (Optional)

- [ ] **Disposable Email Blocking** (PRD line 1702-1721) - Block temporary email services
- [ ] **Password Reset UI** (PRD line 313-319) - Better Auth provides API, need dedicated route
- [ ] **Guest Voucher System** (PRD line 2620) - Phase 3 feature, not critical
- [x] **DB/Unifi Sync Job** (PRD line 1638-1661) - ✅ **COMPLETED (2026-01-19)** - 5-minute job to detect and fix authorization mismatches
  - [x] syncAuthorizationMismatches function in cron.ts
  - [x] Compares DB guests (not expired) with Unifi authorized guests
  - [x] Re-authorizes guests on Unifi if mismatch detected
  - [x] Calculates remaining time and logs admin_extend events
  - [x] Runs every 5 minutes via instrumentation.ts
  - [x] Error handling with detailed logging
  - **Implementation:** Background job that ensures DB and Unifi stay in sync, catches manual revocations or Unifi failures

## Notes

### Recent Enhancements (2026-01-19 PM)
- **JSDoc Documentation** (Latest - 2026-01-19 PM): Comprehensive documentation for critical functions
  - Added detailed JSDoc comments to 9+ complex functions across 4 core library files
  - Documented functions:
    - `checkRateLimit()`, `getRateLimitStatus()`, `resetRateLimit()`, `formatRateLimitError()` (rate-limit.ts)
    - `syncAuthorizationMismatches()`, `syncConnectionEvents()`, `cacheDPIStats()` (cron.ts)
    - `login()`, `request<T>()` (unifi.ts)
    - `sanitizeName()` (utils.ts)
  - Documentation includes:
    - State machine logic and transitions (rate limiting)
    - Security implications (XSS prevention, timing attacks)
    - Performance optimizations (N+1 query prevention, batch loading)
    - Auto-retry mechanisms and session management
    - Generic type usage and comprehensive examples
    - Error handling and fallback behavior
  - Benefits: Easier onboarding, better IDE intellisense, reduced risk of bugs from misunderstanding
  - Commit: cdaf6a4 (305 lines added across 4 files)
  - All 39 unit tests passing, no functional changes
- **Secrets Generation Script** (2026-01-19 PM): Automated secure secrets generation for project setup
  - Created scripts/generate-secrets.ts with interactive and automatic modes
  - Interactive mode (`pnpm generate-secrets`): Guided setup with prompts for all configuration
  - Automatic mode (`pnpm generate-secrets:auto`): Generates all secrets without prompting
  - Features:
    - Cryptographically secure BETTER_AUTH_SECRET generation (32+ characters, base64url)
    - Strong random admin password generation (16 chars, mixed case, numbers, symbols)
    - Password complexity validation (12+ chars, 3/4 character types required)
    - Guided Unifi and email configuration with sensible defaults
    - Overwrite protection with confirmation prompt
    - Clear next steps and security warnings after generation
  - Updated README.md and DEPLOYMENT.md with secrets generator instructions
  - Added `pnpm generate-secrets` and `pnpm generate-secrets:auto` commands to package.json
  - Helps users avoid weak secrets and simplifies initial setup
  - Benefits: Secure by default, reduces setup friction, validates production readiness
- **Magic Numbers Refactoring** (2026-01-19): Replaced 45+ magic numbers with named constants
  - Created centralized constants directory (src/lib/constants/) with 6 organized files:
    - `time.ts`: Time duration constants (ONE_DAY_MS, ONE_HOUR_MS, FIFTEEN_MINUTES_MS, etc.)
    - `auth.ts`: Authentication constants (BCRYPT_SALT_ROUNDS, TOTP_PERIOD_SECONDS, BACKUP_CODES_AMOUNT, etc.)
    - `rate-limits.ts`: Rate limiting defaults (VERIFY_EMAIL_MAX_ATTEMPTS_DEFAULT, RESEND_CODE_MAX_ATTEMPTS_DEFAULT, etc.)
    - `alerts.ts`: Alert thresholds (ALERT_SEVERITY_THRESHOLD, FAILED_AUTH_ALERT_THRESHOLD, etc.)
    - `jobs.ts`: Background job intervals (CONNECTION_SYNC_INTERVAL_MS, DPI_CACHE_INTERVAL_MS, etc.)
    - `config.ts`: Server configuration (UNIFI_DEFAULT_PORT, SMTP_DEFAULT_PORT, health check timeouts)
  - Updated 15+ files across codebase to use constants instead of hardcoded values:
    - Core libraries: auth.ts, rate-limit.ts, unifi.ts, email.ts, cron.ts
    - API routes: verify-email, verify-code, resend-code, alerts, stats, extend, metrics, prometheus, health
    - Background jobs: instrumentation.ts
  - Eliminated 27 instances of duplicated `24 * 60 * 60 * 1000` (ONE_DAY_MS)
  - All 39 unit tests passing, TypeScript compilation successful
  - Benefits: Better maintainability, single source of truth, easier configuration changes
- **API Documentation Suite** (2026-01-19): Comprehensive API reference for developers
  - Created OpenAPI 3.0 specification (docs/API.yaml) with all 19 endpoints fully documented
  - Created human-readable API documentation (docs/API.md) with request/response examples, authentication flows, and integration examples (TypeScript, Python, curl)
  - Created error code reference (docs/ERROR_CODES.md) with recovery actions, retry strategies, and monitoring best practices
  - Documented all rate limits, error scenarios, and client-side handling patterns
  - Added Documentation section to README.md with organized links to all docs
  - Includes: Guest auth flow, admin endpoints, guest portal, system/metrics endpoints
  - Coverage: 4 guest auth endpoints, 9 admin endpoints, 2 portal endpoints, 3 system endpoints, 1 Better Auth catch-all
- **Prometheus Monitoring Integration** (2026-01-19): Production-grade observability
  - Created `/api/metrics/prometheus` endpoint with 12 metrics in Prometheus text format
  - Comprehensive monitoring guide (docs/MONITORING.md) with complete Prometheus + Grafana setup
  - Includes Docker Compose configuration for monitoring stack (Prometheus, Grafana, Alertmanager)
  - 6 pre-configured alert rules (auth failures, downtime, unusual activity, expiry warnings)
  - Sample Grafana dashboard JSON with 4 panels (guests, auth rate, devices, timeline)
  - External monitoring integration (UptimeRobot, Healthchecks.io)
  - Log aggregation setup (Loki/Promtail configuration)
  - Security best practices and troubleshooting guide
- **Code Cleanup** (2026-01-19): Removed technical debt
  - Removed deprecated normalizeMac wrapper method from UnifiController class
  - Replaced all this.normalizeMac() calls with direct imports from utils
  - Simplifies codebase and reduces maintenance burden
- **DB/Unifi Authorization Sync Job** (Earlier - 2026-01-19 Evening): Implemented automated mismatch detection
  - Created syncAuthorizationMismatches() in src/lib/cron.ts
  - Runs every 5 minutes to detect guests authorized in DB but not on Unifi
  - Automatically re-authorizes with correct remaining time
  - Logs all re-authorizations as admin_extend events
  - Handles errors gracefully with detailed error messages
  - Prevents authorization drift between database and Unifi controller
- **Edge Runtime Compatibility Fix** (Earlier - 2026-01-19 Evening): Fixed critical middleware crash
  - Removed database queries from middleware (Edge runtime doesn't support Node.js fs/sqlite)
  - Middleware now does optimistic cookie-based redirects only (UX optimization)
  - Server-side validation happens in pages/API routes using lib/session.ts helpers
  - Added e2e/ to Vitest exclude list to prevent conflicts with Playwright
  - Fixed error: "The edge runtime does not support Node.js 'fs' module"
  - All admin pages use authClient.getSession() or requireAdmin() for security
  - All API routes use requireAdmin()/requireAuth() helpers
  - Middleware redirects are NOT security boundary (just fast redirects for better UX)
  - Actual auth enforcement happens server-side per Better Auth Edge runtime recommendations
- **E2E Test Infrastructure** (Earlier Today): Playwright setup for end-to-end testing
  - Installed and configured Playwright with chromium, firefox, webkit browsers
  - Created comprehensive E2E tests for guest signup flow (email entry, verification, success page)
  - Created E2E tests for admin login flow (login form, TOTP setup, dashboard access)
  - Test coverage includes validation, rate limiting UI behavior, authentication flows
  - Added NPM scripts: `pnpm test:e2e`, `pnpm test:e2e:ui`, `pnpm test:e2e:headed`, `pnpm test:e2e:debug`
  - Created `e2e/README.md` with detailed documentation and usage guide
  - Updated main README.md with testing section
  - Configured Playwright to auto-start dev server for tests
  - Test files: `e2e/guest-signup.spec.ts`, `e2e/admin-login.spec.ts`
- **Input Sanitization & XSS Protection**: Comprehensive security improvements
  - Created sanitization utilities: escapeHtml, sanitizeName, isValidMac, sanitizeEmail
  - All user input sanitized at API entry points (verify-email, status)
  - HTML escaping in all email templates (verification, admin notifications, expiry reminders)
  - Strict MAC address validation (exactly 12 hex characters)
  - Content Security Policy headers: default-src 'self', frame-ancestors 'none'
  - Security headers: X-Frame-Options DENY, X-Content-Type-Options nosniff, X-XSS-Protection
  - Added 11 sanitization tests, all 39 tests passing
- **Unit Test Infrastructure**: Set up Vitest + React Testing Library with 39 passing tests
  - Created comprehensive unit tests for guest auth flow (verify-email, verify-code)
  - Added rate limiting tests (lockout, window expiration, attempt tracking)
  - Added sanitization tests (XSS, MAC validation, HTML escaping)
  - Tests cover edge cases: expired codes, wrong codes, Unifi failures, rate limits
- **Middleware Security**: Implemented proper server-side session validation
  - Now validates session token against database (checks expiry, role, TOTP status)
  - Prevents unauthorized access with invalid/expired tokens
  - Enforces admin role and TOTP setup requirements
- **Secret Validation**: Added startup checks for production readiness
  - Validates BETTER_AUTH_SECRET length and strength (fails in prod if weak)
  - Checks admin password complexity (warnings for weak passwords)
  - Validates Unifi configuration presence
  - Server fails fast in production if critical config missing

### Recent Bug Fixes (2026-01-19 AM)
- **Admin guests route filtering**: Fixed where condition building - was only applying last filter instead of AND'ing all conditions
- **Timing attack vulnerability**: Added constant-time string comparison for verification codes using crypto.timingSafeEqual
- **MAC address normalization**: Created shared normalizeMac utility for consistent handling across codebase
- **N+1 query problem**: Optimized connection sync to batch load guest records (O(n) → O(1))
- **DPI stats population**: Fixed empty domains array - now stores top 10 applications by bandwidth
- **Error handling**: Added missing try-catch blocks in cron job database operations

### Architecture Decisions
- **Passwordless for guests**: Email verification sufficient, better UX than passwords
- **Unified Better Auth**: Single auth system for guest + admin, cleaner than separate auth
- **Configurable Unifi error handling**: ALLOW_OFFLINE_AUTH env var controls fail-fast (production) vs graceful degradation (development)
  - Production (ALLOW_OFFLINE_AUTH=false): Fail-fast with HTTP 503 when Unifi unavailable, clear recovery steps for users
  - Development (ALLOW_OFFLINE_AUTH=true): Warn but allow auth to succeed for easier testing without Unifi
  - Balances reliability (production) with developer experience (local development)
- **7-day authorization**: Renewable via re-verification, balances convenience and security
- **Polling over WebSockets**: Simpler for home network scale, 30s is responsive enough
- **Keep all data forever**: Analytics and easy returns outweigh storage concerns
- **Structured logging**: JSON logs in production, human-readable in dev for better observability
- **Comprehensive error handling**: All database operations wrapped in try-catch, prevents silent failures

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
