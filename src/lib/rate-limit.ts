import { db, rateLimits } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import {
  ONE_HOUR_MS,
  FIFTEEN_MINUTES_MS,
  THIRTY_MINUTES_MS,
  VERIFY_EMAIL_MAX_ATTEMPTS_DEFAULT,
  RESEND_CODE_MAX_ATTEMPTS_DEFAULT,
  LOGIN_MAX_ATTEMPTS_DEFAULT,
  ADMIN_LOGIN_MAX_ATTEMPTS_DEFAULT,
} from './constants'

export type RateLimitAction = 'verify' | 'resend' | 'login' | 'admin_login'

interface RateLimitConfig {
  maxAttempts: number
  windowMs: number // Time window in milliseconds
  lockoutMs?: number // Optional lockout duration after limit exceeded
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: Date
  lockedUntil?: Date
}

const DEFAULT_CONFIGS: Record<RateLimitAction, RateLimitConfig> = {
  verify: {
    maxAttempts: parseInt(
      process.env.RATE_LIMIT_VERIFY_EMAIL || String(VERIFY_EMAIL_MAX_ATTEMPTS_DEFAULT)
    ),
    windowMs: ONE_HOUR_MS,
  },
  resend: {
    maxAttempts: parseInt(
      process.env.MAX_RESENDS_PER_HOUR || String(RESEND_CODE_MAX_ATTEMPTS_DEFAULT)
    ),
    windowMs: ONE_HOUR_MS,
  },
  login: {
    maxAttempts: parseInt(
      process.env.RATE_LIMIT_LOGIN_ATTEMPTS || String(LOGIN_MAX_ATTEMPTS_DEFAULT)
    ),
    windowMs: FIFTEEN_MINUTES_MS,
    lockoutMs: FIFTEEN_MINUTES_MS,
  },
  admin_login: {
    maxAttempts: parseInt(
      process.env.RATE_LIMIT_ADMIN_LOGIN_ATTEMPTS || String(ADMIN_LOGIN_MAX_ATTEMPTS_DEFAULT)
    ),
    windowMs: FIFTEEN_MINUTES_MS,
    lockoutMs: THIRTY_MINUTES_MS,
  },
}

/**
 * Check and update rate limit for an identifier and action.
 *
 * This function implements a sliding window rate limiter with optional lockout support.
 * It tracks attempts over time and can temporarily lock out users who exceed limits.
 *
 * **State Machine Logic:**
 * 1. If locked out → Deny immediately and return lockedUntil timestamp
 * 2. If no record OR window expired → Allow and reset to 1 attempt
 * 3. If at maxAttempts → Deny and apply lockout (if configured)
 * 4. If under maxAttempts → Allow and increment attempt counter
 *
 * **Rate Limit Types:**
 * - `verify`: Email verification (5/hour, no lockout)
 * - `resend`: Code resend (3/hour, no lockout)
 * - `login`: User login (5/15min, 15min lockout)
 * - `admin_login`: Admin login (5/15min, 30min lockout)
 *
 * **Important:** This function has side effects - it updates the database on every call.
 * Use `getRateLimitStatus()` for read-only checks.
 *
 * @param identifier - Unique identifier for rate limiting (email address or IP)
 * @param action - The rate-limited action type (verify, resend, login, admin_login)
 * @param config - Optional custom rate limit configuration to override defaults
 * @returns Promise resolving to result with allowed status, remaining attempts, reset time, and optional lockout time
 *
 * @example
 * ```typescript
 * // Check if user can attempt login
 * const result = await checkRateLimit('user@example.com', 'login')
 * if (!result.allowed) {
 *   if (result.lockedUntil) {
 *     return res.status(429).json({ error: 'Account locked due to too many attempts' })
 *   }
 *   return res.status(429).json({ error: 'Rate limit exceeded' })
 * }
 * // Proceed with login attempt...
 * ```
 */
export async function checkRateLimit(
  identifier: string,
  action: RateLimitAction,
  config?: Partial<RateLimitConfig>
): Promise<RateLimitResult> {
  const finalConfig = { ...DEFAULT_CONFIGS[action], ...config }
  const now = new Date()
  const windowStart = new Date(now.getTime() - finalConfig.windowMs)

  // Find existing rate limit record
  const existing = await db
    .select()
    .from(rateLimits)
    .where(and(eq(rateLimits.identifier, identifier), eq(rateLimits.action, action)))
    .get()

  // Check if currently locked out
  if (existing?.lockedUntil && existing.lockedUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.lockedUntil,
      lockedUntil: existing.lockedUntil,
    }
  }

  // If no record or window has passed, allow and reset
  if (!existing || !existing.lastAttempt || existing.lastAttempt < windowStart) {
    if (existing) {
      await db
        .update(rateLimits)
        .set({ attempts: 1, lastAttempt: now, lockedUntil: null })
        .where(eq(rateLimits.id, existing.id))
    } else {
      await db.insert(rateLimits).values({
        identifier,
        action,
        attempts: 1,
        lastAttempt: now,
      })
    }

    return {
      allowed: true,
      remaining: finalConfig.maxAttempts - 1,
      resetAt: new Date(now.getTime() + finalConfig.windowMs),
    }
  }

  const currentAttempts = existing.attempts || 0

  // Check if limit exceeded
  if (currentAttempts >= finalConfig.maxAttempts) {
    // Apply lockout if configured
    if (finalConfig.lockoutMs) {
      const lockedUntil = new Date(now.getTime() + finalConfig.lockoutMs)
      await db.update(rateLimits).set({ lockedUntil }).where(eq(rateLimits.id, existing.id))

      return {
        allowed: false,
        remaining: 0,
        resetAt: lockedUntil,
        lockedUntil,
      }
    }

    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(existing.lastAttempt.getTime() + finalConfig.windowMs),
    }
  }

  // Allow and increment
  await db
    .update(rateLimits)
    .set({ attempts: currentAttempts + 1, lastAttempt: now })
    .where(eq(rateLimits.id, existing.id))

  return {
    allowed: true,
    remaining: finalConfig.maxAttempts - currentAttempts - 1,
    resetAt: new Date(now.getTime() + finalConfig.windowMs),
  }
}

