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
  sendExpiryReminders,
} from './cron'

export async function runConnectionSync() {
  const result = await syncConnectionEvents()
  if (result.success) {
    console.log(`[Cron] Connection sync: ${result.message}`, result.details)
  } else {
    console.error(`[Cron] Connection sync failed: ${result.message}`)
  }
  return result
}

export async function runDPICache() {
  const result = await cacheDPIStats()
  if (result.success) {
    console.log(`[Cron] DPI cache: ${result.message}`, result.details)
  } else {
    console.error(`[Cron] DPI cache failed: ${result.message}`)
  }
  return result
}

export async function runAuthorizationSync() {
  const result = await syncAuthorizationMismatches()
  if (result.success) {
    // Only log if we actually re-authorized something
    const reauthorized = (result.details?.reauthorized as number) || 0
    if (reauthorized > 0) {
      console.log(`[Cron] Authorization sync: ${result.message}`, result.details)
    }
  } else {
    console.error(`[Cron] Authorization sync failed: ${result.message}`)
  }
  return result
}

export async function runCleanupJobs() {
  const results = {
    expiredGuests: await cleanupExpiredGuests(),
    expiredSessions: await cleanupExpiredSessions(),
    oldStats: await cleanupOldStats(),
  }

  for (const [job, result] of Object.entries(results)) {
    if (result.success) {
      console.log(`[Cron] ${job}: ${result.message}`, result.details)
    } else {
      console.error(`[Cron] ${job} failed: ${result.message}`)
    }
  }

  return results
}

export async function runExpiryReminders() {
  const result = await sendExpiryReminders()
  if (result.success) {
    // Only log if we actually sent something (not skipped)
    if (!result.message.includes('Skipped')) {
      console.log(`[Cron] Expiry reminders: ${result.message}`, result.details)
    }
  } else {
    console.error(`[Cron] Expiry reminders failed: ${result.message}`)
  }
  return result
}
