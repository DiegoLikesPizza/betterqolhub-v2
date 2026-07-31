import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Next.js 16 renamed Middleware to Proxy; this file must sit next to `app`.
//
// This is an OPTIMISTIC check only: it reads the session cookie's presence and
// nothing more, because Proxy runs on every request (including prefetches) and
// must not hit the database.
//
// Since accounts were added, a session cookie no longer implies an admin — any
// member has one, and the JWT is encrypted so the role cannot be read here. So
// this only redirects signed-out visitors; `src/app/admin/page.tsx` performs the
// authoritative role check via `currentUser()`, and every admin server action
// re-checks with `requireAdmin()`. Do not treat this file as the access control.
const SESSION_COOKIES = [
  'authjs.session-token',
  '__Secure-authjs.session-token',
];

export function proxy(request: NextRequest) {
  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));

  if (!hasSession) {
    const loginUrl = new URL('/login', request.nextUrl);
    loginUrl.searchParams.set('callbackUrl', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Guard every admin route except the login page itself (which must stay
  // reachable while signed out) and the NextAuth endpoints under /api/auth.
  matcher: ['/admin', '/admin/((?!login).*)'],
};
