import { NextRequest, NextResponse } from 'next/server'
import { db, guests } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { z } from 'zod'

const updateSchema = z.object({
  nickname: z.string().max(50).optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const deviceId = parseInt(id, 10)

    if (isNaN(deviceId)) {
      return NextResponse.json({ error: 'Invalid device ID' }, { status: 400 })
    }

    // Get session from Better Auth
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Verify the device belongs to this user
    const device = db
      .select()
      .from(guests)
      .where(and(eq(guests.id, deviceId), eq(guests.userId, userId)))
      .get()

    if (!device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 })
    }

    // Parse and validate body
    const body = await request.json()
    const result = updateSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    // Update device
    try {
      db.update(guests)
        .set({
          nickname: result.data.nickname,
        })
        .where(eq(guests.id, deviceId))
        .run()
    } catch (err) {
      console.error('Failed to update device:', err)
      return NextResponse.json({ error: 'Failed to update device' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update device error:', error)
    return NextResponse.json({ error: 'Failed to update device' }, { status: 500 })
  }
}
