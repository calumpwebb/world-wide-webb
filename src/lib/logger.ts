import { db, activityLogs } from '@/lib/db'

// Event types matching the database schema
export type EventType =
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

// Base log entry interface
interface LogEntry {
  userId?: string
  macAddress?: string
  ipAddress?: string | null
  details?: Record<string, unknown>
}

// Extract IP address from request headers
export function getClientIP(headers: Headers): string | null {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || null
}

// Core logging function
function log(eventType: EventType, entry: LogEntry): void {
  try {
    db.insert(activityLogs)
      .values({
        userId: entry.userId,
        macAddress: entry.macAddress,
        eventType,
        ipAddress: entry.ipAddress,
        details: entry.details ? JSON.stringify(entry.details) : null,
      })
      .run()
  } catch (error) {
    // Log to console but don't throw - activity logging should never break the app
    console.error(`Failed to log ${eventType} event:`, error)
  }
}

// Authentication Events

export function logAuthSuccess(entry: {
  userId: string
  macAddress?: string
  ipAddress?: string | null
  email: string
  name?: string
  expiresAt: Date
  isReturning: boolean
  unifiAuthorized: boolean
}): void {
  log('auth_success', {
    userId: entry.userId,
    macAddress: entry.macAddress,
    ipAddress: entry.ipAddress,
    details: {
      email: entry.email,
      name: entry.name,
      expiresAt: entry.expiresAt.toISOString(),
      isReturning: entry.isReturning,
      unifiAuthorized: entry.unifiAuthorized,
    },
  })
}

export function logAuthFail(entry: {
  userId?: string
  ipAddress?: string | null
  email?: string
  name?: string
  reason:
    | 'no_valid_code'
    | 'wrong_code'
    | 'expired_code'
    | 'max_attempts'
    | 'unifi_authorization_failed'
    | 'unifi_connection_error'
    | 'disposable_email_blocked'
  remainingAttempts?: number
  macAddress?: string
}): void {
  log('auth_fail', {
    userId: entry.userId,
    ipAddress: entry.ipAddress,
    macAddress: entry.macAddress,
    details: {
      email: entry.email,
      name: entry.name,
      reason: entry.reason,
      remainingAttempts: entry.remainingAttempts,
    },
  })
}

// Verification Code Events

export function logCodeSent(entry: {
  ipAddress?: string | null
  email: string
  name?: string
  macAddress?: string
}): void {
  log('code_sent', {
    macAddress: entry.macAddress,
    ipAddress: entry.ipAddress,
    details: {
      email: entry.email,
      name: entry.name,
    },
  })
}

export function logCodeResent(entry: {
  ipAddress?: string | null
  email: string
  resendCount: number
}): void {
  log('code_resent', {
    ipAddress: entry.ipAddress,
    details: {
      email: entry.email,
      resendCount: entry.resendCount,
    },
  })
}

// Admin Events

export function logAdminLogin(entry: {
  userId: string
  ipAddress?: string | null
  email: string
}): void {
  log('admin_login', {
    userId: entry.userId,
    ipAddress: entry.ipAddress,
    details: {
      email: entry.email,
    },
  })
}

export function logAdminLogout(entry: { userId: string; ipAddress?: string | null }): void {
  log('admin_logout', {
    userId: entry.userId,
    ipAddress: entry.ipAddress,
  })
}

export function logAdminRevoke(entry: {
  adminUserId?: string
  guestUserId?: string
  macAddress?: string
  ipAddress?: string | null
  guestId: number
  userName?: string
  userEmail?: string
}): void {
  log('admin_revoke', {
    userId: entry.guestUserId,
    macAddress: entry.macAddress,
    ipAddress: entry.ipAddress,
    details: {
      adminUserId: entry.adminUserId,
      guestId: entry.guestId,
      userName: entry.userName,
      userEmail: entry.userEmail,
      revokedAt: new Date().toISOString(),
    },
  })
}

export function logAdminExtend(entry: {
  adminUserId?: string
  guestUserId?: string
  macAddress?: string
  ipAddress?: string | null
  guestId: number
  userName?: string
  userEmail?: string
  newExpiresAt: Date
}): void {
  log('admin_extend', {
    userId: entry.guestUserId,
    macAddress: entry.macAddress,
    ipAddress: entry.ipAddress,
    details: {
      adminUserId: entry.adminUserId,
      guestId: entry.guestId,
      userName: entry.userName,
      userEmail: entry.userEmail,
      newExpiresAt: entry.newExpiresAt.toISOString(),
    },
  })
}

// Network Events

export function logConnect(entry: {
  userId?: string
  macAddress: string
  ipAddress?: string | null
  signalStrength?: number
  apName?: string
}): void {
  log('connect', {
    userId: entry.userId,
    macAddress: entry.macAddress,
    ipAddress: entry.ipAddress,
    details: {
      signalStrength: entry.signalStrength,
      apName: entry.apName,
      connectedAt: new Date().toISOString(),
    },
  })
}

export function logDisconnect(entry: {
  userId?: string
  macAddress: string
  ipAddress?: string | null
  sessionDuration?: number // in seconds
  bytesReceived?: number
  bytesSent?: number
}): void {
  log('disconnect', {
    userId: entry.userId,
    macAddress: entry.macAddress,
    ipAddress: entry.ipAddress,
    details: {
      sessionDuration: entry.sessionDuration,
      bytesReceived: entry.bytesReceived,
      bytesSent: entry.bytesSent,
      disconnectedAt: new Date().toISOString(),
    },
  })
}

// Logger namespace export for convenient usage
export const logger = {
  getClientIP,
  authSuccess: logAuthSuccess,
  authFail: logAuthFail,
  codeSent: logCodeSent,
  codeResent: logCodeResent,
  adminLogin: logAdminLogin,
  adminLogout: logAdminLogout,
  adminRevoke: logAdminRevoke,
  adminExtend: logAdminExtend,
  connect: logConnect,
  disconnect: logDisconnect,
}
