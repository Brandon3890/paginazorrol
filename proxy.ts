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

// Rutas públicas (sin autenticación)
const publicRoutes = [
  '/', 
  '/login', 
  '/register', 
  '/products', 
  '/product', 
  '/cart',
  '/order-success'  // Página de éxito pública
]

// Endpoints API públicos (solo lectura)
const publicApiRoutes = [
  '/api/auth/login',
  '/api/auth/register', 
  '/api/auth/logout',
  '/api/auth/verify',
  '/api/payment/response',  // Callback de Webpay (obligatorio)
  '/api/shipping/rate',     // Cotización de envíos
  '/api/simplefactura/pdf',  // PDF de boleta
]

// Función para verificar si una ruta de API específica es pública
function isPublicApiRoute(pathname: string, method: string): boolean {
  // Endpoints públicos exactos
  if (publicApiRoutes.some(route => pathname === route)) {
    return true
  }
  
  // Endpoint de órdenes: GET es público (para order-success), otros métodos requieren auth
  if (pathname.match(/^\/api\/orders\/\d+$/)) {
    return method === 'GET'  // Solo GET es público
  }
  
  // Listado de órdenes: solo para usuarios autenticados
  if (pathname === '/api/orders' && method === 'GET') {
    return false  // Requiere autenticación
  }
  
  return false
}

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

function requiresAuth(pathname: string): boolean {
  // Rutas públicas no requieren auth
  if (publicRoutes.some(route => pathname === route)) {
    return false
  }
  if (publicRoutes.some(route => pathname.startsWith(route + '?'))) {
    return false
  }
  
  // Rutas protegidas
  return protectedRoutes.some(route => pathname.startsWith(route))
}

function isAdminRoute(pathname: string): boolean {
  return adminRoutes.some(route => pathname.startsWith(route))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const method = request.method
  const clientIP = getClientIP(request)
  const userAgent = getUserAgent(request)
  
  const response = NextResponse.next()

  // Headers de seguridad
  const securityHeaders = getSecurityHeaders()
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  // CSP solo para páginas HTML
  if (!pathname.startsWith('/api/') && !pathname.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)) {
    const cspHeaders = getCSPHeaders()
    Object.entries(cspHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
  }

  // Rate limiting para login
  if (pathname === '/api/auth/login') {
    const limitResult = loginRateLimiter.attempt(`login_${clientIP}`)
    if (!limitResult.allowed) {
      return NextResponse.json(
        { success: false, message: 'Demasiados intentos. Intenta en 30 minutos.' },
        { status: 429 }
      )
    }
  }

  // Rate limiting general para API (excepto públicas)
  if (pathname.startsWith('/api/') && !isPublicApiRoute(pathname, method)) {
    const limitResult = apiRateLimiter.attempt(`api_${clientIP}`)
    if (!limitResult.allowed) {
      return NextResponse.json(
        { success: false, message: 'Demasiadas peticiones.' },
        { status: 429 }
      )
    }
  }

  // Verificar si es una API pública (no requiere auth)
  if (isPublicApiRoute(pathname, method)) {
    console.log('✅ API pública:', { pathname, method })
    return response
  }

  // Verificar autenticación para el resto
  const token = request.cookies.get('auth_token')?.value
  const needsAuth = requiresAuth(pathname)
  const isAdmin = isAdminRoute(pathname)

  if (needsAuth || isAdmin || pathname.startsWith('/api/')) {
    if (!token) {
      // Si es API, devolver 401
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
      
      // Si es página, redirigir a login
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
            { success: false, message: 'Demasiadas acciones. Espera un momento.' },
            { status: 429 }
          )
        }

        if (payload.role !== 'admin') {
          return NextResponse.redirect(new URL('/unauthorized', request.url))
        }
      }

      // Agregar headers de usuario para APIs
      if (pathname.startsWith('/api/')) {
        const requestHeaders = new Headers(request.headers)
        requestHeaders.set('x-user-id', String(payload.userId))
        requestHeaders.set('x-user-email', String(payload.email))
        requestHeaders.set('x-user-role', String(payload.role))

        return NextResponse.next({
          request: { headers: requestHeaders },
        })
      }

    } catch (error) {
      console.error('❌ Token inválido:', { path: pathname })
      
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
      }
      
      const redirectResponse = NextResponse.redirect(new URL('/login', request.url))
      redirectResponse.cookies.delete('auth_token')
      return redirectResponse
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}