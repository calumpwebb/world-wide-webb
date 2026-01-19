import { NextResponse } from 'next/server'
import { db, guests } from '@/lib/db'
import { eq, desc } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { unifi } from '@/lib/unifi'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Get session from Better Auth
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Get all devices for this user
    const userDevices = db
      .select({
        id: guests.id,
        macAddress: guests.macAddress,
        ipAddress: guests.ipAddress,
        deviceInfo: guests.deviceInfo,
        authorizedAt: guests.authorizedAt,
        expiresAt: guests.expiresAt,
        lastSeen: guests.lastSeen,
        authCount: guests.authCount,
        nickname: guests.nickname,
      })
      .from(guests)
      .where(eq(guests.userId, userId))
      .orderBy(desc(guests.authorizedAt))
      .all()

    // Get active clients from Unifi to check online status
    let activeClients: { mac: string; ip?: string; rssi?: number }[] = []
    try {
      const clients = await unifi.getActiveClients()
      activeClients = clients.map((c) => ({
        mac: c.mac.toLowerCase(),
        ip: c.ip,
        rssi: c.rssi,
      }))
    } catch {
      // Unifi unavailable, continue without online status
    }

    // Enrich devices with online status
    const devices = userDevices.map((device) => {
      const normalizedMac = device.macAddress?.toLowerCase().replace(/[:-]/g, '')
      const activeClient = activeClients.find((c) => c.mac.replace(/[:-]/g, '') === normalizedMac)

      return {
        id: device.id,
        macAddress: device.macAddress,
        ipAddress: activeClient?.ip || device.ipAddress,
        nickname: device.nickname,
        deviceInfo: device.deviceInfo,
        authorizedAt: device.authorizedAt?.toISOString(),
        expiresAt: device.expiresAt?.toISOString(),
        lastSeen: device.lastSeen?.toISOString(),
        authCount: device.authCount,
        isOnline: !!activeClient,
        isExpired: device.expiresAt ? device.expiresAt < new Date() : true,
        signalStrength: activeClient?.rssi,
      }
    })

    // Calculate totals
    const now = new Date()
    const activeDevices = devices.filter((d) => d.expiresAt && new Date(d.expiresAt) > now)
    const onlineDevices = devices.filter((d) => d.isOnline)

    return NextResponse.json({
      devices,
      stats: {
        total: devices.length,
        active: activeDevices.length,
        online: onlineDevices.length,
        expired: devices.length - activeDevices.length,
      },
    })
  } catch (error) {
    console.error('Portal devices API error:', error)
    return NextResponse.json({ error: 'Failed to fetch devices' }, { status: 500 })
  }
}
