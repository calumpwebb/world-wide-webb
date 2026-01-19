import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip middleware for API routes and static files
  if (pathname.startsWith('/api') || pathname.startsWith('/_next') || pathname.includes('.')) {
    return NextResponse.next()
  }

  // Check if it's an admin route (but not login)
  const isAdminRoute = pathname.startsWith('/admin') && pathname !== '/admin/login'

  if (isAdminRoute) {
    // Get session cookie
    const sessionCookie = request.cookies.get('better-auth.session_token')

    if (!sessionCookie) {
      // No session - redirect to login
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    // For now, we let the client-side handle role checking and TOTP enforcement
    // The login page and setup-2fa page both check the session and redirect appropriately
    // A more robust solution would validate the session server-side here
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
