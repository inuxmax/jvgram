import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = new Set(['/', '/login', '/setup']);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith('/_next')
    || pathname.startsWith('/api')
    || pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const hasSession = Boolean(request.cookies.get('taa_session')?.value);
  if (!hasSession && !PUBLIC_PATHS.has(pathname)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
