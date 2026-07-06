// app/api/auth/register/route.ts - VERSIÓN ACTUALIZADA
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import pool from '@/lib/db'

// Función para generar un RUT único basado en el ID del usuario
function generateUniqueRut(userId: number): string {
  // Usamos el ID del usuario para generar un RUT único
  // Ejemplo: 66666666-6 + userId
  const baseRut = '66666666'
  const digit = '6'
  return `${baseRut}${userId}-${digit}`
}

export async function POST(request: NextRequest) {
  try {
    const { email, password, firstName, lastName, phone } = await request.json()

    // Validaciones básicas
    if (!email || !password || !firstName || !lastName) {
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

    // Hash de la contraseña
    const passwordHash = await bcrypt.hash(password, 10)

    // 🔥 Insertar sin RUT (el RUT puede ser NULL)
    const [result] = await pool.execute(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone, role, is_active, email_verified) 
       VALUES (?, ?, ?, ?, ?, 'customer', 1, 1)`,
      [email, passwordHash, firstName, lastName, phone || null]
    ) as any

    const userId = result.insertId

    // 🔥 Generar RUT único basado en el ID del usuario
    const uniqueRut = generateUniqueRut(userId)
    console.log(`🔑 RUT generado para usuario ${userId}: ${uniqueRut}`)

    // Actualizar el usuario con el RUT generado
    await pool.execute(
      'UPDATE users SET rut = ? WHERE id = ?',
      [uniqueRut, userId]
    )

    // Crear entrada en la tabla customers
    await pool.execute(
      'INSERT INTO customers (user_id, loyalty_points) VALUES (?, 0)',
      [userId]
    )

    // Obtener el usuario creado
    const [users] = await pool.execute(
      `SELECT id, rut, email, first_name, last_name, phone, role, created_at, updated_at 
       FROM users WHERE id = ?`,
      [userId]
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