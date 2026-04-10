import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // In dev mode skip all HTTPS enforcement
  if (process.env.DEV_MODE === 'true') {
    return NextResponse.next()
  }

  // In production, enforce HTTPS via the x-forwarded-proto header
  // that a reverse proxy (Nginx, Caddy, etc.) sets after terminating TLS.
  const proto = request.headers.get('x-forwarded-proto')
  if (proto === 'http') {
    const host = request.headers.get('host') ?? request.nextUrl.host
    const url = `https://${host}${request.nextUrl.pathname}${request.nextUrl.search}`
    return NextResponse.redirect(url, { status: 301 })
  }

  return NextResponse.next()
}

export const config = {
  // Run on all routes except Next.js internals and static files
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
