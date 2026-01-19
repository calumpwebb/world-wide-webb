/**
 * Next.js Instrumentation - Background Jobs
 *
 * This file runs once when the Next.js server starts.
 * We use setInterval here to schedule background sync jobs.
 *
 * Jobs:
 * - Connection event sync: every 1 minute
 * - DPI stats cache: every 5 minutes
 * - Authorization sync: every 5 minutes (DB/Unifi mismatch detection)
 * - Cleanup jobs: every 5 minutes
 * - Expiry reminders: every 5 minutes (but only sends every 12 hours)
 */

import {
  CONNECTION_SYNC_INTERVAL_MS,
  DPI_CACHE_INTERVAL_MS,
  AUTH_SYNC_INTERVAL_MS,
  CLEANUP_INTERVAL_MS,
} from './lib/constants/jobs'

/**
 * Validate production secrets and configuration on startup
 */
function validateSecrets() {
  const { NODE_ENV, BETTER_AUTH_SECRET, ADMIN_PASSWORD } = process.env
  const isProduction = NODE_ENV === 'production'
  const warnings: string[] = []
  const errors: string[] = []

  // Check BETTER_AUTH_SECRET
  if (!BETTER_AUTH_SECRET) {
    errors.push('BETTER_AUTH_SECRET is not set. Session encryption will fail.')
  } else if (BETTER_AUTH_SECRET.length < 32) {
    errors.push(
      'BETTER_AUTH_SECRET is too short (minimum 32 characters). Generate a strong secret with: openssl rand -base64 32'
    )
  } else if (
    isProduction &&
    (BETTER_AUTH_SECRET === 'change-this-secret-in-production' ||
      BETTER_AUTH_SECRET === 'your-secret-key-here' ||
      BETTER_AUTH_SECRET.includes('example') ||
      BETTER_AUTH_SECRET.includes('test'))
  ) {
    errors.push(
      'BETTER_AUTH_SECRET appears to be a default value. Generate a production secret with: openssl rand -base64 32'
    )
  }

  // Check ADMIN_PASSWORD in production
  if (isProduction && ADMIN_PASSWORD) {
    if (ADMIN_PASSWORD.length < 12) {
      warnings.push(
        'ADMIN_PASSWORD should be at least 12 characters in production for better security.'
      )
    }
    if (!/[A-Z]/.test(ADMIN_PASSWORD)) {
      warnings.push('ADMIN_PASSWORD should contain at least one uppercase letter.')
    }
    if (!/[a-z]/.test(ADMIN_PASSWORD)) {
      warnings.push('ADMIN_PASSWORD should contain at least one lowercase letter.')
    }
    if (!/[0-9]/.test(ADMIN_PASSWORD)) {
      warnings.push('ADMIN_PASSWORD should contain at least one number.')
    }
    if (!/[^A-Za-z0-9]/.test(ADMIN_PASSWORD)) {
      warnings.push('ADMIN_PASSWORD should contain at least one special character.')
    }
  }

  // Check Unifi Controller configuration
  if (!process.env.UNIFI_CONTROLLER_URL) {
    warnings.push('UNIFI_CONTROLLER_URL is not set. Network authorization will fail.')
  }
  if (!process.env.UNIFI_USERNAME || !process.env.UNIFI_PASSWORD) {
    warnings.push('UNIFI_USERNAME or UNIFI_PASSWORD is not set. Network authorization will fail.')
  }

  return { errors, warnings, isProduction }
}

export async function register() {
  // Only run on the server (not during build or in edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const {
      runConnectionSync,
      runDPICache,
      runAuthorizationSync,
      runCleanupJobs,
      runExpiryReminders,
    } = await import('./lib/cron-runner')
    const { structuredLogger } = await import('./lib/structured-logger')

    /**
     * Validate database connectivity on startup
     *
     * Tests that the database file exists, is readable, and can execute queries.
     * This ensures we fail fast if the database is unavailable rather than
     * failing on first request.
     */
    const validateDatabase = async () => {
      try {
        const { db, users } = await import('./lib/db')
        const { sql } = await import('drizzle-orm')

        // Test database connection with a simple count query
        const result = db
          .select({ count: sql<number>`count(*)` })
          .from(users)
          .get()

        if (result === undefined) {
          throw new Error('Database query returned undefined')
        }

        return { success: true, error: null }
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown database connection error'
        return { success: false, error: errorMsg }
      }
    }

    // Validate database connectivity first
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

    // Validate secrets
    const { errors, warnings, isProduction } = validateSecrets()

    if (errors.length > 0) {
      console.error('\n=== CRITICAL CONFIGURATION ERRORS ===')
      errors.forEach((error) => console.error(`❌ ${error}`))
      console.error('=====================================\n')

      if (isProduction) {
        // Fail in production
        throw new Error(
          'Critical configuration errors detected. Fix the above errors before starting in production.'
        )
      } else {
        // Warn in development
        console.warn(
          '⚠️  Development mode: continuing despite errors, but fix them before deploying.'
        )
      }
    }

    if (warnings.length > 0) {
      console.warn('\n=== CONFIGURATION WARNINGS ===')
      warnings.forEach((warning) => console.warn(`⚠️  ${warning}`))
      console.warn('==============================\n')
    }

    if (errors.length === 0 && warnings.length === 0 && isProduction) {
      structuredLogger.info('Production configuration validated successfully')
    }

    structuredLogger.info('Starting background job scheduler')

    // Connection sync every 1 minute
    setInterval(() => {
      runConnectionSync().catch((err) =>
        structuredLogger.error('Connection sync job failed', err, { job: 'connection-sync' })
      )
    }, CONNECTION_SYNC_INTERVAL_MS)

    // DPI cache every 5 minutes
    setInterval(() => {
      runDPICache().catch((err) =>
        structuredLogger.error('DPI cache job failed', err, { job: 'dpi-cache' })
      )
    }, DPI_CACHE_INTERVAL_MS)

    // Authorization sync every 5 minutes
    setInterval(() => {
      runAuthorizationSync().catch((err) =>
        structuredLogger.error('Authorization sync job failed', err, {
          job: 'authorization-sync',
        })
      )
    }, AUTH_SYNC_INTERVAL_MS)

    // Cleanup jobs every 5 minutes
    setInterval(() => {
      runCleanupJobs().catch((err) =>
        structuredLogger.error('Cleanup job failed', err, { job: 'cleanup' })
      )
    }, CLEANUP_INTERVAL_MS)

    // Expiry reminders every 5 minutes (internally throttled to 12 hours)
    setInterval(() => {
      runExpiryReminders().catch((err) =>
        structuredLogger.error('Expiry reminder job failed', err, { job: 'expiry-reminders' })
      )
    }, CLEANUP_INTERVAL_MS)

    // Run initial sync after a short delay (let the server fully start)
    setTimeout(() => {
      structuredLogger.info('Running initial background job sync')
      runConnectionSync().catch((err) =>
        structuredLogger.error('Initial connection sync failed', err, { job: 'initial-sync' })
      )
    }, 10000)

    structuredLogger.info('Background jobs scheduled successfully')
  }
}
