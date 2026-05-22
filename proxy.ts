import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import {
  loginRateLimiter,
  apiRateLimiter,
  adminRateLimiter
} from '@/lib/rate-limiter'
import {
  getSecurityHeaders,
  getCSPHeaders
} from '@/lib/security-headers'

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)

const protectedRoutes = ['/checkout', '/profile', '/orders']
const adminRoutes = ['/admin', '/api/admin']

// APIs públicas
const publicApiPrefixes = [
  '/api/products',
  '/api/categories',
  '/api/banners',
  '/api/payment/response'
]

// Páginas públicas
const publicRoutes = [
  '/',
  '/login',
  '/register',
  '/productos',
  '/product',
  '/cart',
  '/filtro',
  '/order-success'
]

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

function isPublicApi(pathname: string): boolean {
  return publicApiPrefixes.some(route =>
    pathname.startsWith(route)
  )
}

function requiresAuth(pathname: string): boolean {
  if (
    publicRoutes.some(route =>
      pathname === route ||
      pathname.startsWith(route + '/')
    )
  ) {
    return false
  }

  return protectedRoutes.some(route =>
    pathname.startsWith(route)
  )
}

function isAdminRoute(pathname: string): boolean {
  return adminRoutes.some(route =>
    pathname.startsWith(route)
  )
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const method = request.method

  // ============================================
  // IGNORAR REQUESTS INTERNAS DE NEXT
  // ============================================

  const isRSC =
    request.headers.get('rsc') === '1'

  const isPrefetch =
    request.headers.get('next-router-prefetch') === '1'

  const isNextInternal =
    pathname.startsWith('/_next')

  if (isRSC || isPrefetch || isNextInternal) {
    return NextResponse.next()
  }

  const clientIP = getClientIP(request)

  const response = NextResponse.next()

  // ============================================
  // HEADERS SEGURIDAD
  // ============================================

  const securityHeaders = getSecurityHeaders()

  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  // CSP solo HTML
  if (
    !pathname.startsWith('/api/') &&
    !pathname.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|webp)$/)
  ) {
    const cspHeaders = getCSPHeaders()

    Object.entries(cspHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
  }

  // ============================================
  // APIs PÚBLICAS
  // ============================================

  if (
    pathname.startsWith('/api/') &&
    isPublicApi(pathname)
  ) {
    return response
  }

  // ============================================
  // RATE LIMIT LOGIN
  // ============================================

  if (pathname === '/api/auth/login') {
    const limitResult =
      loginRateLimiter.attempt(`login_${clientIP}`)

    if (!limitResult.allowed) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Demasiados intentos. Intenta más tarde.'
        },
        { status: 429 }
      )
    }
  }

  // ============================================
  // RATE LIMIT APIs
  // ============================================

  if (pathname.startsWith('/api/')) {
    const limitResult =
      apiRateLimiter.attempt(`api_${clientIP}`)

    if (!limitResult.allowed) {
      return NextResponse.json(
        {
          success: false,
          message: 'Demasiadas peticiones.'
        },
        { status: 429 }
      )
    }
  }

  const token =
    request.cookies.get('auth_token')?.value

  const needsAuth = requiresAuth(pathname)
  const isAdmin = isAdminRoute(pathname)

  const apiNeedsAuth =
    pathname.startsWith('/api/') &&
    !isPublicApi(pathname)

  // ============================================
  // AUTENTICACIÓN
  // ============================================

  if (needsAuth || isAdmin || apiNeedsAuth) {
    if (!token) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'No autorizado' },
          { status: 401 }
        )
      }

      const loginUrl = new URL('/login', request.url)

      loginUrl.searchParams.set('from', pathname)

      return NextResponse.redirect(loginUrl)
    }

    try {
      const { payload } = await jwtVerify(
        token,
        JWT_SECRET
      )

      // ============================================
      // ADMIN
      // ============================================

      if (isAdmin) {
        const adminLimitResult =
          adminRateLimiter.attempt(
            `admin_${payload.userId}`
          )

        if (!adminLimitResult.allowed) {
          return NextResponse.json(
            {
              success: false,
              message:
                'Demasiadas acciones administrativas.'
            },
            { status: 429 }
          )
        }

        if (payload.role !== 'admin') {
          return NextResponse.redirect(
            new URL('/unauthorized', request.url)
          )
        }
      }

      // ============================================
      // HEADERS USER APIs
      // ============================================

      if (pathname.startsWith('/api/')) {
        const requestHeaders =
          new Headers(request.headers)

        requestHeaders.set(
          'x-user-id',
          String(payload.userId)
        )

        requestHeaders.set(
          'x-user-email',
          String(payload.email)
        )

        requestHeaders.set(
          'x-user-role',
          String(payload.role)
        )

        return NextResponse.next({
          request: {
            headers: requestHeaders
          }
        })
      }
    } catch (error) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Token inválido' },
          { status: 401 }
        )
      }

      const redirectResponse =
        NextResponse.redirect(
          new URL('/login', request.url)
        )

      redirectResponse.cookies.delete('auth_token')

      return redirectResponse
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
  ]
}