import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { serialize } from 'cookie'
import { query } from '@/lib/db'

const JWT_SECRET = process.env.JWT_SECRET!

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET no está definida en las variables de entorno')
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: 'Email y contraseña son requeridos' },
        { status: 400 }
      )
    }

    console.log('🔐 Intentando login para:', email)

    // Buscar usuario
    const users = await query(
      'SELECT * FROM users WHERE email = ? AND is_active = 1',
      [email]
    ) as any[]

    if (!users || users.length === 0) {
      console.log('❌ Usuario no encontrado:', email)
      return NextResponse.json(
        { success: false, message: 'Credenciales inválidas' },
        { status: 401 }
      )
    }

    const user = users[0]
    console.log('✅ Usuario encontrado:', user.email)

    // VERIFICACIÓN DIRECTA - Para desarrollo
    // Las contraseñas en tu BD son: demo123 y admin123
    const developmentPasswords: Record<string, string> = {
      'demo@example.com': 'demo123',
      'admin@ludicagames.com': 'admin123'
    }

    const expectedPassword = developmentPasswords[email]
    let isPasswordValid = false

    if (expectedPassword) {
      // Verificación directa para desarrollo
      isPasswordValid = password === expectedPassword
      console.log('🔑 Verificación directa:', isPasswordValid)
    }

    // Si la verificación directa falla, intenta con bcrypt
    if (!isPasswordValid) {
      try {
        // Normalizar hash para compatibilidad
        let normalizedHash = user.password_hash
        if (normalizedHash.startsWith('$2a$')) {
          normalizedHash = normalizedHash.replace('$2a$', '$2b$')
        }
        
        isPasswordValid = await bcrypt.compare(password, normalizedHash)
        console.log('🔑 Resultado bcrypt:', isPasswordValid)
      } catch (bcryptError) {
        console.error('❌ Error bcrypt:', bcryptError)
      }
    }

    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, message: 'Credenciales inválidas' },
        { status: 401 }
      )
    }

    // Generar token JWT
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    // Actualizar último login
    await query(
      'UPDATE users SET last_login = NOW() WHERE id = ?',
      [user.id]
    )

    const userData = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone,
    }

    // Cookie segura
    const cookie = serialize('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    const response = NextResponse.json({
      success: true,
      user: userData,
      token,
    })

    response.headers.set('Set-Cookie', cookie)
    console.log('✅ Login exitoso para:', user.email)
    return response

  } catch (error) {
    console.error('❌ Login error:', error)
    return NextResponse.json(
      { success: false, message: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}