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
    const { structuredLogger } = await import('./lib/structured-logger')

    structuredLogger.info('Starting background job scheduler')

    // Connection sync every 1 minute
    setInterval(
      () => {
        runConnectionSync().catch((err) =>
          structuredLogger.error('Connection sync job failed', err, { job: 'connection-sync' })
        )
      },
      1 * 60 * 1000
    )

    // DPI cache every 5 minutes
    setInterval(
      () => {
        runDPICache().catch((err) =>
          structuredLogger.error('DPI cache job failed', err, { job: 'dpi-cache' })
        )
      },
      5 * 60 * 1000
    )

    // Cleanup jobs every 5 minutes
    setInterval(
      () => {
        runCleanupJobs().catch((err) =>
          structuredLogger.error('Cleanup job failed', err, { job: 'cleanup' })
        )
      },
      5 * 60 * 1000
    )

    // Expiry reminders every 5 minutes (internally throttled to 12 hours)
    setInterval(
      () => {
        runExpiryReminders().catch((err) =>
          structuredLogger.error('Expiry reminder job failed', err, { job: 'expiry-reminders' })
        )
      },
      5 * 60 * 1000
    )

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
