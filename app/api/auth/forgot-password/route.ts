import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { query, queryRows } from '@/lib/db';
import { sendPasswordResetEmail } from '@/lib/email-service';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'El email es requerido' },
        { status: 400 }
      );
    }

    // Verificar si el usuario existe
    const users = await queryRows(
      'SELECT id, email FROM users WHERE email = ? AND is_active = 1',
      [email]
    );

    if (users.length === 0) {
      // Por seguridad, no revelamos si el email existe o no
      return NextResponse.json({
        message: 'Si el email está registrado, recibirás instrucciones para restablecer tu contraseña.'
      });
    }

    const user = users[0];

    // Generar código de verificación (6 dígitos)
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Generar token único
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Calcular fecha de expiración (30 minutos)
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    // Guardar en la base de datos
    await query(
      `INSERT INTO password_reset_tokens 
       (user_id, token, verification_code, expires_at) 
       VALUES (?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE 
       token = VALUES(token), 
       verification_code = VALUES(verification_code), 
       expires_at = VALUES(expires_at),
       used = 0`,
      [user.id, resetToken, verificationCode, expiresAt]
    );

    // Enviar email
    const emailSent = await sendPasswordResetEmail(email, verificationCode);

    if (!emailSent) {
      return NextResponse.json(
        { error: 'Error al enviar el email. Inténtalo de nuevo.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Si el email está registrado, recibirás instrucciones para restablecer tu contraseña.'
    });

  } catch (error) {
    console.error('Error in forgot password:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}