import nodemailer from 'nodemailer';

// Configuración básica del transporter para desarrollo
const createTransporter = () => {
  // Si no hay configuración SMTP, usar un transporter de desarrollo
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.log(' Usando transporter de desarrollo (sin envío real)');
    return nodemailer.createTransport({
      streamTransport: true,
      newline: 'unix',
      buffer: true
    });
  }

  // Configuración para producción
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

const transporter = createTransporter();

// FUNCIÓN: Enviar boleta electrónica por correo con PDF adjunto
export async function sendBoletaEmail(orderData: any, pdfBuffer: Buffer, folio: string) {
  const {
    orderNumber,
    customerName,
    customerEmail,
    customerPhone,
    orderDate,
    paymentMethod = "Transbank Webpay",
    items = [],
    subtotal,        
    discount = 0,
    shipping,
    tax,             
    total,
    shippingAddress,
    storeInfo = {
      name: "Zorro Lúdico",
      rut: "78181331-1",
      giro: "Desarrollo de software",
      direccion: "Calle 7 numero 3",
      comuna: "Santiago",
      ciudad: "Santiago"
    }
  } = orderData;

  if (!customerEmail) {
    console.error('❌ No se puede enviar email: customerEmail es undefined');
    return false;
  }

  // Calcular el neto (sin IVA) para mostrar en el desglose
  const calculateNeto = (precioConIVA: number): number => {
    return Math.round(precioConIVA / 1.19);
  };

  const calculateIVAFromTotal = (precioConIVA: number): number => {
    return precioConIVA - calculateNeto(precioConIVA);
  };

  const subtotalNeto = calculateNeto(subtotal);
  const subtotalIVA = calculateIVAFromTotal(subtotal);
  
  // Si el descuento aplicó, también hay que desglosarlo
  const discountNeto = discount > 0 ? calculateNeto(discount) : 0;
  const totalAfterDiscountNeto = calculateNeto(subtotal - discount);
  const totalAfterDiscountIVA = calculateIVAFromTotal(subtotal - discount);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  const emailTemplate = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="padding:20px 0;background:#f3f4f6;">
<tr>
<td align="center">

<!-- CONTENEDOR -->
<table width="700" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e7eb;">

<!-- HEADER -->
<tr>
<td style="background:#111827;padding:30px;">
  <table width="100%">
    <tr>
      <td align="left">
        <h1 style="margin:0;color:#ffffff;font-size:24px;">${storeInfo.name}</h1>
        <p style="margin:5px 0 0 0;color:#d1d5db;font-size:14px;">Boleta Electrónica</p>
        <p style="margin:5px 0 0 0;color:#d1d5db;font-size:12px;">RUT: ${storeInfo.rut}</p>
      </td>
      <td align="right">
        <p style="margin:0;color:#ffffff;font-weight:bold;font-size:14px;">BOLETA ELECTRÓNICA</p>
        <p style="margin:5px 0 0 0;color:#d1d5db;font-size:13px;">N° ${folio}</p>
        <p style="margin:5px 0 0 0;color:#d1d5db;font-size:12px;">Orden: ${orderNumber}</p>
      </td>
    </tr>
  </table>
</td>
</tr>

<!-- CONTENIDO -->
<tr>
<td style="padding:30px;">

<h2 style="margin:0 0 15px 0;color:#111827;">
¡Gracias por tu compra, ${customerName}!
</h2>

<p style="margin:0 0 10px 0;color:#374151;font-size:14px;">
Tu boleta electrónica N° <strong>${folio}</strong> ha sido emitida correctamente.
</p>

<p style="margin:0 0 30px 0;color:#374151;font-size:14px;">
Adjunto encontrarás el PDF de tu boleta para que puedas descargarlo y guardarlo.
</p>

<div style="background:#dbeafe;border:1px solid #93c5fd;border-radius:8px;padding:15px;text-align:center;margin:20px 0;">
  <p style="margin:0;font-size:14px;color:#1e40af;">
    📄 <strong>Boleta Electrónica N° ${folio}</strong>
  </p>
  <p style="margin:5px 0 0 0;font-size:12px;color:#1e40af;">
    El PDF de tu boleta está adjunto a este correo
  </p>
</div>

<hr style="border:none;border-top:1px solid #e5e7eb;margin:30px 0;">

<!-- INFORMACIÓN ORDEN -->
<table width="100%" cellpadding="0" cellspacing="0">
<tr>
<td width="50%" valign="top" style="padding-right:10px;">
  <table width="100%" style="background:#f9fafb;border:1px solid #e5e7eb;">
    <tr>
      <td style="padding:20px;">
        <h3 style="margin:0 0 15px 0;">Información del Pedido</h3>

        <p style="font-size:12px;color:#6b7280;margin:0;">NÚMERO DE ORDEN</p>
        <p style="margin:5px 0 15px 0;font-weight:bold;">${orderNumber}</p>

        <p style="font-size:12px;color:#6b7280;margin:0;">FECHA</p>
        <p style="margin:5px 0 15px 0;">${orderDate}</p>

        <p style="font-size:12px;color:#6b7280;margin:0;">ESTADO</p>
        <p style="margin:5px 0;color:#059669;font-weight:bold;">✓ Pagado y Boleta Emitida</p>
      </td>
    </tr>
  </table>
</td>

<td width="50%" valign="top" style="padding-left:10px;">
  <table width="100%" style="background:#f9fafb;border:1px solid #e5e7eb;">
    <tr>
      <td style="padding:20px;">
        <h3 style="margin:0 0 15px 0;">Información de Pago</h3>

        <p style="font-size:12px;color:#6b7280;margin:0;">MÉTODO DE PAGO</p>
        <p style="margin:5px 0 15px 0;">${paymentMethod}</p>

        <p style="font-size:12px;color:#6b7280;margin:0;">TOTAL PAGADO</p>
        <p style="margin:5px 0;font-size:18px;font-weight:bold;color:#059669;">
          ${formatPrice(total)}
        </p>
        <p style="margin:5px 0 0 0;font-size:11px;color:#6b7280;">
          💰 Precio incluye IVA
        </p>
      </td>
    </tr>
  </table>
</td>
</tr>
</table>

<br>

<!-- DATOS CLIENTE -->
<table width="100%" style="background:#dbeafe;border:1px solid #93c5fd;">
<tr>
<td style="padding:20px;">
  <h3 style="margin:0 0 20px 0;color:#1e40af;">Datos del Cliente</h3>

  <table width="100%">
    <tr>
      <td width="50%" valign="top">
        <p style="font-size:12px;color:#6b7280;margin:0;">NOMBRE</p>
        <p style="margin:5px 0 15px 0;">${customerName}</p>

        <p style="font-size:12px;color:#6b7280;margin:0;">EMAIL</p>
        <p style="margin:5px 0;">${customerEmail}</p>
      </td>

      <td width="50%" valign="top">
        <p style="font-size:12px;color:#6b7280;margin:0;">TELÉFONO</p>
        <p style="margin:5px 0 15px 0;">${customerPhone || 'No especificado'}</p>

        <p style="font-size:12px;color:#6b7280;margin:0;">DIRECCIÓN</p>
        <p style="margin:5px 0;">
          ${shippingAddress?.street || 'No especificada'}<br>
          ${shippingAddress?.commune_name || ''} ${shippingAddress?.region_name ? `, ${shippingAddress.region_name}` : ''}
        </p>
      </td>
    </tr>
  </table>
</td>
</tr>
</table>

<br>

<!-- PRODUCTOS -->
<h3 style="margin:20px 0;color:#111827;">Detalle de Productos</h3>

<table width="100%" cellpadding="10" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;">
<tr style="background:#111827;color:#ffffff;font-size:13px;">
  <th align="left">Producto</th>
  <th align="center">Cant.</th>
  <th align="center">Precio Unitario</th>
  <th align="center">Subtotal</th>
</tr>

${items.map((item: any) => {
  const itemTotalConIVA = item.product_price * item.quantity;
  return `
<tr style="border-top:1px solid #e5e7eb;font-size:14px;">
  <td>${item.product_name}</td>
  <td align="center">${item.quantity}</td>
  <td align="center">${formatPrice(item.product_price)}</td>
  <td align="center">${formatPrice(itemTotalConIVA)}</td>
</tr>
`;
}).join('')}

</table>

<br>

<!-- TOTALES CON DESGLOSE CORRECTO -->
<table width="100%" style="border:1px solid #e5e7eb;background:#f9fafb;">
<tr>
<td style="padding:20px;">

<h4 style="margin:0 0 15px 0;color:#374151;">Resumen de tu compra</h4>

<table width="100%">
  ${discount > 0 ? `
  <tr>
    <td>Subtotal (con IVA incluido):</td>
    <td align="right">${formatPrice(subtotal)}</td>
  </tr>
  <tr>
    <td style="color:#059669;">Descuento aplicado:</td>
    <td align="right" style="color:#059669;">-${formatPrice(discount)}</td>
  </tr>
  <tr>
    <td><strong>Subtotal con descuento:</strong></td>
    <td align="right"><strong>${formatPrice(subtotal - discount)}</strong></td>
  </tr>
  ` : `
  <tr>
    <td><strong>Subtotal:</strong></td>
    <td align="right"><strong>${formatPrice(subtotal)}</strong></td>
  </tr>
  `}
  
  <!-- Desglose del IVA incluido (transparencia) -->
  <tr style="border-top:1px dashed #e5e7eb;">
    <td colspan="2" style="padding-top:10px;">
      <details style="font-size:13px;color:#6b7280;">
        <summary style="cursor:pointer;margin-bottom:5px;">
          Ver desglose de IVA (precios incluyen IVA)
        </summary>
        <div style="margin-top:10px;padding:10px;background:#f3f4f6;border-radius:6px;">
          <table width="100%" style="font-size:12px;">
            <tr>
              <td>Neto (sin IVA):</td>
              <td align="right">${formatPrice(discount > 0 ? totalAfterDiscountNeto : subtotalNeto)}</td>
            </tr>
            <tr>
              <td>IVA (19%):</td>
              <td align="right">${formatPrice(discount > 0 ? totalAfterDiscountIVA : subtotalIVA)}</td>
            </tr>
            <tr style="font-weight:bold;">
              <td>Total con IVA:</td>
              <td align="right">${formatPrice(discount > 0 ? subtotal - discount : subtotal)}</td>
            </tr>
          </table>
        </div>
      </details>
    </td>
  </tr>
  
  <tr>
    <td>Costo de envío:</td>
    <td align="right">${shipping === 0 ? 'Gratis' : formatPrice(shipping)}</td>
  </tr>
  
  <tr>
    <td colspan="2"><hr style="border:none;border-top:1px solid #d1d5db;margin:10px 0;"></td>
  </tr>
  
  <tr style="font-size:18px;font-weight:bold;">
    <td>TOTAL A PAGAR:</td>
    <td align="right">${formatPrice(total)}</td>
  </tr>
  
  <tr>
  </tr>
</table>

</td>
</tr>
</table>

<br>

<!-- BOTÓN -->
<table width="100%">
<tr>
<td align="center" style="padding:20px 0;">
<a href="${process.env.NEXTAUTH_URL}/orders"
style="background:#111827;color:#ffffff;text-decoration:none;
padding:14px 30px;display:inline-block;font-weight:bold;border-radius:8px;">
Ver Mis Pedidos
</a>
</td>
</tr>
</table>

<!-- SOPORTE -->
<table width="100%" style="background:#f0f9ff;border:1px solid #7dd3fc;">
<tr>
<td align="center" style="padding:20px;font-size:14px;color:#0369a1;">
<strong>¿Tienes preguntas sobre tu pedido?</strong><br>
Contáctanos en soporte@ludicagames.com
</td>
</tr>
</table>

</td>
</tr>

<!-- FOOTER -->
<tr>
</tr>

</table>

</td>
</tr>
</table>

</body>
</html>
`;

  try {
    const mailOptions = {
      from: process.env.SMTP_FROM || '"Zorro Lúdico" <noreply@ludicagames.com>',
      to: customerEmail,
      subject: `Boleta Electrónica N° ${folio} - Pedido ${orderNumber}`,
      html: emailTemplate,
      attachments: [
        {
          filename: `boleta_${folio}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
          encoding: 'base64'
        }
      ]
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email con boleta enviado a:', customerEmail, 'ID:', info.messageId);
    return true;

  } catch (error) {
    console.error('❌ Error enviando email con boleta:', error);
    return false;
  }
}

