import { NextRequest, NextResponse } from 'next/server'
import { db, activityLogs, users } from '@/lib/db'
import { requireAdmin, AdminAuthError } from '@/lib/session'

export const dynamic = 'force-dynamic'
import { eq, desc, sql, like, or, and, gte, lte } from 'drizzle-orm'

type EventType =
  | 'connect'
  | 'disconnect'
  | 'auth_success'
  | 'auth_fail'
  | 'admin_revoke'
  | 'admin_extend'
  | 'code_sent'
  | 'code_resent'
  | 'admin_login'
  | 'admin_logout'

const VALID_EVENT_TYPES: EventType[] = [
  'connect',
  'disconnect',
  'auth_success',
  'auth_fail',
  'admin_revoke',
  'admin_extend',
  'code_sent',
  'code_resent',
  'admin_login',
  'admin_logout',
]

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
    await requireAdmin()
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const eventType = searchParams.get('type') || ''
    const search = searchParams.get('search') || ''
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''

    const offset = (page - 1) * limit

    // Build where conditions
    const whereConditions = []

    if (eventType && eventType !== 'all' && VALID_EVENT_TYPES.includes(eventType as EventType)) {
      whereConditions.push(eq(activityLogs.eventType, eventType as EventType))
    }

    if (search) {
      whereConditions.push(
        or(
          like(users.name, `%${search}%`),
          like(users.email, `%${search}%`),
          like(activityLogs.macAddress, `%${search}%`),
          like(activityLogs.ipAddress, `%${search}%`)
        )
      )
    }

    if (startDate) {
      const start = new Date(startDate)
      start.setHours(0, 0, 0, 0)
      whereConditions.push(gte(activityLogs.createdAt, start))
    }

    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      whereConditions.push(lte(activityLogs.createdAt, end))
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined

    // Get total count
    const countResult = db
      .select({ count: sql<number>`count(*)` })
      .from(activityLogs)
      .leftJoin(users, eq(activityLogs.userId, users.id))
      .where(whereClause)
      .get()
    const total = countResult?.count || 0

    // Get paginated events
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
      .where(whereClause)
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit)
      .offset(offset)
      .all()

    const formattedEvents = events.map((event) => {
      const descriptionFn = EVENT_DESCRIPTIONS[event.type || '']
      const description = descriptionFn
        ? descriptionFn(event.details || undefined)
        : `${event.type || 'Unknown event'}`

      let parsedDetails = {}
      try {
        parsedDetails = event.details ? JSON.parse(event.details) : {}
      } catch {
        // Ignore parse errors
      }

      return {
        id: event.id,
        type: event.type,
        description,
        timestamp: event.createdAt?.toISOString() || new Date().toISOString(),
        user: event.userName || event.userEmail || undefined,
        userEmail: event.userEmail,
        mac: event.macAddress,
        ip: event.ipAddress,
        details: parsedDetails,
      }
    })

    return NextResponse.json({
      events: formattedEvents,
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
    console.error('Activity API error:', error)
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 })
  }
}
