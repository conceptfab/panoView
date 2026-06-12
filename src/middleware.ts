import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken } from '@/lib/auth/jwt';

// Routes that require authentication
const protectedRoutes = ['/gallery', '/pano', '/admin'];
// Routes that should redirect authenticated users
const authRoutes = ['/login'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('panorama-session');

  // Weryfikacja kryptograficzna tokena – sfałszowane ciasteczko nie przejdzie
  const isValidSession =
    sessionCookie && (await verifySessionToken(sessionCookie.value)) !== null;

  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  if (isProtectedRoute && !isValidSession) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isAuthRoute && isValidSession) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes
     * - static files
     * - _next
     * - favicon
     */
    '/((?!api|_next/static|_next/image|favicon.ico|panolens).*)',
  ],
};
