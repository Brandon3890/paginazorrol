// proxy.ts - Colocar en la raíz del proyecto (NO dentro de app/api/)
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Todas las rutas de API públicas (NO requieren autenticación)
const PUBLIC_API_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/auth/verify',
  '/api/banners',
  '/api/categories',    // ✅ Categorías públicas
  '/api/products',      // ✅ Productos públicos
  '/api/payment/response',
  '/api/shipping/rate',
]

// Páginas públicas
const PUBLIC_PAGES = [
  '/',
  '/login',
  '/register',
  '/cart',
  '/filtro',           // ✅ Página de filtros
]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  console.log(`🔍 Proxy: ${pathname}`)
  
  // === 1. ARCHIVOS ESTÁTICOS ===
  if (pathname.match(/\.(svg|png|jpg|jpeg|gif|ico|webp|css|js|json)$/)) {
    return NextResponse.next()
  }
  
  // === 2. API PÚBLICAS ===
  if (pathname.startsWith('/api/')) {
    const isPublicApi = PUBLIC_API_ROUTES.some(route => 
      pathname === route || pathname.startsWith(route + '/')
    )
    
    if (isPublicApi) {
      console.log(`✅ API pública: ${pathname}`)
      return NextResponse.next()
    }
    
    // API privada - requiere autenticación
    const token = request.cookies.get('auth_token')?.value
    if (!token) {
      console.log(`❌ API privada sin token: ${pathname}`)
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }
    
    console.log(`✅ API privada con token: ${pathname}`)
    return NextResponse.next()
  }
  
  // === 3. PÁGINAS PÚBLICAS ===
  const isPublicPage = PUBLIC_PAGES.some(route => 
    pathname === route || pathname.startsWith(route + '/')
  )
  
  if (isPublicPage) {
    console.log(`✅ Página pública: ${pathname}`)
    return NextResponse.next()
  }
  
  // === 4. RUTAS PROTEGIDAS ===
  const token = request.cookies.get('auth_token')?.value
  if (!token) {
    console.log(`❌ Ruta protegida sin token: ${pathname}`)
    const url = new URL('/login', request.url)
    url.searchParams.set('from', pathname)
    return NextResponse.redirect(url)
  }
  
  console.log(`✅ Ruta protegida con token: ${pathname}`)
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}