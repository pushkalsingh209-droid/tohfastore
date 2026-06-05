// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // 1. Get the current URL path the user is trying to open
  const { pathname } = request.nextUrl;

  // 2. If they are trying to access the /admin page
  if (pathname.startsWith('/admin')) {
    // Get the password from the URL parameters (e.g., /admin?pass=your_password)
    const urlPassword = request.nextUrl.searchParams.get('pass');
    const correctPassword = process.env.ADMIN_PASSWORD;

    // 3. If the password is missing or wrong, prompt them with standard HTTP Basic Auth
    if (!urlPassword || urlPassword !== correctPassword) {
      const authHeader = request.headers.get('authorization');

      if (!authHeader) {
        return new NextResponse('Authentication Required', {
          status: 401,
          headers: {
            'WWW-Authenticate': 'Basic realm="Secure Admin Area"',
          },
        });
      }

      // Parse the username and password from Basic Auth box
      const authValue = authHeader.split(' ')[1];
      const [username, password] = atob(authValue).split(':');

      // You can leave the username as 'admin' and check the password
      if (username !== 'admin' || password !== correctPassword) {
        return new NextResponse('Invalid Credentials', {
          status: 401,
          headers: {
            'WWW-Authenticate': 'Basic realm="Secure Admin Area"',
          },
        });
      }
    }
  }

  // If password matches, smoothly let them pass through to the dashboard
  return NextResponse.next();
}

// Configure middleware to ONLY run when someone hits the admin route
export const config = {
  matcher: ['/admin/:path*'],
};