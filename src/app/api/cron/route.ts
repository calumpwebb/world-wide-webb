/**
 * Cron Job API Endpoint
 *
 * Triggers background sync jobs. Can be called by:
 * - Vercel Cron (vercel.json configuration)
 * - External cron service
 * - Manual curl requests
 *
 * Security: Protected by CRON_SECRET environment variable
 *
 * Jobs:
 * - connections: Sync connection events (run every 1 min)
 * - dpi: Cache DPI stats (run every 5 min)
 * - cleanup: Expiry cleanup + session cleanup (run every 5 min)
 * - all: Run all jobs (for testing)
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  syncConnectionEvents,
  cacheDPIStats,
  cleanupExpiredGuests,
  cleanupExpiredSessions,
  cleanupOldStats,
  runAllJobs,
} from '@/lib/cron'

const CRON_SECRET = process.env.CRON_SECRET

export async function GET(request: NextRequest) {
  // Verify authorization
  const authHeader = request.headers.get('authorization')
  const cronSecret = request.nextUrl.searchParams.get('secret')

  // Allow if CRON_SECRET is not set (development mode)
  // or if the secret matches via header or query param
  if (CRON_SECRET) {
    const providedSecret = authHeader?.replace('Bearer ', '') || cronSecret

    if (providedSecret !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // Get job type from query param
  const job = request.nextUrl.searchParams.get('job') || 'all'

  try {
    let result

    switch (job) {
      case 'connections':
        result = { connections: await syncConnectionEvents() }
        break

      case 'dpi':
        result = { dpi: await cacheDPIStats() }
        break

      case 'cleanup':
        result = {
          expiryCleanup: await cleanupExpiredGuests(),
          sessionCleanup: await cleanupExpiredSessions(),
          statsCleanup: await cleanupOldStats(),
        }
        break

      case 'all':
        result = await runAllJobs()
        break

      default:
        return NextResponse.json(
          {
            error: 'Invalid job type',
            validJobs: ['connections', 'dpi', 'cleanup', 'all'],
          },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      job,
      timestamp: new Date().toISOString(),
      results: result,
    })
  } catch (error) {
    console.error('Cron job error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// Also support POST for Vercel Cron
export async function POST(request: NextRequest) {
  return GET(request)
}
