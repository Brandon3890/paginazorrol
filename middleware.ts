// middleware.ts 
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

// Rutas públicas de órdenes (si las hay)
const publicOrderRoutes = ['/order-success'] // Esta ruta debe ser pública

// Obtener IP real del cliente 
function getClientIP(request: NextRequest): string {
  // En producción, usar x-forwarded-for
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }
  
  // En desarrollo, usar x-real-ip o la IP de la conexión
  const realIP = request.headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }
  
  // Fallback para desarrollo
  return '127.0.0.1'
}

// Obtener User Agent
function getUserAgent(request: NextRequest): string {
  return request.headers.get('user-agent') || 'unknown'
}

// Verificar si una ruta requiere autenticación
function requiresAuth(pathname: string): boolean {
  // Si es una ruta pública de órdenes, no requiere auth
  if (publicOrderRoutes.some(route => pathname.startsWith(route))) {
    return false
  }
  
  // Si es una ruta protegida, requiere auth
  return protectedRoutes.some(route => pathname.startsWith(route))
}

// Verificar si es ruta de admin
function isAdminRoute(pathname: string): boolean {
  return adminRoutes.some(route => pathname.startsWith(route))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const clientIP = getClientIP(request)
  const userAgent = getUserAgent(request)
  
  const response = NextResponse.next()

  // Aplicar headers de seguridad globales
  const securityHeaders = getSecurityHeaders()
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  // CSP headers solo para páginas HTML
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

  // Rate limiting general para API
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/')) {
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

  // Verificación de autenticación para rutas protegidas
  const token = request.cookies.get('auth_token')?.value
  const needsAuth = requiresAuth(pathname)
  const isAdmin = isAdminRoute(pathname)

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
      
      // Rate limiting para administradores
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

        // Verificar rol de administrador
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

      // Agregar headers de usuario para las APIs
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

      // Para rutas de órdenes, verificar que el usuario pueda acceder a la orden específica
      if (pathname.startsWith('/orders/mysql/')) {
        // El acceso a órdenes específicas se maneja en el componente/page
        // Aquí solo verificamos que esté autenticado
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
      
      // Token inválido, limpiar cookie y redirigir
      const redirectResponse = NextResponse.redirect(new URL('/login', request.url))
      redirectResponse.cookies.delete('auth_token')
      
      // También aplicar headers de seguridad a la respuesta de redirección
      Object.entries(securityHeaders).forEach(([key, value]) => {
        redirectResponse.headers.set(key, value)
      })
      
      return redirectResponse
    }
  }

  // Log de peticiones importantes (opcional)
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
    '/order-success' 
  ],
}