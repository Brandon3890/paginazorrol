import { NextRequest, NextResponse } from 'next/server';
import { query, queryRows } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { token, email, password } = await request.json();

    if (!token || !email || !password) {
      return NextResponse.json(
        { error: 'Token, email y contraseña son requeridos' },
        { status: 400 }
      );
    }

    // Verificar que el token sea válido
    const tokens = await queryRows(
      `SELECT * FROM password_reset_tokens 
       WHERE token = ? 
       AND user_id = (SELECT id FROM users WHERE email = ?) 
       AND used = 0 
       AND expires_at > NOW()`,
      [token, email]
    );

    if (tokens.length === 0) {
      return NextResponse.json(
        { error: 'Token inválido o expirado' },
        { status: 400 }
      );
    }

    const resetToken = tokens[0];

    // Hashear nueva contraseña
    const hashedPassword = await bcrypt.hash(password, 12);

    // Actualizar contraseña del usuario
    await query(
      `UPDATE users SET password_hash = ? WHERE id = ?`,
      [hashedPassword, resetToken.user_id]
    );

    // Marcar token como usado
    await query(
      `UPDATE password_reset_tokens SET used = 1 WHERE id = ?`,
      [resetToken.id]
    );

    // Eliminar otros tokens no utilizados para este usuario
    await query(
      `DELETE FROM password_reset_tokens 
       WHERE user_id = ? AND used = 0 AND id != ?`,
      [resetToken.user_id, resetToken.id]
    );

    return NextResponse.json({
      success: true,
      message: 'Contraseña actualizada exitosamente'
    });

  } catch (error) {
    console.error('Error resetting password:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}