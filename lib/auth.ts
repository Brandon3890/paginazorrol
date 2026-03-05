// lib/auth.ts - COMPLETO Y CORREGIDO
import { jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret-key-change-in-production')

export interface UserSession {
  user: {
    id: number
    email: string
    firstName: string
    lastName: string
    role: string
  }
}

export async function getServerSession(): Promise<UserSession | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value

    if (!token) {
      return null
    }

    const { payload } = await jwtVerify(token, JWT_SECRET)
    
    return {
      user: {
        id: Number(payload.userId),
        email: payload.email as string,
        firstName: payload.firstName as string,
        lastName: payload.lastName as string,
        role: payload.role as string
      }
    }
  } catch (error) {
    return null
  }
}

// Nueva función verifyToken para API routes
export async function verifyToken(request: NextRequest): Promise<{
  id: number
  email: string
  firstName: string
  lastName: string
  role: string
} | null> {
  try {
    // Primero intentar obtener el token del header Authorization
    const authHeader = request.headers.get('authorization')
    let token: string | undefined

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7)
    } else {
      // Si no está en el header, buscar en las cookies
      const cookieHeader = request.headers.get('cookie')
      if (cookieHeader) {
        const cookies = Object.fromEntries(
          cookieHeader.split(';').map(cookie => {
            const [name, ...value] = cookie.trim().split('=')
            return [name, value.join('=')]
          })
        )
        token = cookies['auth-token'] || cookies['auth_token']
      }
    }

    if (!token) {
      return null
    }

    const { payload } = await jwtVerify(token, JWT_SECRET)
    
    return {
      id: Number(payload.userId),
      email: payload.email as string,
      firstName: payload.firstName as string,
      lastName: payload.lastName as string,
      role: payload.role as string
    }
  } catch (error) {
    console.error('Error verifying token:', error)
    return null
  }
}

// Función auxiliar para verificar si el usuario es admin
export async function verifyAdmin(request: NextRequest): Promise<{
  id: number
  email: string
  firstName: string
  lastName: string
  role: string
} | null> {
  const user = await verifyToken(request)
  if (!user || user.role !== 'admin') {
    return null
  }
  return user
}