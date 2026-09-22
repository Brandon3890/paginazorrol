import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import pool from '@/lib/db'
import { validateRutInput, cleanRut } from '@/lib/rut-utils'

export async function POST(request: NextRequest) {
  try {
    const { email, password, firstName, lastName, phone, rut } = await request.json()

    if (!email || !password || !firstName || !lastName || !rut) {
      return NextResponse.json(
        { success: false, error: 'Todos los campos obligatorios deben ser completados' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      )
    }

    const rutValidation = validateRutInput(rut)
    if (!rutValidation.isValid) {
      return NextResponse.json(
        { success: false, error: rutValidation.message },
        { status: 400 }
      )
    }

    const cleanRutValue = cleanRut(rut)
    const normalizedEmail = email.trim().toLowerCase()

    const [existingUsers] = await pool.execute(
      'SELECT id, is_guest, email FROM users WHERE email = ?',
      [normalizedEmail]
    ) as any[]

    
    let userId: number = 0
    let isConvertingGuest = false

    if (existingUsers.length > 0) {
      const existingUser = existingUsers[0]

      if (existingUser.is_guest !== 1) {
        return NextResponse.json(
          { success: false, error: 'Ya existe una cuenta con este email. Inicia sesión en su lugar.' },
          { status: 409 }
        )
      }

      isConvertingGuest = true
      userId = existingUser.id
    }

    if (!isConvertingGuest) {
      const [existingRuts] = await pool.execute(
        'SELECT id FROM users WHERE rut = ? AND is_guest = 0',
        [cleanRutValue]
      ) as any[]

      if (existingRuts.length > 0) {
        return NextResponse.json(
          { success: false, error: 'Ya existe una cuenta con este RUT' },
          { status: 409 }
        )
      }
    }

    const passwordHash = await bcrypt.hash(password, 10)

    if (isConvertingGuest) {
      await pool.execute(
        `UPDATE users 
         SET password_hash = ?,
             first_name = ?,
             last_name = ?,
             phone = ?,
             rut = ?,
             is_guest = 0,
             email_verified = 1,
             is_active = 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [passwordHash, firstName, lastName, phone || null, cleanRutValue, userId]
      )

      const [existingCustomer] = await pool.execute(
        'SELECT id FROM customers WHERE user_id = ?',
        [userId]
      ) as any[]

      if (existingCustomer.length === 0) {
        await pool.execute(
          'INSERT INTO customers (user_id, loyalty_points) VALUES (?, 0)',
          [userId]
        )
      }

      console.log(`✅ Invitado convertido a cuenta real: ${normalizedEmail} (user_id: ${userId})`)

    } else {
      const [result] = await pool.execute(
        `INSERT INTO users (rut, email, password_hash, first_name, last_name, phone, role, is_active, email_verified, is_guest) 
         VALUES (?, ?, ?, ?, ?, ?, 'customer', 1, 1, 0)`,
        [cleanRutValue, normalizedEmail, passwordHash, firstName, lastName, phone || null]
      ) as any

      userId = result.insertId

      await pool.execute(
        'INSERT INTO customers (user_id, loyalty_points) VALUES (?, 0)',
        [userId]
      )

      console.log(`✅ Nuevo usuario creado: ${normalizedEmail} (user_id: ${userId})`)
    }

    const [users] = await pool.execute(
      `SELECT id, rut, email, first_name, last_name, phone, role, created_at, updated_at, is_guest 
       FROM users WHERE id = ?`,
      [userId]
    ) as any[]

    const user = users[0]

    return NextResponse.json({
      success: true,
      wasGuest: isConvertingGuest, 
      user: {
        id: user.id.toString(),
        rut: user.rut,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone || '',
        role: user.role,
        isGuest: Boolean(user.is_guest),
        createdAt: user.created_at,
        updatedAt: user.updated_at
      },
      message: isConvertingGuest 
        ? 'Cuenta activada exitosamente. Tus compras anteriores se han conservado.' 
        : 'Cuenta creada exitosamente'
    })

  } catch (error) {
    console.error('Error en registro:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}