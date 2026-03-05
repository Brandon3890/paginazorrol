import { NextRequest, NextResponse } from 'next/server';
import { query, queryRows } from '@/lib/db';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json(
        { error: 'Email y código son requeridos' },
        { status: 400 }
      );
    }

    if (code.length !== 6) {
      return NextResponse.json(
        { error: 'El código debe tener 6 dígitos' },
        { status: 400 }
      );
    }

    // Buscar token de recuperación válido
    const tokens = await queryRows(
      `SELECT * FROM password_reset_tokens 
       WHERE user_id = (SELECT id FROM users WHERE email = ?) 
       AND verification_code = ? 
       AND used = 0 
       AND expires_at > NOW()`,
      [email, code]
    );

    if (tokens.length === 0) {
      return NextResponse.json(
        { error: 'Código inválido, expirado o ya utilizado' },
        { status: 400 }
      );
    }

    const token = tokens[0];

    // Generar token seguro para el cambio de contraseña
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Actualizar el token con el nuevo token seguro
    await query(
      `UPDATE password_reset_tokens SET token = ? WHERE id = ?`,
      [resetToken, token.id]
    );

    return NextResponse.json({
      success: true,
      token: resetToken,
      message: 'Código verificado correctamente'
    });

  } catch (error) {
    console.error('Error verifying code:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}