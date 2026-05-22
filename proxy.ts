// proxy.ts

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

const isDev = process.env.NODE_ENV === 'development'

// ============================================
// RUTAS PROTEGIDAS
// ============================================

const protectedRoutes = [
  '/checkout',
  '/profile',
  '/orders'
]

const adminRoutes = [
  '/admin',
  '/api/admin'
]

// ============================================
// RUTAS PÚBLICAS
// ============================================

const publicRoutes = [
  '/',
  '/login',
  '/register',
  '/products',
  '/product',
  '/cart',
  '/filtro',
  '/order-success',
]

// ============================================
// OBTENER IP REAL
// ============================================

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

// ============================================
// LIMPIAR RUTAS PARA LOGS
// ============================================

function cleanLogPath(pathname: string): string {

  return pathname
    .replace(/\/image\/.*$/, '/image')
    .replace(/\/\d+$/, '/:id')
}

// ============================================
// APIs PÚBLICAS
// ============================================

function isPublicApiRoute(pathname: string, method: string): boolean {

  const publicApiPrefixes = [
    '/api/products',
    '/api/categories',
    '/api/banners',
    '/api/payment/response',
  ]

  // APIs públicas
  if (publicApiPrefixes.some(route => pathname.startsWith(route))) {
    return true
  }

  // Auth pública
  if (pathname.startsWith('/api/auth/')) {
    return true
  }

  // GET público órdenes
  if (pathname.match(/^\/api\/orders\/\d+$/)) {
    return method === 'GET'
  }

  return false
}

// ============================================
// REQUIERE AUTH
// ============================================

function requiresAuth(pathname: string): boolean {

  // Públicas
  if (publicRoutes.some(route => pathname === route)) {
    return false
  }

  // Subrutas públicas
  if (pathname.startsWith('/filtro')) {
    return false
  }

  if (pathname.startsWith('/products')) {
    return false
  }

  if (pathname.startsWith('/product')) {
    return false
  }

  // Protegidas
  return protectedRoutes.some(route =>
    pathname.startsWith(route)
  )
}

// ============================================
// ADMIN
// ============================================

function isAdminRoute(pathname: string): boolean {

  return adminRoutes.some(route =>
    pathname.startsWith(route)
  )
}

// ============================================
// PROXY
// ============================================

export async function proxy(request: NextRequest) {

  const { pathname } = request.nextUrl
  const method = request.method
  const clientIP = getClientIP(request)

  const cleanPath = cleanLogPath(pathname)

  // ============================================
  // LOGS SOLO EN DESARROLLO
  // ============================================

  if (isDev) {
    console.log(`  ${method} ${cleanPath}`)
  }

  const response = NextResponse.next()

  // ============================================
  // HEADERS SEGURIDAD
  // ============================================

  const securityHeaders = getSecurityHeaders()

  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  // ============================================
  // CSP SOLO HTML
  // ============================================

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
  // API PÚBLICA
  // ============================================

  const isPublicApi = isPublicApiRoute(pathname, method)

  if (pathname.startsWith('/api/') && isPublicApi) {

    if (isDev) {
      console.log(`  Pública: ${cleanPath}`)
    }

    return response
  }

  // ============================================
  // RATE LIMIT LOGIN
  // ============================================

  if (pathname === '/api/auth/login') {

    const limitResult =
      loginRateLimiter.attempt(`login_${clientIP}`)

    if (!limitResult.allowed) {

      console.warn('  Rate limit login:', {
        ip: clientIP
      })

      return NextResponse.json(
        {
          success: false,
          message: 'Demasiados intentos. Intenta nuevamente en 30 minutos.'
        },
        {
          status: 429
        }
      )
    }
  }

  // ============================================
  // RATE LIMIT API PRIVADA
  // ============================================

  if (
    pathname.startsWith('/api/') &&
    !isPublicApi
  ) {

    const limitResult =
      apiRateLimiter.attempt(`api_${clientIP}`)

    if (!limitResult.allowed) {

      console.warn('Rate limit API:', {
        ip: clientIP,
        path: cleanPath
      })

      return NextResponse.json(
        {
          success: false,
          message: 'Demasiadas peticiones.'
        },
        {
          status: 429
        }
      )
    }
  }

  // ============================================
  // AUTH
  // ============================================

  const token =
    request.cookies.get('auth_token')?.value

  const needsAuth =
    requiresAuth(pathname)

  const isAdmin =
    isAdminRoute(pathname)

  const requiresApiAuth =
    pathname.startsWith('/api/') &&
    !isPublicApi

  if (
    needsAuth ||
    isAdmin ||
    requiresApiAuth
  ) {

    // ============================================
    // SIN TOKEN
    // ============================================

    if (!token) {

      console.warn('❌ No autorizado:', {
        path: cleanPath,
        ip: clientIP
      })

      // APIs
      if (pathname.startsWith('/api/')) {

        return NextResponse.json(
          {
            error: 'No autorizado'
          },
          {
            status: 401
          }
        )
      }

      // Redirect páginas
      const loginUrl =
        new URL('/login', request.url)

      loginUrl.searchParams.set('from', pathname)

      return NextResponse.redirect(loginUrl)
    }

    // ============================================
    // VALIDAR JWT
    // ============================================

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
          adminRateLimiter.attempt(`admin_${payload.userId}`)

        if (!adminLimitResult.allowed) {

          console.warn('  Rate limit admin:', {
            userId: payload.userId
          })

          return NextResponse.json(
            {
              success: false,
              message: 'Demasiadas acciones administrativas.'
            },
            {
              status: 429
            }
          )
        }

        // Verificar rol
        if (payload.role !== 'admin') {

          console.warn('❌ Acceso admin denegado:', {
            userId: payload.userId,
            path: cleanPath
          })

          return NextResponse.redirect(
            new URL('/unauthorized', request.url)
          )
        }
      }

      // ============================================
      // HEADERS APIs
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

        requestHeaders.set(
          'x-client-ip',
          clientIP
        )

        return NextResponse.next({
          request: {
            headers: requestHeaders
          }
        })
      }

    } catch (error) {

      console.error('❌ Token inválido:', {
        path: cleanPath,
        error: error instanceof Error
          ? error.message
          : 'Unknown error'
      })

      // APIs
      if (pathname.startsWith('/api/')) {

        return NextResponse.json(
          {
            error: 'Token inválido'
          },
          {
            status: 401
          }
        )
      }

      // Redirect páginas
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

// ============================================
// MATCHER
// ============================================

export const config = {
  matcher: [
    '/api/:path*',
    '/admin/:path*',
    '/checkout/:path*',
    '/orders/:path*',
    '/profile/:path*',
    '/filtro/:path*',
    '/order-success/:path*',
  ],
}