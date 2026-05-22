import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)

// TODAS las rutas de API que son públicas (NO requieren autenticación)
const PUBLIC_API_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/auth/verify',
  '/api/payment/response',
  '/api/shipping/rate',
  '/api/simplefactura/pdf',
  '/api/banners',
  '/api/categories',
  '/api/products',
]

// Rutas de página públicas
const PUBLIC_PAGES = [
  '/',
  '/login',
  '/register',
  '/products',
  '/product',
  '/cart',
  '/order-success',
  '/filtro',
]

// Verificar si es una ruta de API pública
function isPublicApiRoute(pathname: string): boolean {
  // Exact match
  if (PUBLIC_API_ROUTES.includes(pathname)) {
    return true
  }
  // Subrutas de banners
  if (pathname.startsWith('/api/banners/')) {
    return true
  }
  // Subrutas de categorías
  if (pathname.startsWith('/api/categories/')) {
    return true
  }
  // Subrutas de productos (GET)
  if (pathname.startsWith('/api/products/')) {
    return true
  }
  return false
}

// Verificar si es una página pública
function isPublicPage(pathname: string): boolean {
  if (PUBLIC_PAGES.includes(pathname)) {
    return true
  }
  if (pathname.startsWith('/filtro')) {
    return true
  }
  return false
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const method = request.method

  console.log(`🔍 Proxy: ${method} ${pathname}`)

  // ============================================
  // 1. ARCHIVOS ESTÁTICOS - Siempre públicos
  // ============================================
  if (pathname.match(/\.(svg|png|jpg|jpeg|gif|ico|webp|css|js|json)$/)) {
    return NextResponse.next()
  }

  // ============================================
  // 2. API PÚBLICAS - No requieren autenticación
  // ============================================
  if (pathname.startsWith('/api/') && isPublicApiRoute(pathname)) {
    console.log('✅ API PÚBLICA:', pathname)
    return NextResponse.next()
  }

  // ============================================
  // 3. PÁGINAS PÚBLICAS - No requieren autenticación
  // ============================================
  if (isPublicPage(pathname)) {
    console.log('✅ PÁGINA PÚBLICA:', pathname)
    return NextResponse.next()
  }

  // ============================================
  // 4. RUTAS PROTEGIDAS - Requieren autenticación
  // ============================================
  const token = request.cookies.get('auth_token')?.value

  if (!token) {
    console.log('❌ No autorizado - Sin token:', pathname)
    
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'No autorizado. Inicia sesión para continuar.' },
        { status: 401 }
      )
    }
    
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Verificar token
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    console.log('✅ Usuario autenticado:', { userId: payload.userId, role: payload.role })
    
    // Verificar rutas de admin
    if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
      if (payload.role !== 'admin') {
        console.log('❌ No es admin:', pathname)
        return NextResponse.redirect(new URL('/unauthorized', request.url))
      }
    }
    
    return NextResponse.next()
    
  } catch (error) {
    console.error('❌ Token inválido:', pathname)
    
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('auth_token')
    return response
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}