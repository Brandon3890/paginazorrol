import { NextRequest, NextResponse } from 'next/server'
import { query, queryRows } from '@/lib/db'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET as string

interface DecodedToken {
  userId: number
  email: string
  role: string
}

interface UserRow {
  id: number
  rut: string | null
  email: string
  first_name: string
  last_name: string
  phone: string | null
  role: string
  is_active: number
  is_guest: number
}

export async function PUT(request: NextRequest) {
  try {

    if (!JWT_SECRET) {
      return NextResponse.json(
        { error: 'Error de configuración del servidor' },
        { status: 500 }
      )
    }

    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'No autorizado - Token no encontrado' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    let decoded: DecodedToken

    try {
      decoded = jwt.verify(token, JWT_SECRET) as DecodedToken
    } catch (err) {
      return NextResponse.json(
        { error: 'Token inválido o expirado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { firstName, lastName, email, phone } = body

    if (!firstName?.trim() || !lastName?.trim() || !email?.trim()) {
      return NextResponse.json(
        { error: 'Nombre, apellido y email son requeridos' },
        { status: 400 }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'El email no tiene un formato válido' },
        { status: 400 }
      )
    }

    let normalizedPhone: string | null = null
    if (phone && phone.trim() !== '') {
      const cleanedPhone = phone.trim()
      const phoneRegex = /^[+\d\s-]{6,20}$/
      if (!phoneRegex.test(cleanedPhone)) {
        return NextResponse.json(
          { error: 'El teléfono contiene caracteres no válidos o es demasiado largo' },
          { status: 400 }
        )
      }
      normalizedPhone = cleanedPhone
    }

    const existingUsers = await queryRows<UserRow>(
      'SELECT id FROM users WHERE email = ? AND id != ?',
      [email.trim().toLowerCase(), decoded.userId]
    )

    if (existingUsers.length > 0) {
      return NextResponse.json(
        { error: 'El email ya está registrado por otro usuario' },
        { status: 409 }
      )
    }

    await query(
      `UPDATE users 
       SET first_name = ?, 
           last_name = ?, 
           email = ?, 
           phone = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        firstName.trim(),
        lastName.trim(),
        email.trim().toLowerCase(),
        normalizedPhone,
        decoded.userId
      ]
    )

    const updatedUsers = await queryRows<UserRow>(
      `SELECT id, rut, email, first_name, last_name, phone, role, is_active, is_guest 
       FROM users 
       WHERE id = ?`,
      [decoded.userId]
    )

    if (updatedUsers.length === 0) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    const user = updatedUsers[0]


    return NextResponse.json({
      success: true,
      message: 'Perfil actualizado correctamente',
      user: {
        id: user.id,
        rut: user.rut,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone || '',
        role: user.role,
        isActive: Boolean(user.is_active),
        isGuest: Boolean(user.is_guest)
      }
    })

  } catch (error: any) {
    console.error('Error en update:', error)
    return NextResponse.json(
      { error: error.message || 'Error al actualizar el perfil' },
      { status: 500 }
    )
  }
}