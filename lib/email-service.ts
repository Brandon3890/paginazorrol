import nodemailer from 'nodemailer';

// Configuración básica del transporter para desarrollo
const createTransporter = () => {
  // Si no hay configuración SMTP, usar un transporter de desarrollo
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.log('📧 Usando transporter de desarrollo (sin envío real)');
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

export async function sendOrderConfirmationEmail(orderData: any) {
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
      name: "Ludica Games"
    }
  } = orderData;

  if (!customerEmail) {
    console.error('❌ No se puede enviar email: customerEmail es undefined');
    return false;
  }

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
        <p style="margin:5px 0 0 0;color:#d1d5db;font-size:14px;">Confirmación de Orden</p>
      </td>
      <td align="right">
        <p style="margin:0;color:#ffffff;font-weight:bold;font-size:14px;">BOLETA ELECTRÓNICA</p>
        <p style="margin:5px 0 0 0;color:#d1d5db;font-size:13px;">N° ${orderNumber}</p>
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

<p style="margin:0 0 30px 0;color:#374151;font-size:14px;">
Tu pedido ha sido confirmado y procesado exitosamente.
A continuación encontrarás todos los detalles de tu compra.
</p>

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
        <p style="margin:5px 0;color:#059669;font-weight:bold;">✓ Confirmado y Pagado</p>
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
          ${shippingAddress.street}<br>
          ${shippingAddress.commune_name}, ${shippingAddress.region_name}
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
  <th align="center">Precio</th>
  <th align="center">Subtotal</th>
  <th align="right">IVA</th>
</tr>

${items.map((item: any) => `
<tr style="border-top:1px solid #e5e7eb;font-size:14px;">
  <td>${item.product_name}</td>
  <td align="center">${item.quantity}</td>
  <td align="center">${formatPrice(item.product_price)}</td>
  <td align="center">${formatPrice(item.product_price * item.quantity)}</td>
  <td align="right">${formatPrice(Math.round(item.product_price * item.quantity * 0.19))}</td>
</tr>
`).join('')}

</table>

<br>

<!-- TOTALES -->
<table width="100%" style="border:1px solid #e5e7eb;background:#f9fafb;">
<tr>
<td style="padding:20px;">

<table width="100%">
<tr>
<td>Subtotal (sin IVA):</td>
<td align="right">${formatPrice(subtotal)}</td>
</tr>

${discount > 0 ? `
<tr>
<td style="color:#059669;">Descuento:</td>
<td align="right" style="color:#059669;">-${formatPrice(discount)}</td>
</tr>` : ''}

<tr>
<td>IVA (19%):</td>
<td align="right">${formatPrice(tax)}</td>
</tr>

<tr>
<td>Costo de envío:</td>
<td align="right">${shipping === 0 ? 'Gratis' : formatPrice(shipping)}</td>
</tr>

<tr>
<td colspan="2"><hr style="border:none;border-top:1px solid #d1d5db;margin:10px 0;"></td>
</tr>

<tr style="font-size:18px;font-weight:bold;">
<td>TOTAL:</td>
<td align="right">${formatPrice(total)}</td>
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
padding:14px 30px;display:inline-block;font-weight:bold;">
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
<td align="center" style="padding:20px;background:#f9fafb;font-size:12px;color:#6b7280;">
© 2026. Todos los derechos reservados.
</td>
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
      from: process.env.SMTP_FROM || '"Ludica Games" <noreply@ludicagames.com>',
      to: customerEmail,
      subject: `Boleta Electrónica - Orden ${orderNumber} - ${formatPrice(total)}`,
      html: emailTemplate,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email enviado:', info.messageId);
    return true;

  } catch (error) {
    console.error('❌ Error enviando email:', error);

    if (process.env.NODE_ENV === 'development') {
      console.log('📧 [DEV] Simulación de envío');
      return true;
    }

    return false;
  }
}

// Función para recuperación de contraseña (CON BOTONES MEJOR ESPACIADOS)
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
  <h1 style="margin:0;color:#ffffff;font-size:24px;">Ludica Games</h1>
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
font-size:16px;">
🔐 Ingresar Código
</a>

</td>
</tr>
</table>

<!-- BOTÓN SECUNDARIO -->
<table width="100%" cellpadding="0" cellspacing="0">
<tr>
<td align="center" style="padding:10px 0 20px 0;">

<a href="${process.env.NEXTAUTH_URL}/reset-password"
style="background:#374151;color:#ffffff;
text-decoration:none;
padding:12px 36px;
font-weight:bold;
display:inline-block;
font-size:15px;">
📧 Solicitar Otro Código
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
  ⚠ Importante - Seguridad
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
<td align="center" style="background:#f9fafb;padding:20px;font-size:12px;color:#6b7280;">
© 2026. Todos los derechos reservados.
</td>
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
      from: process.env.SMTP_FROM || '"Ludica Games" <noreply@ludicagames.com>',
      to: email,
      subject: `Código de verificación - Ludica Games`,
      html: emailTemplate,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email de recuperación enviado:', info.messageId);
    return true;

  } catch (error) {
    console.error('❌ Error enviando email:', error);

    if (process.env.NODE_ENV === 'development') {
      console.log('📧 [DEV] Simulación de envío');
      return true;
    }

    return false;
  }
}

// Exportar el transporter por si se necesita usar directamente
export { transporter };