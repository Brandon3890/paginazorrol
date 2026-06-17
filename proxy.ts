import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { 
  loginRateLimiter, 
  apiRateLimiter, 
  adminRateLimiter 
} from '@/lib/rate-limiter'
import { getSecurityHeaders, getCSPHeaders } from '@/lib/security-headers'

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)

const protectedRoutes = ['/profile', '/orders']
const adminRoutes = ['/admin', '/api/admin']
const publicOrderRoutes = ['/order-success']
const publicRoutes = ['/checkout', '/api/orders/create-guest']

function getClientIP(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }
  const realIP = request.headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }
  return '127.0.0.1'
}

function getUserAgent(request: NextRequest): string {
  return request.headers.get('user-agent') || 'unknown'
}

function requiresAuth(pathname: string): boolean {
  if (publicOrderRoutes.some(route => pathname.startsWith(route))) {
    return false
  }
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return false
  }
  return protectedRoutes.some(route => pathname.startsWith(route))
}

function isAdminRoute(pathname: string): boolean {
  return adminRoutes.some(route => pathname.startsWith(route))
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const clientIP = getClientIP(request)
  const userAgent = getUserAgent(request)
  
  const response = NextResponse.next()

  const securityHeaders = getSecurityHeaders()
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  if (!pathname.startsWith('/api/') && !pathname.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)) {
    const cspHeaders = getCSPHeaders()
    Object.entries(cspHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
  }

  if (pathname === '/api/auth/login') {
    const limitResult = loginRateLimiter.attempt(`login_${clientIP}`)
    if (!limitResult.allowed) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Demasiados intentos de login. Intenta nuevamente en 30 minutos.',
          retryAfter: Math.ceil((limitResult.resetTime - Date.now()) / 1000)
        },
        { 
          status: 429,
          headers: {
            'Retry-After': Math.ceil((limitResult.resetTime - Date.now()) / 1000).toString()
          }
        }
      )
    }
  }

  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/') && !pathname.startsWith('/api/orders/create-guest')) {
    const limitResult = apiRateLimiter.attempt(`api_${clientIP}`)
    if (!limitResult.allowed) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Demasiadas peticiones. Intenta nuevamente más tarde.' 
        },
        { status: 429 }
      )
    }
  }

  const token = request.cookies.get('auth_token')?.value
  const needsAuth = requiresAuth(pathname)
  const isAdmin = isAdminRoute(pathname)

  if (needsAuth || isAdmin) {
    if (!token) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('from', pathname)
      return NextResponse.redirect(loginUrl)
    }

    try {
      const { payload } = await jwtVerify(token, JWT_SECRET)
      
      if (isAdmin) {
        const adminLimitResult = adminRateLimiter.attempt(`admin_${payload.userId}`)
        if (!adminLimitResult.allowed) {
          return NextResponse.json(
            { 
              success: false, 
              message: 'Demasiadas acciones administrativas. Espera un momento.' 
            },
            { status: 429 }
          )
        }

        if (payload.role !== 'admin') {
          return NextResponse.redirect(new URL('/unauthorized', request.url))
        }
      }

      if (pathname.startsWith('/api/')) {
        const requestHeaders = new Headers(request.headers)
        requestHeaders.set('x-user-id', String(payload.userId))
        requestHeaders.set('x-user-email', String(payload.email))
        requestHeaders.set('x-user-role', String(payload.role))
        requestHeaders.set('x-client-ip', clientIP)

        return NextResponse.next({
          request: { headers: requestHeaders },
        })
      }

    } catch (error) {
      const redirectResponse = NextResponse.redirect(new URL('/login', request.url))
      redirectResponse.cookies.delete('auth_token')
      Object.entries(securityHeaders).forEach(([key, value]) => {
        redirectResponse.headers.set(key, value)
      })
      return redirectResponse
    }
  }

  return response
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/checkout/:path*', 
    '/orders/:path*',
    '/profile/:path*',
    '/api/:path*',
    '/order-success' 
  ],
}