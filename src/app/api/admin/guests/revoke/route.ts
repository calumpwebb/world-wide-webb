import { NextRequest, NextResponse } from 'next/server'
import { db, guests, activityLogs, users } from '@/lib/db'
import { unifi } from '@/lib/unifi'
import { eq, inArray } from 'drizzle-orm'
import { z } from 'zod'

const revokeSchema = z.object({
  guestIds: z.array(z.number()).min(1, 'At least one guest ID required'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = revokeSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const { guestIds } = result.data

    // Get the guests to revoke
    const guestsToRevoke = db
      .select({
        id: guests.id,
        macAddress: guests.macAddress,
        userId: guests.userId,
        userName: users.name,
        userEmail: users.email,
      })
      .from(guests)
      .leftJoin(users, eq(guests.userId, users.id))
      .where(inArray(guests.id, guestIds))
      .all()

    if (guestsToRevoke.length === 0) {
      return NextResponse.json({ error: 'No guests found' }, { status: 404 })
    }

    // Revoke each guest
    const now = new Date()
    const results = {
      revoked: 0,
      failed: 0,
      errors: [] as string[],
    }

    for (const guest of guestsToRevoke) {
      try {
        // Revoke on Unifi (if connected)
        if (guest.macAddress) {
          try {
            await unifi.unauthorizeGuest(guest.macAddress)
            await unifi.kickClient(guest.macAddress)
          } catch (unifiError) {
            console.warn(`Failed to revoke on Unifi for MAC ${guest.macAddress}:`, unifiError)
            // Continue anyway - database revocation is more important
          }
        }

        // Update database - set expiry to now
        db.update(guests).set({ expiresAt: now }).where(eq(guests.id, guest.id)).run()

        // Log the revocation
        db.insert(activityLogs)
          .values({
            userId: guest.userId,
            macAddress: guest.macAddress,
            eventType: 'admin_revoke',
            ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
            details: JSON.stringify({
              guestId: guest.id,
              userName: guest.userName,
              userEmail: guest.userEmail,
              revokedAt: now.toISOString(),
            }),
          })
          .run()

        results.revoked++
      } catch (error) {
        console.error(`Failed to revoke guest ${guest.id}:`, error)
        results.failed++
        results.errors.push(`Failed to revoke guest ${guest.id}`)
      }
    }

    return NextResponse.json({
      success: true,
      revoked: results.revoked,
      failed: results.failed,
      errors: results.errors.length > 0 ? results.errors : undefined,
    })
  } catch (error) {
    console.error('Revoke API error:', error)
    return NextResponse.json({ error: 'Failed to revoke guests' }, { status: 500 })
  }
}
