import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });
  const isAuthPage = request.nextUrl.pathname === '/';

  if (!token && !isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (token && isAuthPage) {
    return NextResponse.redirect(new URL('/campaign', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/leads', '/campaign', '/settings']
}; 