// Función para recuperación de contraseña
export async function sendPasswordResetEmail(email: string, verificationCode: string) {
  const encodedEmail = encodeURIComponent(email);
  const verifyUrl = `${process.env.NEXTAUTH_URL}/verify-code?email=${encodedEmail}`;

  const emailTemplate = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:20px 0;">
<tr>
<td align="center">

<!-- CONTENEDOR -->
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e7eb;">

<!-- HEADER -->
<tr>
<td align="center" style="background:#111827;padding:30px;">
  <h1 style="margin:0;color:#ffffff;font-size:24px;">Zorro Lúdico</h1>
  <p style="margin:8px 0 0 0;color:#d1d5db;font-size:14px;">Recuperación de Contraseña</p>
</td>
</tr>

<!-- CONTENIDO -->
<tr>
<td style="padding:30px;">

<p style="font-size:14px;color:#374151;margin:0 0 25px 0;text-align:center;">
Hemos recibido una solicitud para restablecer tu contraseña.
Para continuar utiliza el siguiente código de verificación:
</p>

<!-- CÓDIGO -->
<table width="100%" cellpadding="0" cellspacing="0">
<tr>
<td align="center">

<p style="font-size:12px;color:#6b7280;margin:0 0 10px 0;text-transform:uppercase;">
Código de verificación
</p>

<table cellpadding="0" cellspacing="0" style="border:2px solid #d1d5db;background:#f9fafb;">
<tr>
<td style="padding:20px 35px;font-size:36px;font-weight:bold;
font-family:monospace;letter-spacing:4px;color:#111827;">
${verificationCode}
</td>
</tr>
</table>

<p style="font-size:12px;color:#6b7280;margin:10px 0 0 0;">
Este código expira en 30 minutos
</p>

</td>
</tr>
</table>

<br>

<!-- INSTRUCCIONES -->
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;">
<tr>
<td style="padding:20px;">
  <h3 style="margin:0 0 15px 0;color:#111827;text-align:center;">Instrucciones:</h3>

  <p style="margin:0 0 8px 0;font-size:14px;color:#374151;">
  1. Copia el código mostrado arriba
  </p>
  <p style="margin:0 0 8px 0;font-size:14px;color:#374151;">
  2. Haz clic en el botón "Ingresar Código"
  </p>
  <p style="margin:0 0 8px 0;font-size:14px;color:#374151;">
  3. Ingresa el código en la página
  </p>
  <p style="margin:0;font-size:14px;color:#374151;">
  4. Crea tu nueva contraseña
  </p>
</td>
</tr>
</table>

<br>

<!-- BOTÓN PRINCIPAL -->
<table width="100%" cellpadding="0" cellspacing="0">
<tr>
<td align="center" style="padding:15px 0;">

<a href="${verifyUrl}"
style="background:#111827;color:#ffffff;
text-decoration:none;
padding:14px 40px;
font-weight:bold;
display:inline-block;
font-size:16px;
border-radius:8px;">
Ingresar Código
</a>

</td>
</tr>
</table>

<!-- URL ALTERNATIVA -->
<table width="100%">
<tr>
<td align="center" style="padding:10px 0;">
  <p style="font-size:13px;color:#6b7280;margin:0 0 8px 0;">
  O copia y pega esta URL:
  </p>

  <div style="font-size:12px;font-family:monospace;
  background:#f3f4f6;padding:10px;
  display:inline-block;word-break:break-all;">
  ${verifyUrl}
  </div>
</td>
</tr>
</table>

<br>

<!-- ADVERTENCIA -->
<table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border:1px solid #fecaca;">
<tr>
<td style="padding:20px;">
  <p style="margin:0 0 10px 0;color:#991b1b;font-weight:bold;">
   Importante - Seguridad
  </p>

  <p style="margin:0 0 10px 0;font-size:14px;color:#7f1d1d;">
  Si no solicitaste este cambio, ignora este correo o contáctanos inmediatamente.
  </p>

  <p style="margin:0;font-size:14px;color:#7f1d1d;">
  Nunca compartas este código con terceros.
  </p>
</td>
</tr>
</table>

<br>

<!-- SOPORTE -->
<table width="100%">
<tr>
<td align="center" style="font-size:14px;color:#6b7280;padding:10px 0;">
¿Necesitas ayuda? Contáctanos en 
<strong>soporte@ludicagames.com</strong>
</td>
</tr>
</table>

</td>
</tr>

<!-- FOOTER -->
<tr>
</tr>

</table>

</td>
</tr>
</table>

</body>
</html>
`;

  try {
    const mailOptions = {
      from: process.env.SMTP_FROM || '"Zorro Lúdico" <noreply@ludicagames.com>',
      to: email,
      subject: `Código de verificación - Zorro Lúdico`,
      html: emailTemplate,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email de recuperación enviado:', info.messageId);
    return true;

  } catch (error) {
    console.error('❌ Error enviando email:', error);

    if (process.env.NODE_ENV === 'development') {
      console.log('[DEV] Simulación de envío');
      return true;
    }

    return false;
  }
}

// Exportar el transporter por si se necesita usar directamente
export { transporter };


// lib/email-service.ts - AGREGAR ESTA FUNCIÓN AL FINAL DEL ARCHIVO

// Función para enviar correo de contacto
export async function sendContactEmail(formData: {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}) {
  const { name, email, phone, subject, message } = formData;

  if (!email) {
    console.error('❌ No se puede enviar email: email es undefined');
    return false;
  }

  // Correo destino (puedes cambiarlo por el que necesites)
  const destEmail = "carocabrandon6@gmail.com";

  const formatDate = () => {
    return new Date().toLocaleString('es-CL', {
      dateStyle: 'full',
      timeStyle: 'short'
    });
  };

  const emailTemplate = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nuevo mensaje de contacto</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f3f4f6;
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    .header {
      background: linear-gradient(135deg, #C2410C 0%, #EA580C 100%);
      padding: 32px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      color: #ffffff;
      font-size: 24px;
      font-weight: 600;
      letter-spacing: -0.5px;
    }
    .header p {
      margin: 8px 0 0 0;
      color: #fef3c7;
      font-size: 14px;
    }
    .content {
      padding: 32px;
    }
    .section-title {
      font-size: 18px;
      font-weight: 600;
      color: #1f2937;
      margin: 0 0 16px 0;
      padding-bottom: 8px;
      border-bottom: 2px solid #f3f4f6;
    }
    .info-card {
      background-color: #f9fafb;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
    }
    .info-row {
      margin-bottom: 16px;
    }
    .info-row:last-child {
      margin-bottom: 0;
    }
    .info-label {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #6b7280;
      margin-bottom: 4px;
    }
    .info-value {
      font-size: 16px;
      font-weight: 500;
      color: #1f2937;
      word-break: break-word;
    }
    .info-value a {
      color: #C2410C;
      text-decoration: none;
    }
    .info-value a:hover {
      text-decoration: underline;
    }
    .message-card {
      background-color: #fffbeb;
      border-left: 4px solid #C2410C;
      border-radius: 12px;
      padding: 20px;
      margin-top: 8px;
    }
    .message-text {
      font-size: 15px;
      line-height: 1.6;
      color: #374151;
      margin: 0;
      white-space: pre-wrap;
    }
    .footer {
      background-color: #f9fafb;
      padding: 24px 32px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    .footer p {
      margin: 0;
      font-size: 12px;
      color: #9ca3af;
    }
    .footer a {
      color: #C2410C;
      text-decoration: none;
    }
    .badge {
      display: inline-block;
      background-color: #dcfce7;
      color: #166534;
      font-size: 12px;
      font-weight: 500;
      padding: 4px 12px;
      border-radius: 20px;
      margin-bottom: 16px;
    }
    hr {
      border: none;
      border-top: 1px solid #e5e7eb;
      margin: 24px 0;
    }
  </style>
</head>
<body style="margin: 0; padding: 20px; background-color: #f3f4f6;">

<table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 20px 0;">
  <tr>
    <td align="center">
      <div class="container" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">

        <!-- HEADER -->
        <div class="header" style="background: linear-gradient(135deg, #C2410C 0%, #EA580C 100%); padding: 32px; text-align: center;">
          <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Zorro Lúdico</h1>
          <p style="margin: 8px 0 0 0; color: #fef3c7; font-size: 14px;">Nuevo mensaje de contacto</p>
        </div>

        <!-- CONTENIDO -->
        <div class="content" style="padding: 32px;">

          <div style="text-align: center; margin-bottom: 24px;">
            <span class="badge" style="display: inline-block; background-color: #dcfce7; color: #166534; font-size: 12px; font-weight: 500; padding: 4px 12px; border-radius: 20px;">
              Recibido el ${formatDate()}
            </span>
          </div>

          <!-- INFORMACIÓN DEL CLIENTE -->
          <h2 class="section-title" style="font-size: 18px; font-weight: 600; color: #1f2937; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 2px solid #f3f4f6;">
            👤 Información del Cliente
          </h2>

          <div class="info-card" style="background-color: #f9fafb; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <div class="info-row" style="margin-bottom: 16px;">
              <div class="info-label" style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #6b7280; margin-bottom: 4px;">NOMBRE COMPLETO</div>
              <div class="info-value" style="font-size: 16px; font-weight: 500; color: #1f2937;">${escapeHtml(name)}</div>
            </div>

            <div class="info-row" style="margin-bottom: 16px;">
              <div class="info-label" style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #6b7280; margin-bottom: 4px;">CORREO ELECTRÓNICO</div>
              <div class="info-value" style="font-size: 16px; font-weight: 500; color: #1f2937;">
                <a href="mailto:${escapeHtml(email)}" style="color: #C2410C; text-decoration: none;">${escapeHtml(email)}</a>
              </div>
            </div>

            <div class="info-row" style="margin-bottom: 16px;">
              <div class="info-label" style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #6b7280; margin-bottom: 4px;">TELÉFONO</div>
              <div class="info-value" style="font-size: 16px; font-weight: 500; color: #1f2937;">
                ${phone ? `<a href="tel:${escapeHtml(phone)}" style="color: #C2410C; text-decoration: none;">${escapeHtml(phone)}</a>` : 'No especificado'}
              </div>
            </div>

            <div class="info-row" style="margin-bottom: 0;">
              <div class="info-label" style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #6b7280; margin-bottom: 4px;">ASUNTO</div>
              <div class="info-value" style="font-size: 16px; font-weight: 500; color: #1f2937;">${escapeHtml(subject)}</div>
            </div>
          </div>

          <!-- MENSAJE -->
          <h2 class="section-title" style="font-size: 18px; font-weight: 600; color: #1f2937; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 2px solid #f3f4f6;">
            Mensaje
          </h2>

          <div class="message-card" style="background-color: #fffbeb; border-left: 4px solid #C2410C; border-radius: 12px; padding: 20px;">
            <p class="message-text" style="font-size: 15px; line-height: 1.6; color: #374151; margin: 0; white-space: pre-wrap;">
              ${escapeHtml(message)}
            </p>
          </div>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

          <!-- CALL TO ACTION -->
          <div style="text-align: center;">
            <p style="font-size: 14px; color: #6b7280; margin: 0 0 16px 0;">
              Responde rápidamente para brindar la mejor atención
            </p>
            <div style="display: inline-block; background-color: #C2410C; border-radius: 8px; padding: 10px 24px;">
              <a href="mailto:${escapeHtml(email)}" style="color: #ffffff; text-decoration: none; font-weight: 500; font-size: 14px;">
                Responder al Cliente
              </a>
            </div>
          </div>

        </div>

      </div>
    </td>
  </tr>
</table>

</body>
</html>
  `;

  try {
    const mailOptions = {
      from: process.env.SMTP_FROM || '"Zorro Lúdico - Contacto" <contacto@zorroludico.cl>',
      to: destEmail,
      replyTo: email,
      subject: `Nuevo mensaje de contacto: ${subject}`,
      html: emailTemplate,
    };

    const info = await transporter.sendMail(mailOptions);
    return true;

  } catch (error) {
    console.error('❌ Error enviando email de contacto:', error);
    
    // En desarrollo, simular envío
    if (process.env.NODE_ENV === 'development') {
      return true;
    }
    
    return false;
  }
}

// Función auxiliar para escapar HTML
function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}