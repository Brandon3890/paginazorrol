import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN || '';

// Lista de APIS que son públicas 
const PUBLIC_APIS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/auth/verify',
  '/api/webhook/',  
  '/api/public/',   
];

// Lista de APIs que requieren autenticación 
const AUTH_REQUIRED_APIS = [
  '/api/checkout',
  '/api/orders',
  '/api/profile',
  '/api/user/addresses',
  '/api/admin',
];

 // La petición viene del mismo servidor o con token

 export async function verifyInternalRequest(request: NextRequest): Promise<boolean> {
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  const headersList = await headers();
  
  // Verificar token 
  const internalToken = headersList.get('x-internal-token') || request.headers.get('x-internal-token');
  if (internalToken === INTERNAL_API_TOKEN) {
    return true;
  }
  
  // Verificar que viene del mismo servidor
  const host = headersList.get('host') || '';
  const referer = headersList.get('referer') || '';
  
  if (host === 'localhost:3000' || host === '127.0.0.1:3000') {
    return true;
  }
  
  // Verificar que es una petición interna de Next.js
  const userAgent = headersList.get('user-agent') || '';
  const isNextJsInternal = userAgent.includes('Next.js') || 
                           userAgent.includes('Node.js') ||
                           referer.includes('/_next/');
  
  if (isNextJsInternal) {
    return true;
  }
  
  // Verificar que la IP es local 
  const forwardedFor = request.headers.get('x-forwarded-for') || '';
  const realIp = request.headers.get('x-real-ip') || '';
  
  if (forwardedFor === '127.0.0.1' || realIp === '127.0.0.1' || forwardedFor === '::1') {
    return true;
  }
  
  return false;
}

 // Verifica autenticación de usuario para APIs que lo requieren

 export async function verifyUserAuth(request: NextRequest): Promise<{ userId: number; role: string } | null> {
  try {
    // Obtener token de cookies o header
    const cookieHeader = request.headers.get('cookie') || '';
    let token = '';
    
    // Buscar en cookies
    const authTokenMatch = cookieHeader.match(/auth_token=([^;]+)/);
    if (authTokenMatch) {
      token = authTokenMatch[1];
    }
    
    // Buscar en header Authorization
    const authHeader = request.headers.get('authorization');
    if (!token && authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
    
    if (!token) {
      return null;
    }
    
    // Verificar JWT
    const { jwtVerify } = await import('jose');
    const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
    const { payload } = await jwtVerify(token, JWT_SECRET);
    
    return {
      userId: Number(payload.userId),
      role: payload.role as string
    };
  } catch (error) {
    console.error('Error verificando autenticación:', error);
    return null;
  }
}

 // Verifica si una API es pública 

export function isPublicApi(pathname: string): boolean {
  return PUBLIC_APIS.some(api => pathname.startsWith(api));
}

 // Verifica si una API requiere autenticación de usuario

 export function requiresUserAuth(pathname: string): boolean {
  return AUTH_REQUIRED_APIS.some(api => pathname.startsWith(api));
}

 // Proxy unificado de seguridad para APIs

 export async function protectApiRoute(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;
  
  // Solo aplicar a APIs
  if (!pathname.startsWith('/api/')) {
    return null;
  }
  
  // 1. APIs públicas 
  if (isPublicApi(pathname)) {
    return null;
  }
  
  //  Verificar token interno 
  const isInternal = await verifyInternalRequest(request);
  if (!isInternal) {
    return NextResponse.json(
      { error: 'Acceso no autorizado', message: 'Solo puede ser consumido internamente' },
      { status: 403 }
    );
  }
  
  // Para APIs que requieren autenticación de usuario
  if (requiresUserAuth(pathname)) {
    const user = await verifyUserAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'No autenticado', message: 'Inicia sesión para acceder a este recurso' },
        { status: 401 }
      );
    }
    
    // Verificar rol admin para APIs de admin
    if (pathname.startsWith('/api/admin') && user.role !== 'admin') {
      console.warn('Acceso denegado');
      return NextResponse.json(
        { error: 'Acceso denegado', message: 'Se requieren privilegios de administrador' },
        { status: 403 }
      );
    }
    
    console.log(`Usuario autenticado`);
  }
  
  return null;
}