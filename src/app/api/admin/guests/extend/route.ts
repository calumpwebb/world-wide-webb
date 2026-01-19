import { NextRequest, NextResponse } from 'next/server'
import { db, guests, users } from '@/lib/db'
import { logger } from '@/lib/logger'
import { unifi } from '@/lib/unifi'
import { eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { requireAdmin, AdminAuthError } from '@/lib/session'
import { ONE_DAY_MS, MAX_GUEST_EXTEND_DAYS, GUEST_AUTH_DEFAULT_DAYS } from '@/lib/constants'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

const extendSchema = z.object({
  guestIds: z.array(z.number()).min(1, 'At least one guest ID required'),
  days: z.number().min(1).max(MAX_GUEST_EXTEND_DAYS).default(GUEST_AUTH_DEFAULT_DAYS), // Extend by 1-30 days (default 7)
})

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
    const body = await request.json()
    const result = extendSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const { guestIds, days } = result.data

    // Get the guests to extend
    const guestsToExtend = db
      .select({
        id: guests.id,
        macAddress: guests.macAddress,
        userId: guests.userId,
        expiresAt: guests.expiresAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(guests)
      .leftJoin(users, eq(guests.userId, users.id))
      .where(inArray(guests.id, guestIds))
      .all()

    if (guestsToExtend.length === 0) {
      return NextResponse.json({ error: 'No guests found' }, { status: 404 })
    }

    // Extend each guest
    const results = {
      extended: 0,
      failed: 0,
      errors: [] as string[],
    }

    for (const guest of guestsToExtend) {
      try {
        // Calculate new expiry - extend from current expiry or now, whichever is later
        const baseDate = guest.expiresAt > new Date() ? guest.expiresAt : new Date()
        const newExpiresAt = new Date(baseDate.getTime() + days * ONE_DAY_MS)

        // Authorize on Unifi with the new duration
        if (guest.macAddress) {
          try {
            const minutesUntilExpiry = Math.ceil((newExpiresAt.getTime() - Date.now()) / 1000 / 60)
            await unifi.authorizeGuest(guest.macAddress, minutesUntilExpiry)
          } catch (unifiError) {
            console.warn(`Failed to extend on Unifi for MAC ${guest.macAddress}:`, unifiError)
            // Continue anyway - database extension is more important
          }
        }

        // Update database with new expiry
        db.update(guests).set({ expiresAt: newExpiresAt }).where(eq(guests.id, guest.id)).run()

        // Log the extension
        logger.adminExtend({
          guestUserId: guest.userId,
          macAddress: guest.macAddress || undefined,
          ipAddress: logger.getClientIP(request.headers),
          guestId: guest.id,
          userName: guest.userName || undefined,
          userEmail: guest.userEmail || undefined,
          newExpiresAt,
        })

        results.extended++
      } catch (error) {
        console.error(`Failed to extend guest ${guest.id}:`, error)
        results.failed++
        results.errors.push(`Failed to extend guest ${guest.id}`)
      }
    }

    return NextResponse.json({
      success: true,
      extended: results.extended,
      failed: results.failed,
      errors: results.errors.length > 0 ? results.errors : undefined,
    })
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { error: 'Unauthorized', code: error.code },
        { status: error.code === 'no_2fa' ? 403 : 401 }
      )
    }
    console.error('Extend API error:', error)
    return NextResponse.json({ error: 'Failed to extend guests' }, { status: 500 })
  }
}
