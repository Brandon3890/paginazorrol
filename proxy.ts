// proxy.ts - VERSIÓN SIMPLIFICADA Y CORREGIDA
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// ✅ Solo headers de seguridad, SIN autenticación en proxy
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const response = NextResponse.next()
  
  // Headers de seguridad básicos
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  
  // Log para debugging
  if (pathname.startsWith('/api/categories')) {
    console.log('✅ API permitida:', pathname)
  }
  
  return response
}

export const config = {
  matcher: [
    // Solo páginas, NO APIs (las APIs no pasan por proxy)
    '/filtro/:path*',
    '/products/:path*',
    '/admin/:path*',
    '/checkout/:path*',
    '/profile/:path*',
    '/orders/:path*',
  ]
}