// proxy.ts
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

// Rutas protegidas que requieren autenticación
const protectedRoutes = ['/checkout', '/profile', '/orders']
const adminRoutes = ['/admin', '/api/admin']

// ✅ Rutas públicas que NO requieren autenticación
const publicRoutes = ['/api/categories', '/api/products', '/filtro', '/products']
const publicOrderRoutes = ['/order-success']

// Obtener IP real del cliente
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

// ✅ Verificar si es una ruta pública (no requiere auth)
function isPublicRoute(pathname: string): boolean {
  // Rutas de API públicas
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return true
  }
  
  // Rutas de órdenes públicas
  if (publicOrderRoutes.some(route => pathname.startsWith(route))) {
    return true
  }
  
  // Archivos estáticos
  if (pathname.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|webp)$/)) {
    return true
  }
  
  // Next.js internals
  if (pathname.startsWith('/_next')) {
    return true
  }
  
  return false
}

function requiresAuth(pathname: string): boolean {
  // Si es pública, no requiere auth
  if (isPublicRoute(pathname)) {
    return false
  }
  
  // Si es ruta protegida, requiere auth
  return protectedRoutes.some(route => pathname.startsWith(route))
}

function isAdminRoute(pathname: string): boolean {
  // Si es pública, no es admin
  if (isPublicRoute(pathname)) {
    return false
  }
  return adminRoutes.some(route => pathname.startsWith(route))
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const clientIP = getClientIP(request)
  const userAgent = getUserAgent(request)

  const response = NextResponse.next()

  // Headers de seguridad
  const securityHeaders = getSecurityHeaders()
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  // ✅ NO aplicar CSP a las API (esto causaba problemas)
  if (
    !pathname.startsWith('/api/') &&
    !pathname.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)
  ) {
    const cspHeaders = getCSPHeaders()
    Object.entries(cspHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
  }

  // ✅ Rate limit login (solo para login)
  if (pathname === '/api/auth/login') {
    const limitResult = loginRateLimiter.attempt(`login_${clientIP}`)
    if (!limitResult.allowed) {
      console.log('🚫 Rate limit excedido para login:', {
        ip: clientIP,
        userAgent: userAgent.substring(0, 50),
        path: pathname
      })
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

  // ✅ Rate limit API (excepto rutas públicas)
  if (
    pathname.startsWith('/api/') &&
    !pathname.startsWith('/api/auth/') &&
    !isPublicRoute(pathname)
  ) {
    const limitResult = apiRateLimiter.attempt(`api_${clientIP}`)
    if (!limitResult.allowed) {
      console.log('🚫 Rate limit excedido para API:', {
        ip: clientIP,
        path: pathname
      })
      return NextResponse.json(
        {
          success: false,
          message: 'Demasiadas peticiones. Intenta nuevamente más tarde.'
        },
        { status: 429 }
      )
    }
  }

  // ✅ VERIFICAR AUTH - Saltar si es ruta pública
  const token = request.cookies.get('auth_token')?.value
  const needsAuth = requiresAuth(pathname)
  const isAdmin = isAdminRoute(pathname)

  // ✅ Si es ruta pública, NO verificar autenticación
  if (isPublicRoute(pathname)) {
    console.log('✅ Ruta pública permitida:', pathname)
    return response
  }

  // Solo verificar auth si NO es pública
  if (needsAuth || isAdmin) {
    if (!token) {
      console.log('🔐 Redirigiendo al login desde:', {
        path: pathname,
        ip: clientIP
      })
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('from', pathname)
      return NextResponse.redirect(loginUrl)
    }

    try {
      const { payload } = await jwtVerify(token, JWT_SECRET)

      if (isAdmin) {
        const adminLimitResult = adminRateLimiter.attempt(`admin_${payload.userId}`)
        if (!adminLimitResult.allowed) {
          console.log('🚫 Rate limit excedido para admin:', {
            email: payload.email,
            userId: payload.userId,
            path: pathname
          })
          return NextResponse.json(
            {
              success: false,
              message: 'Demasiadas acciones administrativas. Espera un momento.'
            },
            { status: 429 }
          )
        }

        if (payload.role !== 'admin') {
          console.log('❌ Intento de acceso admin no autorizado:', {
            email: payload.email,
            userId: payload.userId,
            path: pathname,
            ip: clientIP
          })
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
          request: { headers: requestHeaders }
        })
      }

      if (pathname.startsWith('/orders/mysql/')) {
        console.log('📦 Acceso a orden MySQL:', {
          userId: payload.userId,
          path: pathname,
          ip: clientIP
        })
      }
    } catch (error) {
      console.error('❌ Token verification failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip: clientIP,
        path: pathname
      })
      const redirectResponse = NextResponse.redirect(new URL('/login', request.url))
      redirectResponse.cookies.delete('auth_token')
      Object.entries(securityHeaders).forEach(([key, value]) => {
        redirectResponse.headers.set(key, value)
      })
      return redirectResponse
    }
  }

  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    console.log('👨‍💼 Acceso admin:', {
      path: pathname,
      ip: clientIP,
      timestamp: new Date().toISOString()
    })
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
    '/order-success',
    '/filtro/:path*',  // ✅ Agregar filtro al matcher
    '/products/:path*'  // ✅ Agregar productos al matcher
  ]
}