import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Edge-compatible middleware for Better Auth
 *
 * NOTE: This middleware only does optimistic redirects based on cookie presence.
 * Actual session validation MUST happen server-side in pages/API routes.
 * Edge runtime doesn't support SQLite/database access, so we can't validate
 * sessions here.
 *
 * For production security:
 * - All admin pages use getSession() to verify role and TOTP status
 * - All API routes validate session server-side
 * - This middleware just provides better UX (fast redirects)
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip middleware for API routes and static files
  if (pathname.startsWith('/api') || pathname.startsWith('/_next') || pathname.includes('.')) {
    return NextResponse.next()
  }

  // Get session cookie (optimistic check only - NOT secure on its own)
  const sessionToken = request.cookies.get('better-auth.session_token')?.value

  // Check if it's an admin route (but not login or setup-2fa)
  const isAdminRoute =
    pathname.startsWith('/admin') && pathname !== '/admin/login' && pathname !== '/admin/setup-2fa'

  if (isAdminRoute) {
    if (!sessionToken) {
      // No session cookie - redirect to login
      // Pages will do full server-side validation
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  // Check if it's a portal route (guest self-service)
  const isPortalRoute = pathname.startsWith('/portal')

  if (isPortalRoute) {
    if (!sessionToken) {
      // No session cookie - redirect to guest login
      // Pages will do full server-side validation
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
