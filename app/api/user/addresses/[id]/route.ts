import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { query } from '@/lib/db'
import { getUserIdFromRequest } from '@/lib/auth-utils'

// GET - Obtener perfil del usuario
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserIdFromRequest(request)
    
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Verificar que el ID de la URL coincide con el usuario autenticado
    if (parseInt(params.id) !== userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Obtener datos del usuario
    const users = await query(
      `SELECT id, email, first_name, last_name, phone, role, created_at, updated_at 
       FROM users WHERE id = ?`,
      [userId]
    ) as any[]

    if (users.length === 0) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const user = users[0]

    return NextResponse.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone || '',
      role: user.role,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    })
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json(
      { error: 'Error al obtener el perfil' },
      { status: 500 }
    )
  }
}

// PUT - Actualizar datos del perfil
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserIdFromRequest(request)
    
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Verificar que el ID de la URL coincide con el usuario autenticado
    if (parseInt(params.id) !== userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { firstName, lastName, email, phone } = body

    // Validaciones básicas
    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        { error: 'Nombre, apellido y email son requeridos' },
        { status: 400 }
      )
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Email inválido' },
        { status: 400 }
      )
    }

    // Verificar si el email ya está en uso por otro usuario
    const existingUsers = await query(
      `SELECT id FROM users WHERE email = ? AND id != ?`,
      [email, userId]
    ) as any[]

    if (existingUsers.length > 0) {
      return NextResponse.json(
        { error: 'El email ya está en uso por otro usuario' },
        { status: 409 }
      )
    }

    // Actualizar datos del usuario
    await query(
      `UPDATE users SET 
        first_name = ?, 
        last_name = ?, 
        email = ?, 
        phone = ?,
        updated_at = NOW()
      WHERE id = ?`,
      [firstName, lastName, email, phone || null, userId]
    )

    // Obtener los datos actualizados
    const updatedUsers = await query(
      `SELECT id, email, first_name, last_name, phone, role, created_at, updated_at 
       FROM users WHERE id = ?`,
      [userId]
    ) as any[]

    const user = updatedUsers[0]

    return NextResponse.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone || '',
      role: user.role,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      message: 'Perfil actualizado exitosamente'
    })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Error al actualizar el perfil' },
      { status: 500 }
    )
  }
}

// PATCH - Cambiar contraseña
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserIdFromRequest(request)
    
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Verificar que el ID de la URL coincide con el usuario autenticado
    if (parseInt(params.id) !== userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { currentPassword, newPassword, confirmPassword } = body

    // Validaciones
    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: 'Todos los campos son requeridos' },
        { status: 400 }
      )
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: 'Las contraseñas nuevas no coinciden' },
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      )
    }

    // Obtener la contraseña actual
    const users = await query(
      'SELECT password_hash FROM users WHERE id = ?',
      [userId]
    ) as any[]

    if (users.length === 0) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    // Verificar contraseña actual
    const isValidPassword = await bcrypt.compare(currentPassword, users[0].password_hash)
    
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'La contraseña actual es incorrecta' },
        { status: 400 }
      )
    }

    // Hashear y actualizar nueva contraseña
    const newPasswordHash = await bcrypt.hash(newPassword, 10)
    
    await query(
      'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?',
      [newPasswordHash, userId]
    )

    return NextResponse.json({
      success: true,
      message: 'Contraseña actualizada exitosamente'
    })
  } catch (error) {
    console.error('Error changing password:', error)
    return NextResponse.json(
      { error: 'Error al cambiar la contraseña' },
      { status: 500 }
    )
  }
}