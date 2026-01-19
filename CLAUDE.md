# World Wide Webb - Captive Portal

Guest WiFi captive portal for home network with passwordless email authentication.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **UI:** React + Tailwind CSS + shadcn/ui (dark mode default)
- **Fonts:** Geist Sans + Geist Mono
- **Database:** SQLite with Drizzle ORM
- **Auth:** Better Auth (unified for guests + admin)
- **Email:** Mailpit (dev) / Resend (prod)
- **Network:** Unifi Controller API

## Architecture

```
app/
├── (guest)/              # Captive portal (email entry, verify, success)
├── portal/               # Guest self-service dashboard (auth required)
└── admin/                # Admin panel (role: admin, TOTP required)

api/
├── auth/                 # Better Auth endpoints
├── guest/                # verify-email, verify-code, resend-code, status
├── admin/                # guests, network/status, logs, revoke
└── unifi/                # authorize, revoke, clients, dpi

lib/
├── db.ts                 # SQLite + Drizzle ORM
├── auth.ts               # Better Auth config
├── unifi.ts              # Unifi Controller client
├── email.ts              # Email service
└── utils.ts              # Shared utilities
```

## Authentication Flows

### Guests (Passwordless)
1. Enter name + email on landing page
2. Receive 6-digit code via email (10 min expiry)
3. Verify code → MAC authorized on Unifi (7 days)
4. Returning guests with valid MAC skip auth

### Admin (Password + TOTP)
1. Login with email + password
2. First login: forced TOTP setup (Google Authenticator/Authy)
3. Subsequent logins require TOTP code

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Passwordless guests | Simpler UX, more secure than weak passwords |
| 7-day access | Balance convenience and security |
| Unlimited devices per user | Family-friendly, handles MAC randomization |
| Fail fast on Unifi errors | Clear errors better than hanging |
| Keep data forever | Analytics, easy returns |
| Polling (not WebSockets) | Simpler for home network scale |

## UI Design

- **Theme:** Dark mode (black background, white text)
- **Style:** Apple-style minimal
- **Colors:**
  - Background: `#000000` (bg-black)
  - Text: `#FFFFFF` (text-white)
  - Muted BG: `#171717` (bg-zinc-900)
  - Muted Text: `#A1A1AA` (text-zinc-400)
  - Border: `#27272A` (border-zinc-800)

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| verify-email | 5/hour per email |
| verify-code | 3 attempts per code |
| resend-code | 3/hour, 30s cooldown |

## Development

```bash
pnpm install          # Install deps + git hooks
pnpm dev              # Start dev server
pnpm db:migrate       # Run migrations
pnpm db:seed          # Create admin user
pnpm setup            # All of the above
```

## Development Workflow

### Tilt (Recommended)

Use Tilt for the best development experience:

```bash
tilt up    # Single command starts everything
```

**What runs:**
- Mailpit (Docker) - Email testing on ports 1025/8025
- Migrations (Local) - Auto-applies schema changes
- Next.js (Local) - Dev server with HMR on port 3000

**Features:**
- Live reload: Changes to `src/` reflect instantly
- Smart migrations: Only re-run when schema changes
- Manual seeding: Click "seed-admin" button in Tilt UI
- Unified logs: Searchable, color-coded in Tilt dashboard
- Persistence: SQLite and Mailpit data survives restarts

**Dashboard:** http://localhost:10350

### Manual Development

```bash
# Start Mailpit (optional - can use Resend directly)
docker compose -f docker-compose.dev.yml up mailpit

# Start dev server
pnpm dev
```

## Code Quality

- Git hooks (Husky + lint-staged) auto-format on commit
- Prettier for formatting
- ESLint for linting
- Run `pnpm format` to format all files
- Run `pnpm lint` to check linting

## Environment Variables

Key variables in `.env`:
- `BETTER_AUTH_SECRET` - Auth secret
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` - Admin credentials
- `UNIFI_CONTROLLER_URL` / `UNIFI_USERNAME` / `UNIFI_PASSWORD` - Unifi config
- `EMAIL_PROVIDER` - `mailpit` or `resend`
- `RESEND_API_KEY` - For production email

## Database Tables

- `user` - Better Auth users (guests + admin)
- `session` - Better Auth sessions
- `guests` - MAC authorizations linked to users
- `verification_codes` - Email 2FA codes
- `activity_logs` - Connection/auth events
- `rate_limits` - Rate limiting state
- `network_stats` - Cached DPI/bandwidth data

## Unifi Integration

The portal authorizes/revokes MAC addresses on the Unifi controller:
- `unifi.authorizeGuest(mac, duration)` - Grant access
- `unifi.unauthorizeGuest(mac)` - Revoke access
- `unifi.getActiveClients()` - List connected devices
- `unifi.getDPIStats(mac)` - Get bandwidth/domain stats

## Error Handling

- Unifi failures: Return 503 with clear message, fail fast (no retry queue)
- Invalid 2FA: 3 attempts then invalidate code
- Rate limits: Return 429 with reset time
