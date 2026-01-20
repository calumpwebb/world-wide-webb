/**
 * Cron Job Runner
 *
 * Wrapper functions for cron jobs that handle errors and logging.
 * These are called from instrumentation.ts via setInterval.
 */

import {
  syncConnectionEvents,
  cacheDPIStats,
  syncAuthorizationMismatches,
  cleanupExpiredGuests,
  cleanupExpiredSessions,
  cleanupOldStats,
  cleanupExpiredVerificationCodes,
  sendExpiryReminders,
} from './cron'
import { structuredLogger } from './structured-logger'

export async function runConnectionSync() {
  const result = await syncConnectionEvents()
  if (result.success) {
    structuredLogger.info(`Connection sync: ${result.message}`, {
      job: 'connection_sync',
      ...result.details,
    })
  } else {
    structuredLogger.error(`Connection sync failed: ${result.message}`, undefined, {
      job: 'connection_sync',
    })
  }
  return result
}

export async function runDPICache() {
  const result = await cacheDPIStats()
  if (result.success) {
    structuredLogger.info(`DPI cache: ${result.message}`, {
      job: 'dpi_cache',
      ...result.details,
    })
  } else {
    structuredLogger.error(`DPI cache failed: ${result.message}`, undefined, {
      job: 'dpi_cache',
    })
  }
  return result
}

export async function runAuthorizationSync() {
  const result = await syncAuthorizationMismatches()
  if (result.success) {
    // Only log if we actually re-authorized something
    const reauthorized = (result.details?.reauthorized as number) || 0
    if (reauthorized > 0) {
      structuredLogger.info(`Authorization sync: ${result.message}`, {
        job: 'authorization_sync',
        ...result.details,
      })
    }
  } else {
    structuredLogger.error(`Authorization sync failed: ${result.message}`, undefined, {
      job: 'authorization_sync',
    })
  }
  return result
}

export async function runCleanupJobs() {
  const results = {
    expiredGuests: await cleanupExpiredGuests(),
    expiredSessions: await cleanupExpiredSessions(),
    oldStats: await cleanupOldStats(),
    expiredVerificationCodes: await cleanupExpiredVerificationCodes(),
  }

  for (const [job, result] of Object.entries(results)) {
    if (result.success) {
      structuredLogger.info(`${job}: ${result.message}`, {
        job: 'cleanup',
        cleanupType: job,
        ...result.details,
      })
    } else {
      structuredLogger.error(`${job} failed: ${result.message}`, undefined, {
        job: 'cleanup',
        cleanupType: job,
      })
    }
  }

  return results
}

export async function runExpiryReminders() {
  const result = await sendExpiryReminders()
  if (result.success) {
    // Only log if we actually sent something (not skipped)
    if (!result.message.includes('Skipped')) {
      structuredLogger.info(`Expiry reminders: ${result.message}`, {
        job: 'expiry_reminders',
        ...result.details,
      })
    }
  } else {
    structuredLogger.error(`Expiry reminders failed: ${result.message}`, undefined, {
      job: 'expiry_reminders',
    })
  }
  return result
}
