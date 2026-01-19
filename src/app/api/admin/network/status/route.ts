import { NextResponse } from 'next/server'
import { db, guests, users } from '@/lib/db'
import { unifi } from '@/lib/unifi'
import { eq, gt } from 'drizzle-orm'
import { requireAdmin, AdminAuthError } from '@/lib/session'
import { calculateSignalStrength } from '@/lib/utils'

interface NetworkClient {
  mac: string
  name: string
  ip: string
  hostname?: string
  signalStrength?: number
  rssi?: number
  noise?: number
  txRate?: number
  rxRate?: number
  txBytes?: number
  rxBytes?: number
  uptime?: number
  lastSeen: string
  firstSeen?: string
  isAuthorized: boolean
  isGuest: boolean
  isWired: boolean
  channel?: number
  radio?: string
  essid?: string
  apMac?: string
  guest?: {
    userId: string
    userName: string | null
    userEmail: string | null
    expiresAt: string
    nickname: string | null
  }
}

export async function GET() {
  try {
    await requireAdmin()
    const now = new Date()

    // Get authorized guests from database
    const authorizedGuests = db
      .select({
        mac: guests.macAddress,
        userId: guests.userId,
        userName: users.name,
        userEmail: users.email,
        expiresAt: guests.expiresAt,
        nickname: guests.nickname,
      })
      .from(guests)
      .leftJoin(users, eq(guests.userId, users.id))
      .where(gt(guests.expiresAt, now))
      .all()

    // Create a map of authorized MACs for quick lookup
    const authorizedMacs = new Map(
      authorizedGuests.map((g) => [
        g.mac?.toLowerCase(),
        {
          userId: g.userId || '',
          userName: g.userName,
          userEmail: g.userEmail,
          expiresAt: g.expiresAt?.toISOString() || '',
          nickname: g.nickname,
        },
      ])
    )

    // Get active clients from Unifi
    let clients: NetworkClient[] = []
    let unifiConnected = false
    let totalClients = 0
    let guestClients = 0
    let wiredClients = 0
    let wirelessClients = 0

    try {
      const unifiClients = await unifi.getActiveClients()
      unifiConnected = true
      totalClients = unifiClients.length

      clients = unifiClients.map((client) => {
        const guestInfo = authorizedMacs.get(client.mac?.toLowerCase())
        const isWired = client.is_wired || false
        const isGuest = client.is_guest || false

        if (isGuest) guestClients++
        if (isWired) wiredClients++
        else wirelessClients++

        // Calculate signal percentage from RSSI (-100 to 0 dBm range)
        const signalStrength =
          client.rssi !== undefined ? calculateSignalStrength(client.rssi) : undefined

        return {
          mac: client.mac || 'Unknown',
          name:
            guestInfo?.nickname ||
            guestInfo?.userName ||
            client.name ||
            client.hostname ||
            'Unknown Device',
          ip: client.ip || 'N/A',
          hostname: client.hostname,
          signalStrength,
          rssi: client.rssi,
          noise: client.noise,
          txRate: client.tx_rate,
          rxRate: client.rx_rate,
          txBytes: client.tx_bytes,
          rxBytes: client.rx_bytes,
          uptime: client.uptime,
          lastSeen: client.last_seen
            ? new Date(client.last_seen * 1000).toISOString()
            : new Date().toISOString(),
          firstSeen: client.first_seen
            ? new Date(client.first_seen * 1000).toISOString()
            : undefined,
          isAuthorized: !!guestInfo,
          isGuest,
          isWired,
          channel: client.channel,
          radio: client.radio,
          essid: client.essid,
          apMac: client.ap_mac,
          guest: guestInfo,
        }
      })

      // Sort: authorized first, then by signal strength
      clients.sort((a, b) => {
        if (a.isAuthorized !== b.isAuthorized) {
          return a.isAuthorized ? -1 : 1
        }
        if (a.signalStrength !== undefined && b.signalStrength !== undefined) {
          return b.signalStrength - a.signalStrength
        }
        return 0
      })
    } catch (error) {
      console.warn('Failed to fetch Unifi clients for network status:', error)
      // Return empty list when Unifi is not available
    }

    return NextResponse.json({
      clients,
      stats: {
        total: totalClients,
        guests: guestClients,
        wired: wiredClients,
        wireless: wirelessClients,
        authorized: authorizedGuests.length,
      },
      unifiConnected,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { error: 'Unauthorized', code: error.code },
        { status: error.code === 'no_2fa' ? 403 : 401 }
      )
    }
    console.error('Network status API error:', error)
    return NextResponse.json({ error: 'Failed to fetch network status' }, { status: 500 })
  }
}
