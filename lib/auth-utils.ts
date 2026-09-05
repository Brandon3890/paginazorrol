// lib/auth-utils.ts
import { jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)
const GUEST_IDENTIFIER_COOKIE = 'guest_identifier'

export async function getUserIdFromRequest(request: NextRequest): Promise<number | null> {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('auth_token')?.value

    if (!token) {
      return null
    }

    const { payload } = await jwtVerify(token, JWT_SECRET)
    
    if (!payload.userId) {
      return null
    }

    return Number(payload.userId)

  } catch (error) {
    return null
  }
}

export function getIdentifierFromRequest(request: NextRequest): string {
  // 1. Intentar obtener user id si está autenticado
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '') || request.cookies.get('auth_token')?.value
  
  if (token) {
    try {
      const parts = token.split('.')
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())
        if (payload.userId) {
          return `user_${payload.userId}`
        }
      }
    } catch (e) {
      // Si no se puede decodificar, continuar
    }
  }

  // 2. Si no hay token, usar el identifier de la cookie
  const cookieIdentifier = request.cookies.get(GUEST_IDENTIFIER_COOKIE)?.value
  if (cookieIdentifier) {
    return cookieIdentifier
  }

  // 3. Si no hay cookie, usar guest session
  const guestSessionId = request.cookies.get('guest_session_id')?.value
  if (guestSessionId) {
    const identifier = `guest_${guestSessionId}`
    // Guardar en cookie para futuras visitas
    const response = NextResponse.next()
    response.cookies.set(GUEST_IDENTIFIER_COOKIE, identifier, {
      maxAge: 60 * 60 * 24 * 30, // 30 días
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    })
    return identifier
  }

  // 4. Si no hay nada, generar un nuevo identifier estable
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             request.headers.get('cf-connecting-ip') || 
             'unknown'
  const userAgent = request.headers.get('user-agent') || 'unknown'
  
  // Crear un identifier basado en IP y userAgent (estable entre visitas)
  const str = `${ip}:${userAgent}`
  const hash = Buffer.from(str).toString('base64').substring(0, 30)
  const identifier = `guest_${hash}`
  
  // Guardar en cookie
  const response = NextResponse.next()
  response.cookies.set(GUEST_IDENTIFIER_COOKIE, identifier, {
    maxAge: 60 * 60 * 24 * 30, // 30 días
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  })
  
  return identifier
}

export function createGuestIdentifier(request: NextRequest): string {
  // Generar un identifier estable para invitados
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             request.headers.get('cf-connecting-ip') || 
             'unknown'
  const userAgent = request.headers.get('user-agent') || 'unknown'
  const timestamp = Date.now()
  
  // Usar una combinación de IP y userAgent para estabilidad
  const str = `${ip}:${userAgent}`
  const hash = Buffer.from(str).toString('base64').substring(0, 30)
  
  return `guest_${hash}`
}

// Función para obtener el identifier en el cliente (usando cookies)
export function getClientIdentifier(): string | null {
  if (typeof document === 'undefined') return null
  
  // Buscar en cookies
  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=')
    if (name === GUEST_IDENTIFIER_COOKIE) {
      return decodeURIComponent(value)
    }
  }
  
  // Si no hay cookie, generar uno temporal
  const tempId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
  document.cookie = `${GUEST_IDENTIFIER_COOKIE}=${encodeURIComponent(tempId)}; path=/; max-age=${60 * 60 * 24 * 30}`
  return tempId
}