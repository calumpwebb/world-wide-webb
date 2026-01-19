import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth, AdminAuthError } from '@/lib/session'

/**
 * POST /api/admin/update-password-flag
 * Updates the mustChangePassword flag after a forced password change
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify admin session (but don't require 2FA since they're in the password change flow)
    const sessionUser = await requireAuth()

    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Verify the userId matches the authenticated user
    if (sessionUser.id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Update the mustChangePassword flag
    db.update(users).set({ mustChangePassword: false }).where(eq(users.id, userId)).run()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating password flag:', error)
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to update password flag' }, { status: 500 })
  }
}
