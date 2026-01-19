import { NextRequest, NextResponse } from 'next/server'
import { db, activityLogs, users } from '@/lib/db'
import { eq, desc } from 'drizzle-orm'

const EVENT_DESCRIPTIONS: Record<string, (details?: string) => string> = {
  auth_success: (details) => {
    const parsed = details ? JSON.parse(details) : {}
    return parsed.isReturning ? `Returning guest authenticated` : `New guest authenticated`
  },
  auth_fail: (details) => {
    const parsed = details ? JSON.parse(details) : {}
    return `Authentication failed: ${parsed.reason || 'unknown reason'}`
  },
  connect: () => 'Device connected to network',
  disconnect: () => 'Device disconnected from network',
  admin_revoke: () => 'Admin revoked guest access',
  admin_extend: () => 'Admin extended guest access',
  code_sent: () => 'Verification code sent',
  code_resent: () => 'Verification code resent',
  admin_login: () => 'Admin logged in',
  admin_logout: () => 'Admin logged out',
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')

    const events = db
      .select({
        id: activityLogs.id,
        type: activityLogs.eventType,
        userId: activityLogs.userId,
        macAddress: activityLogs.macAddress,
        ipAddress: activityLogs.ipAddress,
        details: activityLogs.details,
        createdAt: activityLogs.createdAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(activityLogs)
      .leftJoin(users, eq(activityLogs.userId, users.id))
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit)
      .offset(offset)
      .all()

    const formattedEvents = events.map((event) => {
      const descriptionFn = EVENT_DESCRIPTIONS[event.type || '']
      const description = descriptionFn
        ? descriptionFn(event.details || undefined)
        : `${event.type || 'Unknown event'}`

      return {
        id: event.id,
        type: event.type,
        description,
        timestamp: event.createdAt?.toISOString() || new Date().toISOString(),
        user: event.userName || event.userEmail || undefined,
        mac: event.macAddress,
        ip: event.ipAddress,
      }
    })

    return NextResponse.json({
      events: formattedEvents,
      total: events.length,
    })
  } catch (error) {
    console.error('Activity API error:', error)
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 })
  }
}
