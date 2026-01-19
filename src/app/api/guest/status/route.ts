import { NextRequest, NextResponse } from 'next/server'
import { db, guests, users } from '@/lib/db'
import { eq, and, gt } from 'drizzle-orm'
import { isValidMac, normalizeMac } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const mac = searchParams.get('mac')

    if (!mac) {
      return NextResponse.json({ error: 'MAC address is required' }, { status: 400 })
    }

    // Validate MAC address format
    if (!isValidMac(mac)) {
      return NextResponse.json({ error: 'Invalid MAC address format' }, { status: 400 })
    }

    // Normalize MAC address (lowercase, colons)
    const normalizedMac = normalizeMac(mac)

    // Check if this MAC is authorized
    const guest = db
      .select({
        id: guests.id,
        userId: guests.userId,
        macAddress: guests.macAddress,
        expiresAt: guests.expiresAt,
        authorizedAt: guests.authorizedAt,
        authCount: guests.authCount,
        userName: users.name,
        userEmail: users.email,
      })
      .from(guests)
      .leftJoin(users, eq(guests.userId, users.id))
      .where(and(eq(guests.macAddress, normalizedMac), gt(guests.expiresAt, new Date())))
      .get()

    if (!guest) {
      return NextResponse.json({
        authorized: false,
      })
    }

    return NextResponse.json({
      authorized: true,
      expiresAt: guest.expiresAt?.toISOString(),
      authorizedAt: guest.authorizedAt?.toISOString(),
      user: {
        name: guest.userName,
        email: guest.userEmail,
      },
    })
  } catch (error) {
    console.error('Error in guest status:', error)
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 })
  }
}
