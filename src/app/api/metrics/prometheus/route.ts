import { NextResponse } from 'next/server'
import { db, users, guests, activityLogs, verificationCodes } from '@/lib/db'
import { sql, eq, gt, and, gte, lte, count } from 'drizzle-orm'

/**
 * Prometheus metrics endpoint
 * Returns metrics in Prometheus text format for scraping
 *
 * Usage: Configure Prometheus to scrape this endpoint at /api/metrics/prometheus
 *
 * Example prometheus.yml:
 * scrape_configs:
 *   - job_name: 'captive-portal'
 *     static_configs:
 *       - targets: ['localhost:3000']
 *     metrics_path: '/api/metrics/prometheus'
 *     scrape_interval: 30s
 */
export async function GET() {
  try {
    const now = new Date()
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

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

    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
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

    // Format as Prometheus metrics
    // See: https://prometheus.io/docs/instrumenting/exposition_formats/
    const metrics = [
      '# HELP captive_portal_guests_total Total number of guest authorizations',
      '# TYPE captive_portal_guests_total counter',
      `captive_portal_guests_total ${totalAuthorizations}`,
      '',
      '# HELP captive_portal_guests_active Number of active guest authorizations',
      '# TYPE captive_portal_guests_active gauge',
      `captive_portal_guests_active ${activeAuthorizations}`,
      '',
      '# HELP captive_portal_guests_expired Number of expired guest authorizations',
      '# TYPE captive_portal_guests_expired gauge',
      `captive_portal_guests_expired ${expiredAuthorizations}`,
      '',
      '# HELP captive_portal_guests_expiring_soon Number of authorizations expiring within 24 hours',
      '# TYPE captive_portal_guests_expiring_soon gauge',
      `captive_portal_guests_expiring_soon ${expiringSoon}`,
      '',
      '# HELP captive_portal_guests_unique_users Number of unique guest users',
      '# TYPE captive_portal_guests_unique_users gauge',
      `captive_portal_guests_unique_users ${uniqueUsers}`,
      '',
      '# HELP captive_portal_auth_success_total Successful authentications in last 24 hours',
      '# TYPE captive_portal_auth_success_total counter',
      `captive_portal_auth_success_total ${successfulAuths}`,
      '',
      '# HELP captive_portal_auth_fail_total Failed authentications in last 24 hours',
      '# TYPE captive_portal_auth_fail_total counter',
      `captive_portal_auth_fail_total ${failedAuths}`,
      '',
      '# HELP captive_portal_verifications_pending Pending verification codes',
      '# TYPE captive_portal_verifications_pending gauge',
      `captive_portal_verifications_pending ${pendingVerifications}`,
      '',
      '# HELP captive_portal_admins_total Total number of admin users',
      '# TYPE captive_portal_admins_total gauge',
      `captive_portal_admins_total ${totalAdmins}`,
      '',
      '# HELP captive_portal_revocations_24h Number of revocations in last 24 hours',
      '# TYPE captive_portal_revocations_24h counter',
      `captive_portal_revocations_24h ${revocationsLast24h}`,
      '',
      '# HELP captive_portal_devices_total Total number of unique devices',
      '# TYPE captive_portal_devices_total counter',
      `captive_portal_devices_total ${totalDevices}`,
      '',
      '# HELP captive_portal_devices_active Number of devices with active authorization',
      '# TYPE captive_portal_devices_active gauge',
      `captive_portal_devices_active ${activeDevices}`,
    ].join('\n')

    return new NextResponse(metrics, {
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      },
    })
  } catch (error) {
    console.error('Prometheus metrics error:', error)
    return new NextResponse('# ERROR: Failed to generate metrics\n', {
      status: 500,
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      },
    })
  }
}
