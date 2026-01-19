import { db, sessions, users } from '@/lib/db'
import { eq, and, gt } from 'drizzle-orm'
import { cookies } from 'next/headers'

export interface SessionUser {
  id: string
  email: string
  name: string | null
  role: 'guest' | 'admin'
  twoFactorEnabled: boolean
}

export interface SessionValidation {
  valid: boolean
  user: SessionUser | null
  error?: 'no_session' | 'invalid_session' | 'expired' | 'not_admin' | 'no_2fa'
}

/**
 * Validate session from cookies and return user info
 * Use this in API routes to ensure the request is from an authenticated user
 */
export async function getValidSession(): Promise<SessionValidation> {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('better-auth.session_token')?.value

    if (!sessionToken) {
      return { valid: false, user: null, error: 'no_session' }
    }

    // Look up session and join with user
    const now = new Date()
    const result = db
      .select({
        userId: sessions.userId,
        expiresAt: sessions.expiresAt,
        email: users.email,
        name: users.name,
        role: users.role,
        twoFactorEnabled: users.twoFactorEnabled,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.token, sessionToken), gt(sessions.expiresAt, now)))
      .get()

    if (!result) {
      return { valid: false, user: null, error: 'invalid_session' }
    }

    return {
      valid: true,
      user: {
        id: result.userId,
        email: result.email,
        name: result.name,
        role: result.role as 'guest' | 'admin',
        twoFactorEnabled: result.twoFactorEnabled || false,
      },
    }
  } catch {
    // Expected during static page generation when cookies aren't available
    return { valid: false, user: null, error: 'invalid_session' }
  }
}

/**
 * Validate that the current session is for an admin with 2FA enabled
 * Returns the user or throws if validation fails
 */
export async function requireAdmin(): Promise<SessionUser> {
  const session = await getValidSession()

  if (!session.valid || !session.user) {
    throw new AdminAuthError(session.error || 'no_session')
  }

  if (session.user.role !== 'admin') {
    throw new AdminAuthError('not_admin')
  }

  if (!session.user.twoFactorEnabled) {
    throw new AdminAuthError('no_2fa')
  }

  return session.user
}

/**
 * Validate that the current session is for any authenticated user (guest or admin)
 */
export async function requireAuth(): Promise<SessionUser> {
  const session = await getValidSession()

  if (!session.valid || !session.user) {
    throw new AdminAuthError(session.error || 'no_session')
  }

  return session.user
}

export class AdminAuthError extends Error {
  constructor(public code: 'no_session' | 'invalid_session' | 'expired' | 'not_admin' | 'no_2fa') {
    super(`Admin auth error: ${code}`)
    this.name = 'AdminAuthError'
  }
}
