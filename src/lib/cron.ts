/**
 * Background Sync Jobs
 *
 * Handles periodic tasks:
 * - Connection event sync: Track connects/disconnects (every 1 min)
 * - DPI stats cache: Cache bandwidth/domain stats from Unifi (every 5 min)
 * - Expiry cleanup: Revoke expired guest authorizations
 * - Session cleanup: Remove expired sessions
 */

import { db, guests, networkStats, sessions, users, verificationCodes } from '@/lib/db'
import { sendExpiryReminder } from '@/lib/email'
import { logger } from '@/lib/logger'
import { unifi } from '@/lib/unifi'
import { eq, lt, gt, and, lte, inArray } from 'drizzle-orm'
import {
  ONE_DAY_MS,
  THIRTY_DAYS_MS,
  EXPIRY_REMINDER_INTERVAL_MS,
  DPI_TOP_APPS_LIMIT,
} from './constants'

// Track last seen MACs for connection event detection
let lastSeenMacs = new Set<string>()
let lastSyncTime = 0

interface SyncResult {
  success: boolean
  message: string
  details?: Record<string, unknown>
}

/**
 * Detect and log device connection/disconnection events by comparing network state.
 *
 * This background job maintains a stateful list of previously seen MAC addresses and
 * compares it against current active clients to detect connection state changes.
 *
 * **State Management (Module-Level Variables):**
 * - `lastSeenMacs`: Set of MAC addresses from the previous sync
 * - `lastSyncTime`: Timestamp of last sync (used for session duration calculation)
 *
 * **Algorithm:**
 * 1. Fetch current active clients from Unifi Controller
 * 2. Batch-load guest records for all MACs (prevents N+1 queries)
 * 3. Compare current MACs vs last seen MACs
 * 4. Log `connect` events for new MACs (with signal strength, AP name, IP)
 * 5. Log `disconnect` events for missing MACs (with session duration)
 * 6. Update `lastSeen` timestamp in database for all active guests
 *
 * **Performance Optimization:**
 * Uses `inArray()` to load all guest records in a single query, then builds an
 * in-memory `Map` for O(1) lookups. This prevents N+1 query problems when checking
 * hundreds of devices.
 *
 * **First Run Behavior:**
 * On the first sync (`lastSyncTime === 0`), skips disconnect detection to avoid
 * false positives. Only logs disconnects after establishing baseline state.
 *
 * **Runs Every:** 1 minute (configured in instrumentation.ts)
 *
 * @returns Promise resolving to sync result with connection/disconnection counts
 *
 * @example
 * ```typescript
 * // Background job called by instrumentation.ts
 * const result = await syncConnectionEvents()
 * console.log(`Found ${result.details.connected} new connections`)
 * ```
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

    // Batch update lastSeen timestamp for all connected guests
    if (currentMacs.size > 0) {
      try {
        db.update(guests)
          .set({ lastSeen: now })
          .where(inArray(guests.macAddress, Array.from(currentMacs)))
          .run()
      } catch (err) {
        console.error(`Failed to batch update lastSeen:`, err)
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
 * Fetch and cache Deep Packet Inspection (DPI) statistics from Unifi Controller.
 *
 * This background job retrieves bandwidth and application usage data for all active
 * guest devices and stores it in the `network_stats` table for display in dashboards.
 *
 * **What It Does:**
 * 1. Fetches all currently active clients from Unifi Controller
 * 2. Filters for clients that have guest records in the database
 * 3. Fetches DPI stats for each guest MAC (application/category bandwidth)
 * 4. Aggregates total RX/TX bytes from DPI category data
 * 5. Stores top N applications (limited by `DPI_TOP_APPS_LIMIT`) as JSON
 * 6. Falls back to client-level bandwidth if DPI data unavailable
 *
 * **DPI Data Structure:**
 * - `by_cat`: Array of bandwidth by traffic category (social, streaming, gaming, etc.)
 * - `by_app`: Array of bandwidth by application (app/category IDs)
 * - **Note:** Application IDs are numeric - mapping to names requires Unifi's app database
 *
 * **Top Apps Limiting:**
 * Only stores top N apps (`DPI_TOP_APPS_LIMIT`, currently 10) to prevent database bloat.
 * Apps are pre-sorted by bandwidth in the Unifi response, so we slice the first N.
 *
 * **Fallback Behavior:**
 * If DPI stats are unavailable (feature disabled, older firmware, etc.), falls back to
 * client-level `rx_bytes`/`tx_bytes` counters for basic bandwidth tracking.
 *
 * **Domains Field:**
 * The `domains` field stores top DPI applications as JSON (app/category IDs).
 * Actual domain names would require parsing Unifi firewall logs, which aren't
 * easily accessible via the API.
 *
 * **Runs Every:** 5 minutes (configured in instrumentation.ts)
 *
 * @returns Promise resolving to sync result with count of cached entries
 *
 * @example
 * ```typescript
 * // Background job called by instrumentation.ts
 * const result = await cacheDPIStats()
 * console.log(`Cached DPI stats for ${result.details.cached} devices`)
 * ```
 */
