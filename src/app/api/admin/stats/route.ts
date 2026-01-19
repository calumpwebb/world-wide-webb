import { NextResponse } from 'next/server'
import { db, guests, networkStats } from '@/lib/db'
import { gt, and, lt, sql } from 'drizzle-orm'
import { requireAdmin, AdminAuthError } from '@/lib/session'
import { ONE_DAY_MS } from '@/lib/constants'

export async function GET() {
  try {
    // Validate admin session with 2FA
    await requireAdmin()
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayEnd = new Date(todayStart.getTime() + ONE_DAY_MS)
    const yesterday = new Date(now.getTime() - ONE_DAY_MS)

    // Count active guests (not expired)
    const activeGuestsResult = db
      .select({ count: sql<number>`count(DISTINCT ${guests.userId})` })
      .from(guests)
      .where(gt(guests.expiresAt, now))
      .get()
    const activeGuests = activeGuestsResult?.count || 0

    // Count total authorized guests (all time)
    const totalAuthorizedResult = db
      .select({ count: sql<number>`count(DISTINCT ${guests.userId})` })
      .from(guests)
      .get()
    const totalAuthorized = totalAuthorizedResult?.count || 0

    // Count guests expiring today
    const expiringTodayResult = db
      .select({ count: sql<number>`count(*)` })
      .from(guests)
      .where(and(gt(guests.expiresAt, todayStart), lt(guests.expiresAt, todayEnd)))
      .get()
    const expiringToday = expiringTodayResult?.count || 0

    // Calculate total bandwidth in last 24 hours
    const bandwidthResult = db
      .select({
        totalReceived: sql<number>`COALESCE(SUM(${networkStats.bytesReceived}), 0)`,
        totalSent: sql<number>`COALESCE(SUM(${networkStats.bytesSent}), 0)`,
      })
      .from(networkStats)
      .where(gt(networkStats.timestamp, yesterday))
      .get()

    const totalBytes = (bandwidthResult?.totalReceived || 0) + (bandwidthResult?.totalSent || 0)
    let totalBandwidth = '0 B'

    if (totalBytes >= 1024 * 1024 * 1024) {
      totalBandwidth = `${(totalBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
    } else if (totalBytes >= 1024 * 1024) {
      totalBandwidth = `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`
    } else if (totalBytes >= 1024) {
      totalBandwidth = `${(totalBytes / 1024).toFixed(1)} KB`
    } else if (totalBytes > 0) {
      totalBandwidth = `${totalBytes} B`
    }

    return NextResponse.json(
      {
        activeGuests,
        totalAuthorized,
        expiringToday,
        totalBandwidth,
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        },
      }
    )
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { error: 'Unauthorized', code: error.code },
        { status: error.code === 'no_2fa' ? 403 : 401 }
      )
    }
    console.error('Stats API error:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
