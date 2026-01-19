import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { db, sessions, users } from '@/lib/db'
import { eq, and, gt } from 'drizzle-orm'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip middleware for API routes and static files
  if (pathname.startsWith('/api') || pathname.startsWith('/_next') || pathname.includes('.')) {
    return NextResponse.next()
  }

  // Get session cookie
  const sessionToken = request.cookies.get('better-auth.session_token')?.value

  // Check if it's an admin route (but not login or setup-2fa)
  const isAdminRoute =
    pathname.startsWith('/admin') && pathname !== '/admin/login' && pathname !== '/admin/setup-2fa'

  if (isAdminRoute) {
    if (!sessionToken) {
      // No session - redirect to login
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    // Validate session server-side
    try {
      const now = new Date()
      const result = db
        .select({
          userId: sessions.userId,
          expiresAt: sessions.expiresAt,
          role: users.role,
          twoFactorEnabled: users.twoFactorEnabled,
        })
        .from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(and(eq(sessions.token, sessionToken), gt(sessions.expiresAt, now)))
        .get()

      if (!result) {
        // Invalid or expired session
        return NextResponse.redirect(new URL('/admin/login', request.url))
      }

      // Check if user is admin
      if (result.role !== 'admin') {
        // Not an admin - redirect to guest portal
        return NextResponse.redirect(new URL('/portal', request.url))
      }

      // Check if 2FA is enabled (redirect to setup if not)
      if (!result.twoFactorEnabled && pathname !== '/admin/setup-2fa') {
        return NextResponse.redirect(new URL('/admin/setup-2fa', request.url))
      }
    } catch (error) {
      console.error('Middleware session validation error:', error)
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  // Check if it's a portal route (guest self-service)
  const isPortalRoute = pathname.startsWith('/portal')

  if (isPortalRoute) {
    if (!sessionToken) {
      // No session - redirect to guest login
      return NextResponse.redirect(new URL('/', request.url))
    }

    // Validate session server-side
    try {
      const now = new Date()
      const result = db
        .select({
          userId: sessions.userId,
          expiresAt: sessions.expiresAt,
        })
        .from(sessions)
        .where(and(eq(sessions.token, sessionToken), gt(sessions.expiresAt, now)))
        .get()

      if (!result) {
        // Invalid or expired session
        return NextResponse.redirect(new URL('/', request.url))
      }
    } catch (error) {
      console.error('Middleware session validation error:', error)
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
