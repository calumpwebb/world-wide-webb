import { NextResponse } from 'next/server'
import { db, guests, users } from '@/lib/db'
import { unifi } from '@/lib/unifi'
import { eq, gt } from 'drizzle-orm'
import { requireAdmin, AdminAuthError } from '@/lib/session'

export async function GET() {
  try {
    await requireAdmin()
    const now = new Date()

    // Get authorized guests from database
    const authorizedGuests = db
      .select({
        mac: guests.macAddress,
        userName: users.name,
        userEmail: users.email,
        expiresAt: guests.expiresAt,
        lastSeen: guests.lastSeen,
        nickname: guests.nickname,
      })
      .from(guests)
      .leftJoin(users, eq(guests.userId, users.id))
      .where(gt(guests.expiresAt, now))
      .all()

    // Create a map of authorized MACs
    const authorizedMacs = new Map(authorizedGuests.map((g) => [g.mac?.toLowerCase(), g]))

    // Try to get active clients from Unifi
    let activeClients: Array<{
      mac: string
      name: string
      ip: string
      signalStrength?: number
      lastSeen: string
      authorized: boolean
    }> = []

    try {
      const unifiClients = await unifi.getActiveClients()

      activeClients = unifiClients.map((client) => {
        const guestInfo = authorizedMacs.get(client.mac?.toLowerCase())
        return {
          mac: client.mac || 'Unknown',
          name:
            guestInfo?.nickname ||
            guestInfo?.userName ||
            client.name ||
            client.hostname ||
            'Unknown Device',
          ip: client.ip || 'N/A',
          signalStrength: client.rssi ? Math.min(100, Math.max(0, client.rssi + 100)) : undefined,
          lastSeen: client.last_seen
            ? new Date(client.last_seen * 1000).toISOString()
            : new Date().toISOString(),
          authorized: !!guestInfo,
        }
      })
    } catch (error) {
      console.warn('Failed to fetch Unifi clients:', error)
      // Fall back to database data only
      activeClients = authorizedGuests.map((g) => ({
        mac: g.mac || 'Unknown',
        name: g.nickname || g.userName || 'Unknown Device',
        ip: 'N/A',
        signalStrength: undefined,
        lastSeen: g.lastSeen?.toISOString() || new Date().toISOString(),
        authorized: true,
      }))
    }

    return NextResponse.json({
      devices: activeClients,
      total: activeClients.length,
    })
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { error: 'Unauthorized', code: error.code },
        { status: error.code === 'no_2fa' ? 403 : 401 }
      )
    }
    console.error('Devices API error:', error)
    return NextResponse.json({ error: 'Failed to fetch devices' }, { status: 500 })
  }
}
