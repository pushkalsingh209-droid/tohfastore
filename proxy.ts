// proxy.ts
// Renamed from middleware.ts -- Next.js 16 deprecated the `middleware`
// file/export name in favor of `proxy` (see
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isValidAdminSessionToken, SESSION_COOKIE_NAME } from '@/app/utils/adminSession';

// The only admin paths reachable without an admin_session cookie -- they're
// what let you obtain one in the first place.
const PUBLIC_ADMIN_PATHS = new Set(['/admin/login', '/api/admin/login']);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminPage = pathname.startsWith('/admin');
  const isAdminApi = pathname.startsWith('/api/admin');
  if (!isAdminPage && !isAdminApi) {
    return NextResponse.next();
  }

  if (PUBLIC_ADMIN_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const authed = await isValidAdminSessionToken(sessionToken);

  if (authed) {
    return NextResponse.next();
  }

  if (isAdminApi) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  return NextResponse.redirect(new URL('/admin/login', request.url));
}

// Run on the admin dashboard and any admin-only API route
export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
