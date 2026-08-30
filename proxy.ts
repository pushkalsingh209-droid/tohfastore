// proxy.ts
// Renamed from middleware.ts -- Next.js 16 deprecated the `middleware`
// file/export name in favor of `proxy` (see
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isValidAdminSessionToken, SESSION_COOKIE_NAME } from '@/app/utils/adminSession';
import { supabaseAdmin as supabase } from '@/app/utils/supabaseAdmin';
import { findCategoryBySlug, categoryHref, productIdFromParam, productHref } from '@/app/utils/slug';

// The only admin paths reachable without an admin_session cookie -- they're
// what let you obtain one in the first place.
const PUBLIC_ADMIN_PATHS = new Set(['/admin/login', '/api/admin/login']);

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// CSRF defense-in-depth for the admin write API. The admin_session cookie
// is sameSite:lax, which already blocks the classic cross-site form POST,
// but a forged request from another origin (or a lax-exempt top-level
// navigation) still carries the cookie. Every legitimate admin mutation
// comes from the admin SPA's own fetch() calls, which the browser stamps
// with an Origin header matching this host. A cross-origin Origin on a
// state-changing method is therefore never legitimate here. A *missing*
// Origin is left alone -- that's non-browser tooling (curl, a server job),
// not a browser-driven CSRF vector.
function isForgedCrossOriginWrite(request: NextRequest): boolean {
  if (!MUTATING_METHODS.has(request.method)) return false;
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host !== request.nextUrl.host;
  } catch {
    return true;
  }
}

async function handleAdminAuth(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const isAdminApi = pathname.startsWith('/api/admin');

  if (isAdminApi && isForgedCrossOriginWrite(request)) {
    return NextResponse.json({ error: 'Cross-origin request blocked.' }, { status: 403 });
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

// Guaranteed to never match a real route -- rewriting here (instead of
// calling notFound() from the page itself) hands rendering to Next's own
// built-in unmatched-route 404 handling, which returns a genuine HTTP 404
// instead of the streamed-200-with-noindex fallback the page would produce
// on its own (see the long comment below).
const PROXY_NOT_FOUND_PATH = '/__proxy_not_found__';

async function getAllCategoryNames(): Promise<string[]> {
  const { data, error } = await supabase.from('categories').select('name');
  if (error) return [];
  return (data || []).map((row: any) => row.name).filter(Boolean);
}

// Old "/?category=X" links (bookmarks, shared links, search-engine index)
// now belong at "/collections/<slug>" -- mirrors the redirect already in
// app/page.tsx, just running here first so it's a real 308 instead of that
// page's streamed meta-refresh fallback.
async function handleLegacyCategoryQuery(request: NextRequest): Promise<NextResponse> {
  const categoryParam = request.nextUrl.searchParams.get('category') || '';
  const allCategoryNames = await getAllCategoryNames();
  if (!allCategoryNames.includes(categoryParam)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = categoryHref(categoryParam);
  url.searchParams.delete('category');
  return NextResponse.redirect(url, 308);
}

// Mirrors the canonicalization in app/product/[id]/page.tsx, running here
// first so it's a real 308. A minimal id+name lookup (indexed primary key,
// two columns) rather than the page's own full `select *` -- kept cheap
// since this runs on every /product/:id request.
async function handleProductPath(request: NextRequest, idParam: string): Promise<NextResponse> {
  const numericId = productIdFromParam(idParam);
  if (!/^\d+$/.test(numericId)) return NextResponse.next();

  const { data, error } = await supabase.from('products').select('id, name').eq('id', Number(numericId)).maybeSingle();
  if (error || !data) return NextResponse.next();

  const canonical = productHref(data);
  if (`/product/${idParam}` === canonical) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = canonical;
  return NextResponse.redirect(url, 308);
}

// Mirrors the resolution in app/collections/[category]/page.tsx, running
// here first so both the redirect and the not-found case get real status
// codes instead of that page's streamed fallbacks.
async function handleCollectionPath(request: NextRequest, slugParam: string): Promise<NextResponse> {
  const allCategoryNames = await getAllCategoryNames();
  const category = findCategoryBySlug(allCategoryNames, slugParam);

  if (!category) {
    const url = request.nextUrl.clone();
    url.pathname = PROXY_NOT_FOUND_PATH;
    return NextResponse.rewrite(url);
  }

  const canonical = categoryHref(category);
  if (`/collections/${slugParam}` === canonical) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = canonical;
  return NextResponse.redirect(url, 308);
}

// This site has a root app/loading.tsx (for the navigation loading
// spinner), which forces every route to stream. Next can't change a
// response's HTTP status once streaming has started, so redirect()/
// notFound() calls inside those pages degrade to a client-side meta-refresh
// tag / a 200-with-noindex instead of a real 301/308/404 (see
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md#status-codes).
// Both still work correctly for real visitors and crawlers, but a genuine
// HTTP status is a stronger SEO signal, so the common cases are handled
// here first -- before anything streams -- with the page-level checks left
// in place underneath as a fallback for any request this doesn't cover.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    return handleAdminAuth(request);
  }

  if (pathname === '/' && request.nextUrl.searchParams.has('category')) {
    return handleLegacyCategoryQuery(request);
  }

  const productMatch = pathname.match(/^\/product\/([^/]+)$/);
  if (productMatch) {
    return handleProductPath(request, productMatch[1]);
  }

  const collectionMatch = pathname.match(/^\/collections\/([^/]+)$/);
  if (collectionMatch) {
    return handleCollectionPath(request, collectionMatch[1]);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*', '/', '/product/:path*', '/collections/:path*'],
};
