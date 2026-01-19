import { NextResponse } from 'next/server'
import { db, guests, users, activityLogs } from '@/lib/db'
import { gt, and, lt, eq, desc, sql } from 'drizzle-orm'
import { requireAdmin, AdminAuthError } from '@/lib/session'

export interface Alert {
  id: string
  type: 'expiring' | 'failed_auth' | 'new_guest' | 'high_bandwidth'
  severity: 'info' | 'warning' | 'critical'
  title: string
  message: string
  timestamp: Date
  link?: string
}

export async function GET() {
  try {
    await requireAdmin()
    const now = new Date()
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

    const alerts: Alert[] = []

    // Alert 1: Guests expiring in the next 24 hours
    const expiringGuests = db
      .select({
        id: guests.id,
        macAddress: guests.macAddress,
        expiresAt: guests.expiresAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(guests)
      .leftJoin(users, eq(guests.userId, users.id))
      .where(and(gt(guests.expiresAt, now), lt(guests.expiresAt, twentyFourHoursFromNow)))
      .all()

    if (expiringGuests.length > 0) {
      alerts.push({
        id: 'expiring-guests',
        type: 'expiring',
        severity: expiringGuests.length >= 5 ? 'warning' : 'info',
        title: 'Guests Expiring Soon',
        message: `${expiringGuests.length} guest${expiringGuests.length > 1 ? 's' : ''} will expire within 24 hours`,
        timestamp: now,
        link: '/admin/guests?filter=expiring',
      })
    }

    // Alert 2: Failed authentication attempts in the last hour
    const failedAuths = db
      .select({ count: sql<number>`count(*)` })
      .from(activityLogs)
      .where(and(eq(activityLogs.eventType, 'auth_fail'), gt(activityLogs.createdAt, oneHourAgo)))
      .get()

    const failedCount = failedAuths?.count || 0
    if (failedCount >= 3) {
      alerts.push({
        id: 'failed-auths',
        type: 'failed_auth',
        severity: failedCount >= 10 ? 'critical' : 'warning',
        title: 'Failed Auth Attempts',
        message: `${failedCount} failed authentication attempts in the last hour`,
        timestamp: now,
        link: '/admin/logs?filter=auth_fail',
      })
    }

    // Alert 3: New guests in the last hour
    const newGuests = db
      .select({ count: sql<number>`count(*)` })
      .from(activityLogs)
      .where(
        and(eq(activityLogs.eventType, 'auth_success'), gt(activityLogs.createdAt, oneHourAgo))
      )
      .get()

    const newCount = newGuests?.count || 0
    if (newCount > 0) {
      // Get the most recent new guest
      const latestGuest = db
        .select({
          userName: users.name,
          userEmail: users.email,
          createdAt: activityLogs.createdAt,
        })
        .from(activityLogs)
        .leftJoin(users, eq(activityLogs.userId, users.id))
        .where(
          and(eq(activityLogs.eventType, 'auth_success'), gt(activityLogs.createdAt, oneHourAgo))
        )
        .orderBy(desc(activityLogs.createdAt))
        .limit(1)
        .get()

      alerts.push({
        id: 'new-guests',
        type: 'new_guest',
        severity: 'info',
        title: 'New Guest Connected',
        message:
          newCount === 1
            ? `${latestGuest?.userName || 'A guest'} just connected`
            : `${newCount} new guests connected in the last hour`,
        timestamp: latestGuest?.createdAt || now,
        link: '/admin/guests',
      })
    }

    // Sort alerts by severity (critical > warning > info) then by timestamp
    const severityOrder = { critical: 0, warning: 1, info: 2 }
    alerts.sort((a, b) => {
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity]
      if (severityDiff !== 0) return severityDiff
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    })

    return NextResponse.json({
      alerts,
      summary: {
        total: alerts.length,
        critical: alerts.filter((a) => a.severity === 'critical').length,
        warning: alerts.filter((a) => a.severity === 'warning').length,
        info: alerts.filter((a) => a.severity === 'info').length,
      },
    })
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { error: 'Unauthorized', code: error.code },
        { status: error.code === 'no_2fa' ? 403 : 401 }
      )
    }
    console.error('Alerts API error:', error)
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 })
  }
}