/**
 * Reset rate limit for an identifier and action by deleting the record.
 *
 * Call this after a successful action to clear the attempt counter and any lockout state.
 * The next call to `checkRateLimit()` will start fresh with 0 attempts.
 *
 * **Common Use Cases:**
 * - After successful login (clear failed login attempts)
 * - After successful email verification (clear verification attempts)
 * - Manual admin override to unlock an account
 *
 * @param identifier - Unique identifier for rate limiting (email address or IP)
 * @param action - The rate-limited action type to reset
 * @returns Promise that resolves when the rate limit record is deleted
 *
 * @example
 * ```typescript
 * // Clear rate limit after successful login
 * await resetRateLimit('user@example.com', 'login')
 * ```
 */
export async function resetRateLimit(identifier: string, action: RateLimitAction): Promise<void> {
  await db
    .delete(rateLimits)
    .where(and(eq(rateLimits.identifier, identifier), eq(rateLimits.action, action)))
}

/**
 * Get current rate limit status without incrementing attempt counter.
 *
 * This is a read-only version of `checkRateLimit()` that does NOT update the database.
 * Use this when you need to check rate limit status without consuming an attempt.
 *
 * **Use Cases:**
 * - Displaying remaining attempts to the user
 * - Pre-flight checks before expensive operations
 * - Monitoring/admin dashboards showing rate limit states
 *
 * @param identifier - Unique identifier for rate limiting (email address or IP)
 * @param action - The rate-limited action type (verify, resend, login, admin_login)
 * @returns Promise resolving to current status, or null if no rate limit record exists
 *
 * @example
 * ```typescript
 * // Check status before showing a form
 * const status = await getRateLimitStatus('user@example.com', 'login')
 * if (status?.lockedUntil) {
 *   return <div>Your account is locked until {status.lockedUntil.toLocaleString()}</div>
 * }
 * ```
 */
export async function getRateLimitStatus(
  identifier: string,
  action: RateLimitAction
): Promise<RateLimitResult | null> {
  const config = DEFAULT_CONFIGS[action]
  const now = new Date()
  const windowStart = new Date(now.getTime() - config.windowMs)

  const existing = await db
    .select()
    .from(rateLimits)
    .where(and(eq(rateLimits.identifier, identifier), eq(rateLimits.action, action)))
    .get()

  if (!existing) {
    return null
  }

  // Check if locked
  if (existing.lockedUntil && existing.lockedUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.lockedUntil,
      lockedUntil: existing.lockedUntil,
    }
  }

  // Check if window has passed
  if (!existing.lastAttempt || existing.lastAttempt < windowStart) {
    return {
      allowed: true,
      remaining: config.maxAttempts,
      resetAt: new Date(now.getTime() + config.windowMs),
    }
  }

  const remaining = Math.max(0, config.maxAttempts - (existing.attempts || 0))

  return {
    allowed: remaining > 0,
    remaining,
    resetAt: new Date(existing.lastAttempt.getTime() + config.windowMs),
  }
}

/**
 * Format a user-friendly rate limit error message for API responses.
 *
 * Generates a human-readable message indicating how long until the rate limit resets.
 * Distinguishes between lockouts (more severe) and regular rate limits.
 *
 * @param result - The rate limit result from `checkRateLimit()`
 * @returns User-friendly error message with time remaining
 *
 * @example
 * ```typescript
 * const result = await checkRateLimit('user@example.com', 'login')
 * if (!result.allowed) {
 *   return res.status(429).json({ error: formatRateLimitError(result) })
 * }
 * // Output: "Too many attempts. Please try again in 15 minutes."
 * ```
 */
export function formatRateLimitError(result: RateLimitResult): string {
  if (result.lockedUntil) {
    const minutesRemaining = Math.ceil((result.lockedUntil.getTime() - Date.now()) / 1000 / 60)
    return `Too many attempts. Please try again in ${minutesRemaining} ${minutesRemaining === 1 ? 'minute' : 'minutes'}.`
  }

  const minutesRemaining = Math.ceil((result.resetAt.getTime() - Date.now()) / 1000 / 60)
  return `Rate limit exceeded. Please try again in ${minutesRemaining} ${minutesRemaining === 1 ? 'minute' : 'minutes'}.`
}
