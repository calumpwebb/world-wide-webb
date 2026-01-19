/**
 * Background Sync Jobs
 *
 * Handles periodic tasks:
 * - Connection event sync: Track connects/disconnects (every 1 min)
 * - DPI stats cache: Cache bandwidth/domain stats from Unifi (every 5 min)
 * - Expiry cleanup: Revoke expired guest authorizations
 * - Session cleanup: Remove expired sessions
 */

import { db, guests, networkStats, sessions, users } from '@/lib/db'
import { sendExpiryReminder } from '@/lib/email'
import { logger } from '@/lib/logger'
import { unifi } from '@/lib/unifi'
import { eq, lt, gt, and, lte, inArray } from 'drizzle-orm'

// Track last seen MACs for connection event detection
let lastSeenMacs = new Set<string>()
let lastSyncTime = 0

interface SyncResult {
  success: boolean
  message: string
  details?: Record<string, unknown>
}

/**
 * Sync connection events by comparing current active clients with last known state
 */
export async function syncConnectionEvents(): Promise<SyncResult> {
  try {
    const activeClients = await unifi.getActiveClients()
    const currentMacs = new Set(activeClients.map((c) => c.mac.toLowerCase()))
    const now = new Date()

    // Batch load all guest records for active MACs to avoid N+1 queries
    const allMacs = new Set([...Array.from(currentMacs), ...Array.from(lastSeenMacs)])
    const guestRecords = db
      .select({
        userId: guests.userId,
        macAddress: guests.macAddress,
      })
      .from(guests)
      .where(inArray(guests.macAddress, Array.from(allMacs)))
      .all()

    // Create a map for O(1) lookups
    const guestMap = new Map(guestRecords.map((g) => [g.macAddress, g]))

    // Find newly connected devices
    const connected: string[] = []
    const disconnected: string[] = []

    for (const mac of Array.from(currentMacs)) {
      if (!lastSeenMacs.has(mac)) {
        connected.push(mac)

        const guest = guestMap.get(mac)
        const client = activeClients.find((c) => c.mac.toLowerCase() === mac)

        logger.connect({
          userId: guest?.userId,
          macAddress: mac,
          ipAddress: client?.ip,
          signalStrength: client?.rssi,
          apName: client?.essid,
        })
      }
    }

    // Find disconnected devices (only if we've synced before)
    if (lastSyncTime > 0) {
      for (const mac of Array.from(lastSeenMacs)) {
        if (!currentMacs.has(mac)) {
          disconnected.push(mac)

          const guest = guestMap.get(mac)

          // Calculate session duration if we have last sync time
          const sessionDuration = Math.floor((Date.now() - lastSyncTime) / 1000)

          logger.disconnect({
            userId: guest?.userId,
            macAddress: mac,
            sessionDuration,
          })
        }
      }
    }

    // Update last seen list
    lastSeenMacs = currentMacs
    lastSyncTime = Date.now()

    // Update lastSeen timestamp for all connected guests
    for (const mac of Array.from(currentMacs)) {
      try {
        db.update(guests).set({ lastSeen: now }).where(eq(guests.macAddress, mac)).run()
      } catch (err) {
        console.error(`Failed to update lastSeen for MAC ${mac}:`, err)
      }
    }

    return {
      success: true,
      message: `Synced connection events`,
      details: {
        activeClients: currentMacs.size,
        connected: connected.length,
        disconnected: disconnected.length,
      },
    }
  } catch (error) {
    console.error('Connection sync error:', error)
    return {
      success: false,
      message: `Connection sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Cache DPI stats from Unifi for all active guests
 */
export async function cacheDPIStats(): Promise<SyncResult> {
  try {
    const activeClients = await unifi.getActiveClients()
    const now = new Date()
    let cached = 0

    for (const client of activeClients) {
      // Skip if no MAC
      if (!client.mac) continue

      const mac = client.mac.toLowerCase()

      // Check if this MAC belongs to a guest
      const guest = db.select().from(guests).where(eq(guests.macAddress, mac)).get()

      if (!guest) continue

      // Get DPI stats for this client
      const dpiStats = await unifi.getDPIStats(mac)

      // Calculate total bytes from DPI categories
      let totalRx = 0
      let totalTx = 0
      const domains: string[] = []

      if (dpiStats?.by_cat) {
        for (const cat of dpiStats.by_cat) {
          totalRx += cat.rx_bytes
          totalTx += cat.tx_bytes
        }
      }

      // Use client's byte counts if DPI stats aren't available
      const bytesReceived = totalRx || client.rx_bytes || 0
      const bytesSent = totalTx || client.tx_bytes || 0

      // Insert stats record
      try {
        db.insert(networkStats)
          .values({
            macAddress: mac,
            timestamp: now,
            bytesReceived,
            bytesSent,
            domains: domains.length > 0 ? JSON.stringify(domains) : null,
            signalStrength: client.rssi,
            apMacAddress: client.ap_mac,
          })
          .run()
        cached++
      } catch (err) {
        console.error(`Failed to insert network stats for MAC ${mac}:`, err)
      }
    }

    return {
      success: true,
      message: `Cached DPI stats for ${cached} devices`,
      details: { cached, total: activeClients.length },
    }
  } catch (error) {
    console.error('DPI cache error:', error)
    return {
      success: false,
      message: `DPI cache failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Cleanup expired guest authorizations
 */
export async function cleanupExpiredGuests(): Promise<SyncResult> {
  try {
    const now = new Date()

    // Find expired guests that haven't been revoked yet (expiresAt in the past)
    const expiredGuests = db
      .select({
        id: guests.id,
        userId: guests.userId,
        macAddress: guests.macAddress,
        expiresAt: guests.expiresAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(guests)
      .leftJoin(users, eq(guests.userId, users.id))
      .where(lt(guests.expiresAt, now))
      .all()

    let revoked = 0
    const errors: string[] = []

    for (const guest of expiredGuests) {
      try {
        // Only revoke on Unifi if MAC exists
        if (guest.macAddress) {
          await unifi.unauthorizeGuest(guest.macAddress)
        }

        // Log the automatic revocation
        logger.adminRevoke({
          guestUserId: guest.userId,
          macAddress: guest.macAddress || undefined,
          guestId: guest.id,
          userName: guest.userName || undefined,
          userEmail: guest.userEmail || undefined,
        })

        revoked++
      } catch (err) {
        errors.push(`Failed to revoke guest ${guest.id}: ${err}`)
      }
    }

    return {
      success: errors.length === 0,
      message: `Revoked ${revoked} expired guest authorizations`,
      details: {
        expired: expiredGuests.length,
        revoked,
        errors: errors.length > 0 ? errors : undefined,
      },
    }
  } catch (error) {
    console.error('Expiry cleanup error:', error)
    return {
      success: false,
      message: `Expiry cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Cleanup expired sessions
 */
export async function cleanupExpiredSessions(): Promise<SyncResult> {
  try {
    const now = new Date()

    // Delete sessions that have expired
    const result = db.delete(sessions).where(lt(sessions.expiresAt, now)).run()

    return {
      success: true,
      message: `Cleaned up ${result.changes} expired sessions`,
      details: { deleted: result.changes },
    }
  } catch (error) {
    console.error('Session cleanup error:', error)
    return {
      success: false,
      message: `Session cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Cleanup old network stats (keep last 30 days)
 */
export async function cleanupOldStats(): Promise<SyncResult> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const result = db.delete(networkStats).where(lt(networkStats.timestamp, thirtyDaysAgo)).run()

    return {
      success: true,
      message: `Cleaned up ${result.changes} old network stats records`,
      details: { deleted: result.changes },
    }
  } catch (error) {
    console.error('Stats cleanup error:', error)
    return {
      success: false,
      message: `Stats cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

// Track when we last sent expiry reminders (to avoid duplicate emails)
let lastExpiryReminderTime = 0
const EXPIRY_REMINDER_INTERVAL = 12 * 60 * 60 * 1000 // 12 hours

/**
 * Send expiry reminder emails for guests expiring within 24 hours
 * Only sends once per 12 hours to avoid spam
 */
export async function sendExpiryReminders(): Promise<SyncResult> {
  try {
    const now = Date.now()

    // Skip if we sent reminders recently
    if (lastExpiryReminderTime > 0 && now - lastExpiryReminderTime < EXPIRY_REMINDER_INTERVAL) {
      return {
        success: true,
        message: 'Skipped - reminders sent recently',
        details: { lastSent: new Date(lastExpiryReminderTime).toISOString() },
      }
    }

    const currentDate = new Date()
    const twentyFourHoursFromNow = new Date(now + 24 * 60 * 60 * 1000)

    // Find guests expiring in the next 24 hours (but not yet expired)
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
      .where(and(gt(guests.expiresAt, currentDate), lte(guests.expiresAt, twentyFourHoursFromNow)))
      .all()

    if (expiringGuests.length === 0) {
      return {
        success: true,
        message: 'No guests expiring soon',
        details: { count: 0 },
      }
    }

    // Send reminder email
    await sendExpiryReminder(
      expiringGuests.map((g) => ({
        name: g.userName || 'Guest',
        email: g.userEmail || 'Unknown',
        macAddress: g.macAddress || 'Unknown',
        expiresAt: g.expiresAt,
      }))
    )

    lastExpiryReminderTime = now

    return {
      success: true,
      message: `Sent expiry reminder for ${expiringGuests.length} guests`,
      details: { count: expiringGuests.length },
    }
  } catch (error) {
    console.error('Expiry reminder error:', error)
    return {
      success: false,
      message: `Expiry reminder failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Run all sync jobs
 */
export async function runAllJobs(): Promise<Record<string, SyncResult>> {
  const results: Record<string, SyncResult> = {}

  results.connectionSync = await syncConnectionEvents()
  results.dpiCache = await cacheDPIStats()
  results.expiryCleanup = await cleanupExpiredGuests()
  results.sessionCleanup = await cleanupExpiredSessions()
  results.statsCleanup = await cleanupOldStats()
  results.expiryReminders = await sendExpiryReminders()

  return results
}
