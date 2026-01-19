import { NextResponse } from 'next/server'
import { db, users, guests, activityLogs, verificationCodes } from '@/lib/db'
import { sql, eq, gt, and, gte, lte, count } from 'drizzle-orm'
import { ONE_DAY_MS } from '@/lib/constants'

interface Metrics {
  timestamp: string
  guests: {
    total: number
    activeAuthorizations: number
    expiredAuthorizations: number
    expiringSoon: number // within 24 hours
    uniqueUsers: number
  }
  authentication: {
    successfulAuths: number // last 24 hours
    failedAuths: number // last 24 hours
    pendingVerifications: number
  }
  admin: {
    totalAdmins: number
    revocationsLast24h: number
  }
  devices: {
    totalDevices: number // unique MACs ever seen
    activeDevices: number // MACs with unexpired authorization
  }
}

export async function GET() {
  try {
    const now = new Date()
    const twentyFourHoursAgo = new Date(now.getTime() - ONE_DAY_MS)

    // Guest metrics
    const totalAuthorizations =
      db
        .select({ count: sql<number>`count(*)` })
        .from(guests)
        .get()?.count || 0

    const activeAuthorizations =
      db
        .select({ count: sql<number>`count(*)` })
        .from(guests)
        .where(gt(guests.expiresAt, now))
        .get()?.count || 0

    const expiredAuthorizations = totalAuthorizations - activeAuthorizations

    // Expiring soon = expires within next 24 hours (still active but close to expiry)
    const twentyFourHoursFromNow = new Date(now.getTime() + ONE_DAY_MS)
    const expiringSoon =
      db
        .select({ count: sql<number>`count(*)` })
        .from(guests)
        .where(and(gt(guests.expiresAt, now), lte(guests.expiresAt, twentyFourHoursFromNow)))
        .get()?.count || 0

    const uniqueUsers =
      db
        .select({ count: sql<number>`count(DISTINCT ${guests.userId})` })
        .from(guests)
        .get()?.count || 0

    // Authentication metrics (last 24 hours)
    const successfulAuths =
      db
        .select({ count: sql<number>`count(*)` })
        .from(activityLogs)
        .where(
          and(
            eq(activityLogs.eventType, 'auth_success'),
            gte(activityLogs.createdAt, twentyFourHoursAgo)
          )
        )
        .get()?.count || 0

    const failedAuths =
      db
        .select({ count: sql<number>`count(*)` })
        .from(activityLogs)
        .where(
          and(
            eq(activityLogs.eventType, 'auth_fail'),
            gte(activityLogs.createdAt, twentyFourHoursAgo)
          )
        )
        .get()?.count || 0

    const pendingVerifications =
      db
        .select({ count: sql<number>`count(*)` })
        .from(verificationCodes)
        .where(and(eq(verificationCodes.used, false), gt(verificationCodes.expiresAt, now)))
        .get()?.count || 0

    // Admin metrics
    const totalAdmins =
      db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(eq(users.role, 'admin'))
        .get()?.count || 0

    const revocationsLast24h =
      db
        .select({ count: sql<number>`count(*)` })
        .from(activityLogs)
        .where(
          and(
            eq(activityLogs.eventType, 'admin_revoke'),
            gte(activityLogs.createdAt, twentyFourHoursAgo)
          )
        )
        .get()?.count || 0

    // Device metrics
    const totalDevices =
      db
        .select({ count: sql<number>`count(DISTINCT ${guests.macAddress})` })
        .from(guests)
        .get()?.count || 0

    const activeDevices =
      db.select({ count: count() }).from(guests).where(gt(guests.expiresAt, now)).get()?.count || 0

    const metrics: Metrics = {
      timestamp: now.toISOString(),
      guests: {
        total: totalAuthorizations,
        activeAuthorizations,
        expiredAuthorizations,
        expiringSoon,
        uniqueUsers,
      },
      authentication: {
        successfulAuths,
        failedAuths,
        pendingVerifications,
      },
      admin: {
        totalAdmins,
        revocationsLast24h,
      },
      devices: {
        totalDevices,
        activeDevices,
      },
    }

    return NextResponse.json(metrics)
  } catch (error) {
    console.error('Metrics API error:', error)
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 })
  }
}
