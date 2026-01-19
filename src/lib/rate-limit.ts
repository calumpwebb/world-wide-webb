import { db, rateLimits } from '@/lib/db'
import { eq, and } from 'drizzle-orm'

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
    maxAttempts: parseInt(process.env.RATE_LIMIT_VERIFY_EMAIL || '5'),
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  resend: {
    maxAttempts: parseInt(process.env.MAX_RESENDS_PER_HOUR || '3'),
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  login: {
    maxAttempts: parseInt(process.env.RATE_LIMIT_LOGIN_ATTEMPTS || '5'),
    windowMs: 15 * 60 * 1000, // 15 minutes
    lockoutMs: 15 * 60 * 1000, // 15 minute lockout
  },
  admin_login: {
    maxAttempts: parseInt(process.env.RATE_LIMIT_ADMIN_LOGIN_ATTEMPTS || '5'),
    windowMs: 15 * 60 * 1000, // 15 minutes
    lockoutMs: 30 * 60 * 1000, // 30 minute lockout
  },
}

/**
 * Check and update rate limit for an identifier and action
 *
 * @param identifier - Email address or IP address
 * @param action - The rate-limited action type
 * @param config - Optional custom rate limit configuration
 * @returns Result indicating if the action is allowed
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
 * Reset rate limit for an identifier and action (e.g., after successful login)
 */
export async function resetRateLimit(identifier: string, action: RateLimitAction): Promise<void> {
  await db
    .delete(rateLimits)
    .where(and(eq(rateLimits.identifier, identifier), eq(rateLimits.action, action)))
}

/**
 * Get current rate limit status without incrementing
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
 * Format rate limit error message for API response
 */
export function formatRateLimitError(result: RateLimitResult): string {
  if (result.lockedUntil) {
    const minutesRemaining = Math.ceil((result.lockedUntil.getTime() - Date.now()) / 1000 / 60)
    return `Too many attempts. Please try again in ${minutesRemaining} ${minutesRemaining === 1 ? 'minute' : 'minutes'}.`
  }

  const minutesRemaining = Math.ceil((result.resetAt.getTime() - Date.now()) / 1000 / 60)
  return `Rate limit exceeded. Please try again in ${minutesRemaining} ${minutesRemaining === 1 ? 'minute' : 'minutes'}.`
}
