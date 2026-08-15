import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// '/' adalah landing page publik (marketing, deskripsi produk) — beda dari '/app' yang
// itu dashboard privat. Exact-match, BUKAN prefix, soalnya prefix '/' bakal cocok ke semua path.
const PUBLIC_EXACT_PATHS = ['/', '/login'];
const PUBLIC_PATH_PREFIXES = ['/s/'];

function isPublicPath(pathname: string) {
  return PUBLIC_EXACT_PATHS.includes(pathname) || PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('trackster_jwt');

  if (!token && !isPublicPath(pathname)) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Sudah login: nggak perlu lihat landing/login lagi, langsung ke dashboard privat.
  if (token && (pathname === '/login' || pathname === '/')) {
    return NextResponse.redirect(new URL('/app', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
