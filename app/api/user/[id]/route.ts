// app/api/user/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserIdFromRequest } from '@/lib/auth-utils'
import bcrypt from 'bcryptjs'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const userId = parseInt(id)

    if (isNaN(userId)) {
      return NextResponse.json(
        { error: 'ID de usuario inválido' },
        { status: 400 }
      )
    }

    // Verificar autenticación
    const currentUserId = await getUserIdFromRequest(request)
    
    if (!currentUserId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    // Verificar que el usuario está actualizando su propia cuenta
    if (currentUserId !== userId) {
      return NextResponse.json(
        { error: 'No tienes permiso para realizar esta acción' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { currentPassword, newPassword, confirmPassword } = body

    console.log(' Cambiando contraseña para usuario')

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

    // Obtener el usuario actual
    const users = await query(
      `SELECT id, password_hash FROM users WHERE id = ?`,
      [userId]
    ) as any[]

    if (users.length === 0) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    const user = users[0]

    // Verificar la contraseña actual
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash)
    
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'La contraseña actual es incorrecta' },
        { status: 400 }
      )
    }

    // Hashear la nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 12)

    // Actualizar la contraseña
    await query(
      `UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [hashedPassword, userId]
    )

    console.log(` Contraseña actualizada `)

    return NextResponse.json({
      success: true,
      message: 'Contraseña actualizada exitosamente'
    })

  } catch (error: any) {
    console.error(' Error cambiando contraseña:', error)
    return NextResponse.json(
      { error: error.message || 'Error al cambiar la contraseña' },
      { status: 500 }
    )
  }
}