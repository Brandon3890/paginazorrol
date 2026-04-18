// app/api/contact/route.ts
import { NextResponse } from 'next/server';
import { sendContactEmail } from '@/lib/email-service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, phone, subject, message } = body;

    // Validaciones
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Correo electrónico inválido' },
        { status: 400 }
      );
    }

    // Enviar correo
    const emailSent = await sendContactEmail({
      name,
      email,
      phone: phone || '',
      subject,
      message,
    });

    if (!emailSent) {
      return NextResponse.json(
        { error: 'Error al enviar el mensaje' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Mensaje enviado correctamente'
    });

  } catch (error) {
    console.error('Error en API de contacto:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}