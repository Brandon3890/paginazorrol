// app/api/auth/register/route.ts - ACTUALIZADO CON RUT
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import pool from '@/lib/db'
import { validateRutInput, cleanRut } from '@/lib/rut-utils'

export async function POST(request: NextRequest) {
  try {
    const { email, password, firstName, lastName, phone, rut } = await request.json()

    // Validaciones básicas
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

    // Validar RUT
    const rutValidation = validateRutInput(rut)
    if (!rutValidation.isValid) {
      return NextResponse.json(
        { success: false, error: rutValidation.message },
        { status: 400 }
      )
    }

    const cleanRutValue = cleanRut(rut)

    // Verificar si el usuario ya existe por email
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    ) as any[]

    if (existingUsers.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Ya existe una cuenta con este email' },
        { status: 409 }
      )
    }

    // Verificar si el RUT ya existe
    const [existingRuts] = await pool.execute(
      'SELECT id FROM users WHERE rut = ?',
      [cleanRutValue]
    ) as any[]

    if (existingRuts.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Ya existe una cuenta con este RUT' },
        { status: 409 }
      )
    }

    // Hash de la contraseña
    const passwordHash = await bcrypt.hash(password, 10)

    // Insertar nuevo usuario con RUT
    const [result] = await pool.execute(
      `INSERT INTO users (rut, email, password_hash, first_name, last_name, phone, role, is_active, email_verified) 
       VALUES (?, ?, ?, ?, ?, ?, 'customer', 1, 1)`,
      [cleanRutValue, email, passwordHash, firstName, lastName, phone || null]
    ) as any

    // Crear entrada en la tabla customers
    await pool.execute(
      'INSERT INTO customers (user_id, loyalty_points) VALUES (?, 0)',
      [result.insertId]
    )

    // Obtener el usuario creado
    const [users] = await pool.execute(
      `SELECT id, rut, email, first_name, last_name, phone, role, created_at, updated_at 
       FROM users WHERE id = ?`,
      [result.insertId]
    ) as any[]

    const user = users[0]

    return NextResponse.json({
      success: true,
      user: {
        id: user.id.toString(),
        rut: user.rut,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone || '',
        role: user.role,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      },
      message: 'Cuenta creada exitosamente'
    })

  } catch (error) {
    console.error('Error en registro:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}