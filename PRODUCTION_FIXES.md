# Critical Production Readiness Fixes

**Status:** 5 Critical Issues Identified
**Estimated Time:** 2-3 hours total
**Priority:** P0 - Must fix before production deployment

---

## 1. ✅ Fix Unifi Authorization Ordering (15 min) - **CRITICAL**

**File:** `src/app/api/guest/verify-code/route.ts`

**Issue:** Guest record is saved to database BEFORE Unifi authorization succeeds. This creates inconsistent state where a guest is recorded as authorized in the database but not actually authorized on the network.

**Location:** Lines 169-270

**Fix:**
```typescript
// Move Unifi authorization (lines 203-269) to BEFORE database insert (lines 169-201)
// Order should be:
// 1. Authorize on Unifi first
// 2. Only save to database if Unifi succeeds (or ALLOW_OFFLINE_AUTH=true)
```

**Impact:** Prevents database/network state mismatch

---

## 2. ✅ Add MAC Address Validation (10 min) - **CRITICAL**

**File:** `src/app/api/guest/verify-code/route.ts`

**Issue:** Empty MAC addresses (`""`) can be stored in the database, leading to skipped Unifi authorization without proper validation.

**Location:** Line 158

**Fix:**
```typescript
// After line 160, add:
import { isValidMac } from '@/lib/utils'

// After line 177, add validation:
if (macAddress && !isValidMac(macAddress)) {
  return NextResponse.json(
    { error: 'Invalid MAC address format. Please try again or contact support.' },
    { status: 400 }
  )
}

if (!macAddress) {
  console.warn('No MAC address provided - network authorization will be skipped', { email: normalizedEmail })
}
```

**Impact:** Ensures only valid MAC addresses are processed

---

## 3. ✅ Validate Pagination Parameters (10 min) - **HIGH**

**Files:**
- `src/app/api/admin/guests/route.ts` (lines 14-15)
- `src/app/api/admin/activity/route.ts` (lines 57-58)

**Issue:** Pagination parameters (`page`, `limit`) are not validated. `NaN`, negative values, or huge limits could cause crashes or abuse.

**Fix:**
```typescript
// Replace lines 14-15 in both files:
const pageRaw = parseInt(searchParams.get('page') || '1')
const limitRaw = parseInt(searchParams.get('limit') || String(PAGINATION_DEFAULT_LIMIT))

// Ensure page is at least 1 (handle NaN and negative values)
const page = Math.max(1, isNaN(pageRaw) ? 1 : pageRaw)

// Ensure limit is between 1 and 100 (prevent abuse)
const limit = Math.min(100, Math.max(1, isNaN(limitRaw) ? PAGINATION_DEFAULT_LIMIT : limitRaw))

const offset = (page - 1) * limit
```

**Impact:** Prevents DoS via large pagination requests

---

## 4. ✅ Add Database Connectivity Check at Startup (15 min) - **CRITICAL**

**File:** `src/instrumentation.ts`

**Issue:** No database connectivity validation at startup. Server may start successfully but fail all requests if database is unavailable.

**Fix:**
```typescript
// Add after line 20:
/**
 * Validate database connectivity on startup
 */
async function validateDatabase() {
  try {
    const { db } = await import('./lib/db')
    const { sql } = await import('drizzle-orm')

    // Test database connection with a simple query
    const result = db.execute(sql`SELECT 1 as test`).get()

    if (!result || (result as { test: number }).test !== 1) {
      throw new Error('Database query returned unexpected result')
    }

    return { success: true, error: null }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown database connection error'
    return { success: false, error: errorMsg }
  }
}

// In register() function, add before validateSecrets() call (line 117):
const dbValidation = await validateDatabase()
if (!dbValidation.success) {
  console.error('\n=== DATABASE CONNECTION FAILED ===')
  console.error(`❌ ${dbValidation.error}`)
  console.error('===================================\n')
  throw new Error(
    `Database connection failed: ${dbValidation.error}. Check that the database file exists and is readable.`
  )
}

structuredLogger.info('Database connection validated successfully')
```

**Impact:** Fail-fast on startup if database is unavailable

---

## 5. ⚠️ Replace console.error() with Structured Logger (Optional - 1-2 hours)

**Files:** 25 files with `console.error()` or `console.warn()` calls

**Issue:** Using `console.error()` directly makes logs harder to parse, lacks context, and doesn't integrate well with log aggregators in production.

**Recommendation:**
- **Priority Fix:** Update `src/app/api/guest/verify-code/route.ts` first (most critical auth flow)
- **Future Work:** Gradually migrate other files using ESLint rule

**Example Fix for verify-code.ts:**
```typescript
// Add import:
import { structuredLogger } from '@/lib/structured-logger'

// Replace console.error() calls with:
structuredLogger.error(
  'Failed to invalidate verification code',
  err instanceof Error ? err : new Error(String(err)),
  { email: normalizedEmail }
)

// Replace console.warn() calls with:
structuredLogger.warn('Unifi authorization failed for MAC', {
  macAddress,
  email: normalizedEmail,
})
```

**Impact:** Better observability and log aggregation in production

---

## Testing After Fixes

```bash
# Run unit tests
pnpm test

# Run E2E tests
pnpm test:e2e

# Verify production build
pnpm build

# Check linting
pnpm lint
```

All tests should pass (39 unit tests, all E2E tests).

---

## Deployment Checklist (After Fixes)

- [ ] All 5 fixes applied
- [ ] Tests pass: `pnpm test && pnpm test:e2e`
- [ ] Build succeeds: `pnpm build`
- [ ] Verify BETTER_AUTH_SECRET is production-grade (32+ chars)
- [ ] Verify ADMIN_PASSWORD meets complexity requirements
- [ ] Test database backup: `pnpm db:backup --verify`
- [ ] Review DEPLOYMENT.md for production setup
- [ ] Set up monitoring (Prometheus, UptimeRobot)

---

## Estimated Timeline

| Fix | Time | Priority |
|-----|------|----------|
| 1. Unifi ordering | 15 min | P0 |
| 2. MAC validation | 10 min | P0 |
| 3. Pagination bounds | 10 min | P1 |
| 4. DB connectivity | 15 min | P0 |
| 5. Structured logging | 1-2 hours | P2 (optional) |
| **Total (P0 fixes)** | **50 min** | **Must complete** |
| **Total (all fixes)** | **2-3 hours** | **Recommended** |

---

## Additional Recommendations (Lower Priority)

- Add search parameter length validation (max 50 chars) in admin guests route
- Implement background job monitoring (track failures, alert on 3+ consecutive failures)
- Add extend duration validation (1-365 days range)
- Consider disposable email blocking for guest auth

---

**Generated:** 2026-01-19
**Source:** Code review by Explore agent
**Full Report:** See agent output for comprehensive security analysis
