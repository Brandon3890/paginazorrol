// lib/auth-utils.ts
import { jwtVerify } from 'jose'
import { NextRequest } from 'next/server'

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)

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
  // 1. Intentar obtener user_id si está autenticado
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '') || request.cookies.get('auth_token')?.value
  
  if (token) {
    try {
      // Intentar decodificar el token para obtener el userId
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

  // 2. Si no hay token, usar guest session
  const guestSessionId = request.cookies.get('guest_session_id')?.value
  if (guestSessionId) {
    return `guest_${guestSessionId}`
  }

  // 3. Si no hay guest session, generar un ID temporal basado en la IP y user-agent
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             request.headers.get('cf-connecting-ip') || 
             'unknown'
  const userAgent = request.headers.get('user-agent') || 'unknown'
  
  // Crear un hash simple
  const str = `${ip}:${userAgent}:${Date.now()}`
  const hash = Buffer.from(str).toString('base64').substring(0, 30)
  
  return `temp_${hash}`
}

export function createGuestIdentifier(request: NextRequest): string {
  // Generar un identifier para invitados sin sesión
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             request.headers.get('cf-connecting-ip') || 
             'unknown'
  const userAgent = request.headers.get('user-agent') || 'unknown'
  const timestamp = Date.now()
  
  const str = `${ip}:${userAgent}:${timestamp}:${Math.random()}`
  const hash = Buffer.from(str).toString('base64').substring(0, 40)
  
  return `guest_temp_${hash}`
}