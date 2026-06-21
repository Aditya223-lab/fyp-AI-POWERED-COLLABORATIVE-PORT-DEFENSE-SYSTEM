import { NextResponse } from 'next/server';
import { withAuth } from 'next-auth/middleware';

export default withAuth(
  function middleware(req) {
    const { token } = req.nextauth;
    const { pathname } = req.nextUrl;

    if (pathname.startsWith('/admin') && token?.role !== 'admin') {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('error', 'admin-only');
      return NextResponse.redirect(url);
    }

    const premiumOnly = pathname.startsWith('/attacks') || pathname.startsWith('/severity');
    if (premiumOnly && token?.plan !== 'premium' && token?.role !== 'admin') {
      const url = req.nextUrl.clone();
      url.pathname = '/pricing';
      url.searchParams.set('locked', pathname.slice(1));
      return NextResponse.redirect(url);
    }
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: { signIn: '/login' },
  },
);

export const config = {
  matcher: [
    '/admin/:path*',
    '/attacks/:path*',
    '/severity/:path*',
    '/user/:path*',
    '/contact/:path*',
  ],
};
