import { NextRequest, NextResponse } from 'next/server'
import { db, guests, users } from '@/lib/db'
import { requireAdmin, AdminAuthError } from '@/lib/session'

export const dynamic = 'force-dynamic'
import { unifi } from '@/lib/unifi'
import { eq, desc, like, or, and, sql, gt, lt } from 'drizzle-orm'
import { PAGINATION_DEFAULT_LIMIT } from '@/lib/constants'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || String(PAGINATION_DEFAULT_LIMIT))
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || 'all' // all, active, expired

    const offset = (page - 1) * limit
    const now = new Date()

    // Build where conditions
    const whereConditions = []

    if (search) {
      whereConditions.push(
        or(
          like(users.name, `%${search}%`),
          like(users.email, `%${search}%`),
          like(guests.macAddress, `%${search}%`)
        )
      )
    }

    if (status === 'active') {
      whereConditions.push(gt(guests.expiresAt, now))
    } else if (status === 'expired') {
      whereConditions.push(lt(guests.expiresAt, now))
    }

    // Get total count
    const countResult =
      whereConditions.length > 0
        ? db
            .select({ count: sql<number>`count(*)` })
            .from(guests)
            .leftJoin(users, eq(guests.userId, users.id))
            .where(and(...whereConditions))
            .get()
        : db
            .select({ count: sql<number>`count(*)` })
            .from(guests)
            .leftJoin(users, eq(guests.userId, users.id))
            .get()

    const total = countResult?.count || 0

    // Get paginated guests
    const guestList =
      whereConditions.length > 0
        ? db
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
              userId: guests.userId,
              userName: users.name,
              userEmail: users.email,
            })
            .from(guests)
            .leftJoin(users, eq(guests.userId, users.id))
            .where(and(...whereConditions))
            .orderBy(desc(guests.authorizedAt))
            .limit(limit)
            .offset(offset)
            .all()
        : db
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
              userId: guests.userId,
              userName: users.name,
              userEmail: users.email,
            })
            .from(guests)
            .leftJoin(users, eq(guests.userId, users.id))
            .orderBy(desc(guests.authorizedAt))
            .limit(limit)
            .offset(offset)
            .all()

    // Try to get online status from Unifi
    let onlineMACs = new Set<string>()
    try {
      const activeClients = await unifi.getActiveClients()
      onlineMACs = new Set(activeClients.map((c) => c.mac?.toLowerCase()))
    } catch (error) {
      console.warn('Failed to fetch Unifi clients for online status:', error)
    }

    // Format response
    const formattedGuests = guestList.map((guest) => ({
      id: guest.id,
      mac: guest.macAddress,
      ip: guest.ipAddress,
      device: guest.deviceInfo,
      nickname: guest.nickname,
      authorizedAt: guest.authorizedAt?.toISOString(),
      expiresAt: guest.expiresAt?.toISOString(),
      lastSeen: guest.lastSeen?.toISOString(),
      authCount: guest.authCount,
      isActive: guest.expiresAt ? guest.expiresAt > now : false,
      isOnline: onlineMACs.has(guest.macAddress?.toLowerCase() || ''),
      user: {
        id: guest.userId,
        name: guest.userName,
        email: guest.userEmail,
      },
    }))

    return NextResponse.json({
      guests: formattedGuests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { error: 'Unauthorized', code: error.code },
        { status: error.code === 'no_2fa' ? 403 : 401 }
      )
    }
    console.error('Guests API error:', error)
    return NextResponse.json({ error: 'Failed to fetch guests' }, { status: 500 })
  }
}