export async function cacheDPIStats(): Promise<SyncResult> {
  try {
    const activeClients = await unifi.getActiveClients()
    const now = new Date()
    let cached = 0

    // Batch load all guest records for active MACs to avoid N+1 queries
    const activeMacs = activeClients.filter((c) => c.mac).map((c) => c.mac.toLowerCase())

    const guestRecords = db
      .select({
        macAddress: guests.macAddress,
      })
      .from(guests)
      .where(inArray(guests.macAddress, activeMacs))
      .all()

    // Create a set for O(1) lookups
    const guestMacs = new Set(guestRecords.map((g) => g.macAddress))

    // Fetch DPI stats for all guest MACs in parallel
    const dpiPromises = activeClients
      .filter((client) => client.mac && guestMacs.has(client.mac.toLowerCase()))
      .map(async (client) => {
        const mac = client.mac.toLowerCase()
        try {
          const dpiStats = await unifi.getDPIStats(mac)
          return { mac, client, dpiStats }
        } catch (err) {
          console.error(`Failed to fetch DPI stats for MAC ${mac}:`, err)
          return { mac, client, dpiStats: null }
        }
      })

    const dpiResults = await Promise.all(dpiPromises)

    // Process and insert stats for each client
    for (const { mac, client, dpiStats } of dpiResults) {
      // Calculate total bytes from DPI categories
      let totalRx = 0
      let totalTx = 0
      const topApps: Array<{ app: number; cat: number; rx_bytes: number; tx_bytes: number }> = []

      if (dpiStats?.by_cat) {
        for (const cat of dpiStats.by_cat) {
          totalRx += cat.rx_bytes
          totalTx += cat.tx_bytes
        }
      }

      // Collect top applications by bandwidth (limited to top N)
      if (dpiStats?.by_app) {
        topApps.push(...dpiStats.by_app.slice(0, DPI_TOP_APPS_LIMIT))
      }

      // Use client's byte counts if DPI stats aren't available
      const bytesReceived = totalRx || client.rx_bytes || 0
      const bytesSent = totalTx || client.tx_bytes || 0

      // Insert stats record
      // Note: 'domains' field stores top DPI applications as JSON (app/category IDs)
      // Actual domain names would require Unifi firewall logs which aren't easily accessible
      try {
        db.insert(networkStats)
          .values({
            macAddress: mac,
            timestamp: now,
            bytesReceived,
            bytesSent,
            domains: topApps.length > 0 ? JSON.stringify(topApps) : null,
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
 * Sync database and Unifi Controller authorization mismatches.
 *
 * This critical background job ensures database and Unifi stay in sync by detecting
 * guests who are authorized in the database but NOT authorized on Unifi, then
 * re-authorizing them on the controller.
 *
 * **What It Does:**
 * 1. Fetches all currently authorized MACs from Unifi Controller
 * 2. Queries database for non-expired guest authorizations
 * 3. Detects mismatches (DB says authorized, Unifi says not)
 * 4. Re-authorizes missing MACs with correct remaining time
 * 5. Logs re-authorizations as `admin_extend` events
 *
 * **Why This Is Needed:**
 * - Unifi authorization can fail due to network issues
 * - Manual revocations in Unifi Controller aren't reflected in DB
 * - Controller restarts can clear authorization state
 * - Ensures guests don't lose access due to transient failures
 *
 * **Runs Every:** 5 minutes (configured in instrumentation.ts)
 *
 * **Time Calculation:** Converts remaining milliseconds to minutes with minimum of 1 minute.
 * Formula: `Math.floor(remainingMs / 60000)` ensures we never authorize for 0 minutes.
 *
 * @returns Promise resolving to sync result with reauthorization count and any errors
 *
 * @example
 * ```typescript
 * // Background job called by instrumentation.ts
 * const result = await syncAuthorizationMismatches()
 * console.log(`Re-authorized ${result.details.reauthorized} MACs`)
 * ```
 */
export async function syncAuthorizationMismatches(): Promise<SyncResult> {
  try {
    const now = new Date()

    // Get currently authorized guests from Unifi
    const unifiAuthorizations = await unifi.getGuestAuthorizations()
    const unifiMacs = new Set(
      unifiAuthorizations.filter((a) => a.authorized).map((a) => a.mac.toLowerCase())
    )

    // Get guests from DB that should be authorized (not expired)
    const dbGuests = db
      .select({
        id: guests.id,
        userId: guests.userId,
        macAddress: guests.macAddress,
        expiresAt: guests.expiresAt,
      })
      .from(guests)
      .where(gt(guests.expiresAt, now))
      .all()

    let reauthorized = 0
    const errors: string[] = []

    // Find mismatches: DB says authorized, Unifi says not
    for (const guest of dbGuests) {
      const mac = guest.macAddress.toLowerCase()

      if (!unifiMacs.has(mac)) {
        // Authorization mismatch detected - re-authorize on Unifi
        try {
          // Calculate remaining time in minutes
          const remainingMs = guest.expiresAt.getTime() - Date.now()
          const remainingMinutes = Math.max(1, Math.floor(remainingMs / (60 * 1000)))

          const success = await unifi.authorizeGuest(mac, remainingMinutes)

          if (success) {
            reauthorized++
            logger.adminExtend({
              guestUserId: guest.userId,
              macAddress: mac,
              guestId: guest.id,
              newExpiresAt: guest.expiresAt,
            })
            console.log(
              `[Sync] Re-authorized MAC ${mac} for ${remainingMinutes} minutes (expires: ${guest.expiresAt.toISOString()})`
            )
          } else {
            errors.push(`Failed to re-authorize MAC ${mac}: Unifi returned false`)
          }
        } catch (err) {
          errors.push(
            `Failed to re-authorize MAC ${mac}: ${err instanceof Error ? err.message : 'Unknown error'}`
          )
        }
      }
    }

    return {
      success: errors.length === 0,
      message: `Synced authorizations: ${reauthorized} re-authorized`,
      details: {
        dbGuests: dbGuests.length,
        unifiAuthorizations: unifiMacs.size,
        reauthorized,
        errors: errors.length > 0 ? errors : undefined,
      },
    }
  } catch (error) {
    console.error('Authorization sync error:', error)
    return {
      success: false,
      message: `Authorization sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
 * Cleanup old network stats (keep last N days)
 */
export async function cleanupOldStats(): Promise<SyncResult> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS)

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

/**
 * Cleanup old verification codes to prevent unbounded growth
 *
 * Removes verification codes older than 30 days to prevent the table from growing
 * indefinitely. Unlike guests (which are kept for analytics), verification codes
 * serve no purpose after expiry and can be safely deleted.
 *
 * **What It Does:**
 * 1. Calculates cutoff date (30 days ago)
 * 2. Deletes all verification_codes records older than cutoff
 * 3. Returns count of deleted records
 *
 * **Why This Is Needed:**
 * - Verification codes accumulate over time (one per guest auth attempt)
 * - Expired codes are never reused
 * - No analytics value after initial verification
 * - Prevents database bloat
 *
 * **Runs Every:** Daily via instrumentation.ts (same schedule as other cleanup jobs)
 *
 * @returns Promise resolving to sync result with deletion count
 *
 * @example
 * ```typescript
 * const result = await cleanupExpiredVerificationCodes()
 * console.log(`Deleted ${result.details.deleted} old verification codes`)
 * ```
 */
export async function cleanupExpiredVerificationCodes(): Promise<SyncResult> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS)

    const result = db
      .delete(verificationCodes)
      .where(lt(verificationCodes.createdAt, thirtyDaysAgo))
      .run()

    return {
      success: true,
      message: `Cleaned up ${result.changes} old verification codes`,
      details: { deleted: result.changes },
    }
  } catch (error) {
    console.error('Verification code cleanup error:', error)
    return {
      success: false,
      message: `Verification code cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

// Track when we last sent expiry reminders (to avoid duplicate emails)
let lastExpiryReminderTime = 0

/**
 * Send expiry reminder emails for guests expiring within 24 hours
 * Only sends once per 12 hours to avoid spam
 */
export async function sendExpiryReminders(): Promise<SyncResult> {
  try {
    const now = Date.now()

    // Skip if we sent reminders recently
    if (lastExpiryReminderTime > 0 && now - lastExpiryReminderTime < EXPIRY_REMINDER_INTERVAL_MS) {
      return {
        success: true,
        message: 'Skipped - reminders sent recently',
        details: { lastSent: new Date(lastExpiryReminderTime).toISOString() },
      }
    }

    const currentDate = new Date()
    const twentyFourHoursFromNow = new Date(now + ONE_DAY_MS)

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
