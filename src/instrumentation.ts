/**
 * Next.js Instrumentation - Background Jobs
 *
 * This file runs once when the Next.js server starts.
 * We use setInterval here to schedule background sync jobs.
 *
 * Jobs:
 * - Connection event sync: every 1 minute
 * - DPI stats cache: every 5 minutes
 * - Cleanup jobs: every 5 minutes
 * - Expiry reminders: every 5 minutes (but only sends every 12 hours)
 */

export async function register() {
  // Only run on the server (not during build or in edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { runConnectionSync, runDPICache, runCleanupJobs, runExpiryReminders } =
      await import('./lib/cron-runner')

    console.log('[Instrumentation] Starting background job scheduler...')

    // Connection sync every 1 minute
    setInterval(
      () => {
        runConnectionSync().catch((err) => console.error('[Cron] Connection sync error:', err))
      },
      1 * 60 * 1000
    )

    // DPI cache every 5 minutes
    setInterval(
      () => {
        runDPICache().catch((err) => console.error('[Cron] DPI cache error:', err))
      },
      5 * 60 * 1000
    )

    // Cleanup jobs every 5 minutes
    setInterval(
      () => {
        runCleanupJobs().catch((err) => console.error('[Cron] Cleanup error:', err))
      },
      5 * 60 * 1000
    )

    // Expiry reminders every 5 minutes (internally throttled to 12 hours)
    setInterval(
      () => {
        runExpiryReminders().catch((err) => console.error('[Cron] Expiry reminder error:', err))
      },
      5 * 60 * 1000
    )

    // Run initial sync after a short delay (let the server fully start)
    setTimeout(() => {
      console.log('[Instrumentation] Running initial background job sync...')
      runConnectionSync().catch((err) =>
        console.error('[Cron] Initial connection sync error:', err)
      )
    }, 10000)

    console.log('[Instrumentation] Background jobs scheduled successfully')
  }
}
