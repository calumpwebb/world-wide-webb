import { NextRequest, NextResponse } from 'next/server'
import { db, guests, users } from '@/lib/db'
import { unifi } from '@/lib/unifi'
import { eq, desc, like, or, sql, gt, lt } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
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
    const countQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(guests)
      .leftJoin(users, eq(guests.userId, users.id))

    if (whereConditions.length > 0) {
      whereConditions.forEach((condition) => {
        if (condition) countQuery.where(condition)
      })
    }

    const countResult = countQuery.get()
    const total = countResult?.count || 0

    // Get paginated guests
    const query = db
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

    if (whereConditions.length > 0) {
      whereConditions.forEach((condition) => {
        if (condition) query.where(condition)
      })
    }

    const guestList = query.all()

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
    console.error('Guests API error:', error)
    return NextResponse.json({ error: 'Failed to fetch guests' }, { status: 500 })
  }
}
