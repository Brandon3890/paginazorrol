import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

const createTransporter = () => {
  // Si no hay configuración SMTP, usar un transporter de desarrollo
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
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
    console.error(' No se puede enviar email: customerEmail es undefined');
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

  //  Verificar que shippingAddress existe y tiene datos
  console.log(' shippingAddress en email:', shippingAddress);

  //  Construir dirección de envío correctamente
  const direccionCompleta = shippingAddress?.street 
    ? `${shippingAddress.street}${shippingAddress.department ? `, Depto: ${shippingAddress.department}` : ''}`
    : 'No especificada';
  
  const comunaRegion = shippingAddress?.commune_name 
    ? `${shippingAddress.commune_name}${shippingAddress.region_name ? `, ${shippingAddress.region_name}` : ''}`
    : '';

  const direccionMostrada = comunaRegion 
    ? `${direccionCompleta}<br>${comunaRegion}`
    : direccionCompleta;

  const emailTemplate = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Boleta Electrónica</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="padding:20px 0;background:#f3f4f6;">
<tr>
<td align="center">

<!-- CONTENEDOR -->
<table width="700" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;">

<!-- HEADER -->
<tr>
<td style="background:#cf741f;padding:30px;border-radius:8px 8px 0 0;">
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
     <strong>Boleta Electrónica N° ${folio}</strong>
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
  <table width="100%" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">
    <tr>
      <td style="padding:20px;">
        <h3 style="margin:0 0 15px 0;font-size:16px;color:#374151;">Información del Pedido</h3>

        <p style="font-size:12px;color:#6b7280;margin:0;">NÚMERO DE ORDEN</p>
        <p style="margin:5px 0 15px 0;font-weight:bold;color:#111827;">${orderNumber}</p>

        <p style="font-size:12px;color:#6b7280;margin:0;">FECHA</p>
        <p style="margin:5px 0 15px 0;color:#111827;">${orderDate}</p>

        <p style="font-size:12px;color:#6b7280;margin:0;">ESTADO</p>
        <p style="margin:5px 0;color:#059669;font-weight:bold;">✓ Pagado y Boleta Emitida</p>
      </td>
    </tr>
  </table>
</td>

<td width="50%" valign="top" style="padding-left:10px;">
  <table width="100%" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">
    <tr>
      <td style="padding:20px;">
        <h3 style="margin:0 0 15px 0;font-size:16px;color:#374151;">Información de Pago</h3>

        <p style="font-size:12px;color:#6b7280;margin:0;">MÉTODO DE PAGO</p>
        <p style="margin:5px 0 15px 0;color:#111827;">${paymentMethod}</p>

        <p style="font-size:12px;color:#6b7280;margin:0;">TOTAL PAGADO</p>
        <p style="margin:5px 0;font-size:20px;font-weight:bold;color:#059669;">
          ${formatPrice(total)}
        </p>
        <p style="margin:5px 0 0 0;font-size:11px;color:#6b7280;">
           Precio incluye IVA
        </p>
      </td>
    </tr>
  </table>
</td>
</tr>
</table>

<br>

<!-- DATOS CLIENTE -->
<table width="100%" style="background:#dbeafe;border:1px solid #93c5fd;border-radius:8px;">
<tr>
<td style="padding:20px;">
  <h3 style="margin:0 0 20px 0;color:#1e40af;font-size:16px;">Datos del Cliente</h3>

  <table width="100%">
    <tr>
      <td width="50%" valign="top">
        <p style="font-size:12px;color:#6b7280;margin:0;">NOMBRE</p>
        <p style="margin:5px 0 15px 0;color:#111827;">${customerName}</p>

        <p style="font-size:12px;color:#6b7280;margin:0;">EMAIL</p>
        <p style="margin:5px 0 15px 0;color:#111827;">${customerEmail}</p>
      </td>

      <td width="50%" valign="top">
        <p style="font-size:12px;color:#6b7280;margin:0;">TELÉFONO</p>
        <p style="margin:5px 0 15px 0;color:#111827;">${customerPhone || 'No especificado'}</p>

        <p style="font-size:12px;color:#6b7280;margin:0;">DIRECCIÓN DE ENVÍO</p>
        <p style="margin:5px 0;color:#111827;">
          ${direccionMostrada}
        </p>
        ${shippingAddress?.postal_code ? `<p style="margin:5px 0 0 0;font-size:12px;color:#6b7280;">Código Postal: ${shippingAddress.postal_code}</p>` : ''}
        ${shippingAddress?.instructions ? `<p style="margin:5px 0 0 0;font-size:12px;color:#6b7280;">Instrucciones: ${shippingAddress.instructions}</p>` : ''}
      </td>
    </tr>
  </table>
</td>
</tr>
</table>

<br>

<!-- PRODUCTOS -->
<h3 style="margin:20px 0 15px 0;color:#111827;font-size:16px;">Detalle de Productos</h3>

<table width="100%" cellpadding="10" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
<tr style="background:#cf741f;color:#ffffff;font-size:13px;">
  <th align="left" style="padding:12px 15px;">Producto</th>
  <th align="center" style="padding:12px 15px;">Cant.</th>
  <th align="center" style="padding:12px 15px;">Precio Unitario</th>
  <th align="center" style="padding:12px 15px;">Subtotal</th>
</tr>

${items.map((item: any) => {
  const itemTotalConIVA = item.product_price * item.quantity;
  return `
<tr style="border-top:1px solid #e5e7eb;font-size:14px;">
  <td style="padding:12px 15px;color:#111827;">${item.product_name}</td>
  <td align="center" style="padding:12px 15px;color:#111827;">${item.quantity}</td>
  <td align="center" style="padding:12px 15px;color:#111827;">${formatPrice(item.product_price)}</td>
  <td align="center" style="padding:12px 15px;color:#111827;">${formatPrice(itemTotalConIVA)}</td>
</tr>
`;
}).join('')}

</table>

<br>

<!-- TOTALES -->
<table width="100%" style="border:1px solid #e5e7eb;background:#f9fafb;border-radius:8px;">
<tr>
<td style="padding:20px;">

<h4 style="margin:0 0 15px 0;color:#374151;font-size:15px;">Resumen de tu compra</h4>

<table width="100%">
  ${discount > 0 ? `
  <tr>
    <td style="padding:4px 0;color:#6b7280;font-size:14px;">Subtotal (con IVA incluido):</td>
    <td align="right" style="padding:4px 0;color:#111827;font-size:14px;">${formatPrice(subtotal)}</td>
  </tr>
  <tr>
    <td style="padding:4px 0;color:#059669;font-size:14px;">Descuento aplicado:</td>
    <td align="right" style="padding:4px 0;color:#059669;font-size:14px;">-${formatPrice(discount)}</td>
  </tr>
  <tr>
    <td style="padding:4px 0;color:#374151;font-size:15px;font-weight:bold;">Subtotal con descuento:</td>
    <td align="right" style="padding:4px 0;color:#111827;font-size:15px;font-weight:bold;">${formatPrice(subtotal - discount)}</td>
  </tr>
  ` : `
  <tr>
    <td style="padding:4px 0;color:#374151;font-size:15px;font-weight:bold;">Subtotal:</td>
    <td align="right" style="padding:4px 0;color:#111827;font-size:15px;font-weight:bold;">${formatPrice(subtotal)}</td>
  </tr>
  `}
  
  <tr style="border-top:1px dashed #e5e7eb;">
    <td colspan="2" style="padding-top:10px;">
      <details style="font-size:13px;color:#6b7280;">
        <summary style="cursor:pointer;margin-bottom:5px;">
          Ver desglose de IVA (precios incluyen IVA)
        </summary>
        <div style="margin-top:10px;padding:10px;background:#f3f4f6;border-radius:6px;">
          <table width="100%" style="font-size:12px;">
            <tr>
              <td style="padding:3px 0;color:#6b7280;">Neto (sin IVA):</td>
              <td align="right" style="padding:3px 0;color:#111827;">${formatPrice(discount > 0 ? totalAfterDiscountNeto : subtotalNeto)}</td>
            </tr>
            <tr>
              <td style="padding:3px 0;color:#6b7280;">IVA (19%):</td>
              <td align="right" style="padding:3px 0;color:#111827;">${formatPrice(discount > 0 ? totalAfterDiscountIVA : subtotalIVA)}</td>
            </tr>
            <tr style="font-weight:bold;">
              <td style="padding:3px 0;color:#374151;">Total con IVA:</td>
              <td align="right" style="padding:3px 0;color:#111827;">${formatPrice(discount > 0 ? subtotal - discount : subtotal)}</td>
            </tr>
          </table>
        </div>
      </details>
    </td>
  </tr>
  
  <tr>
    <td style="padding:4px 0;color:#6b7280;font-size:14px;">Costo de envío:</td>
    <td align="right" style="padding:4px 0;color:#111827;font-size:14px;">${shipping === 0 ? 'Gratis' : formatPrice(shipping)}</td>
  </tr>
  
  <tr>
    <td colspan="2"><hr style="border:none;border-top:2px solid #d1d5db;margin:10px 0;"></td>
  </tr>
  
  <tr style="font-size:20px;font-weight:bold;">
    <td style="padding:4px 0;color:#111827;">TOTAL A PAGAR:</td>
    <td align="right" style="padding:4px 0;color:#cf741f;">${formatPrice(total)}</td>
  </tr>
</table>

</td>
</tr>
</table>

<br>

<!-- BOTÓN -->
<table width="100%">
<tr>
<td align="center" style="padding:15px 0;">
<a href="${process.env.NEXTAUTH_URL}/orders"
style="background:#cf741f;color:#ffffff;text-decoration:none;
padding:14px 35px;display:inline-block;font-weight:bold;border-radius:8px;font-size:15px;">
Ver Mis Pedidos
</a>
</td>
</tr>
</table>

<!-- SOPORTE -->
<table width="100%" style="background:#f0f9ff;border:1px solid #7dd3fc;border-radius:8px;">
<tr>
<td align="center" style="padding:20px;font-size:14px;color:#0369a1;">
<strong>¿Tienes preguntas sobre tu pedido?</strong><br>
Contáctanos en ${process.env.APIGATEWAY_CORREO || 'jinfranko@zorroludico.cl'}
</td>
</tr>
</table>

</td>
</tr>

<!-- FOOTER -->
<tr>
<td style="background:#f9fafb;padding:20px;text-align:center;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb;border-radius:0 0 8px 8px;">
  Este es un mensaje automático, por favor no responder a este correo.
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
    console.log(' Email con boleta enviado a:', customerEmail, 'ID:', info.messageId);
    return true;

  } catch (error) {
    console.error(' Error enviando email con boleta:', error);
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
<td align="center" style="background:#cf741f;padding:30px;">
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
style="background:#cf741f;color:#ffffff;
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
<strong>jinfranko@zorroludico.cl</strong>
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
      from: process.env.SMTP_FROM || '"Zorro Lúdico" <jinfranko@zorroludico.cl>',
      to: email,
      subject: `Código de verificación - Zorro Lúdico`,
      html: emailTemplate,
    };

    const info = await transporter.sendMail(mailOptions);
    return true;

  } catch (error) {

    if (process.env.NODE_ENV === 'development') {
      return true;
    }

    return false;
  }
}

// Exportar el transporter por si se necesita usar directamente
export { transporter };


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
    return false;
  }

  // Correo destino
  const destEmail = "jinfranko@zorroludico.cl";

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
      font-family: Arial, sans-serif;
    }
    .container {
      max-width: 700px;
      margin: 0 auto;
      background-color: #ffffff;
      border: 1px solid #e5e7eb;
    }
    .header {
      background: #111827;
      padding: 30px;
    }
    .header h1 {
      margin: 0;
      color: #ffffff;
      font-size: 24px;
    }
    .header .subtitle {
      margin: 5px 0 0 0;
      color: #d1d5db;
      font-size: 14px;
    }
    .header .meta {
      margin: 5px 0 0 0;
      color: #d1d5db;
      font-size: 12px;
      text-align: right;
    }
    .content {
      padding: 30px;
    }
    .greeting {
      font-size: 22px;
      font-weight: bold;
      color: #111827;
      margin: 0 0 15px 0;
    }
    .description {
      color: #374151;
      font-size: 14px;
      margin: 0 0 30px 0;
    }
    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: #111827;
      margin: 0 0 15px 0;
      padding-bottom: 8px;
      border-bottom: 2px solid #e5e7eb;
    }
    .info-table {
      width: 100%;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-collapse: collapse;
      margin-bottom: 25px;
    }
    .info-table td {
      padding: 12px 20px;
      font-size: 14px;
      border-bottom: 1px solid #e5e7eb;
    }
    .info-table tr:last-child td {
      border-bottom: none;
    }
    .info-table .label {
      color: #6b7280;
      font-weight: 500;
      width: 35%;
    }
    .info-table .value {
      color: #111827;
      font-weight: 500;
    }
    .info-table .value a {
      color: #111827;
      text-decoration: none;
    }
    .info-table .value a:hover {
      text-decoration: underline;
    }
    .message-box {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      padding: 20px;
      margin-bottom: 25px;
    }
    .message-text {
      font-size: 15px;
      line-height: 1.7;
      color: #374151;
      margin: 0;
      white-space: pre-wrap;
    }
    .divider {
      border: none;
      border-top: 1px solid #e5e7eb;
      margin: 30px 0;
    }
    .btn-container {
      text-align: center;
      padding: 10px 0;
    }
    .btn {
      display: inline-block;
      background: #111827;
      color: #ffffff;
      padding: 14px 40px;
      text-decoration: none;
      font-weight: 600;
      font-size: 15px;
      border-radius: 4px;
    }
    .btn:hover {
      background: #1f2937;
    }
    .footer {
      background: #f9fafb;
      padding: 20px 30px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    .footer p {
      margin: 0;
      font-size: 12px;
      color: #9ca3af;
    }
    .footer a {
      color: #111827;
      text-decoration: none;
    }
    .status-badge {
      display: inline-block;
      background: #dcfce7;
      color: #166534;
      font-size: 12px;
      font-weight: 600;
      padding: 4px 12px;
      border-radius: 4px;
      margin-bottom: 20px;
    }
    @media (max-width: 480px) {
      .header {
        padding: 20px;
      }
      .header h1 {
        font-size: 20px;
      }
      .content {
        padding: 20px;
      }
      .info-table td {
        padding: 10px 15px;
        font-size: 13px;
      }
      .info-table .label {
        width: 40%;
      }
    }
  </style>
</head>
<body>

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:20px 0;">
<tr>
<td align="center">

<table width="700" cellpadding="0" cellspacing="0" class="container" style="background:#ffffff;border:1px solid #e5e7eb;">

<!-- HEADER -->
<tr>
<td class="header" style="background:#cf741f;padding:30px;">
  <table width="100%">
    <tr>
      <td align="left">
        <h1 style="margin:0;color:#ffffff;font-size:24px;">Zorro Ludico</h1>
        <p class="subtitle" style="margin:5px 0 0 0;color:#d1d5db;font-size:14px;">Nuevo mensaje de contacto</p>
      </td>
      <td align="right" class="meta" style="margin:5px 0 0 0;color:#d1d5db;font-size:12px;">
        ${formatDate()}
      </td>
    </tr>
  </table>
</td>
</tr>

<!-- CONTENIDO -->
<tr>
<td class="content" style="padding:30px;">


<p class="greeting" style="font-size:22px;font-weight:bold;color:#111827;margin:0 0 15px 0;">
  Has recibido un nuevo mensaje
</p>

<p class="description" style="color:#374151;font-size:14px;margin:0 0 30px 0;">
  Un cliente ha enviado un mensaje a traves del formulario de contacto.
</p>

<!-- INFORMACION DEL CLIENTE -->
<h2 class="section-title" style="font-size:16px;font-weight:600;color:#111827;margin:0 0 15px 0;padding-bottom:8px;border-bottom:2px solid #e5e7eb;">
  Datos del Cliente
</h2>

<table class="info-table" style="width:100%;background:#f9fafb;border:1px solid #e5e7eb;border-collapse:collapse;margin-bottom:25px;">
  <tr>
    <td class="label" style="padding:12px 20px;font-size:14px;color:#6b7280;font-weight:500;width:35%;border-bottom:1px solid #e5e7eb;">Nombre completo</td>
    <td class="value" style="padding:12px 20px;font-size:14px;color:#111827;font-weight:500;border-bottom:1px solid #e5e7eb;">${escapeHtml(name)}</td>
  </tr>
  <tr>
    <td class="label" style="padding:12px 20px;font-size:14px;color:#6b7280;font-weight:500;width:35%;border-bottom:1px solid #e5e7eb;">Correo electronico</td>
    <td class="value" style="padding:12px 20px;font-size:14px;color:#111827;font-weight:500;border-bottom:1px solid #e5e7eb;">
      <a href="mailto:${escapeHtml(email)}" style="color:#111827;text-decoration:none;">${escapeHtml(email)}</a>
    </td>
  </tr>
  <tr>
    <td class="label" style="padding:12px 20px;font-size:14px;color:#6b7280;font-weight:500;width:35%;border-bottom:1px solid #e5e7eb;">Telefono</td>
    <td class="value" style="padding:12px 20px;font-size:14px;color:#111827;font-weight:500;border-bottom:1px solid #e5e7eb;">
      ${phone ? `<a href="tel:${escapeHtml(phone)}" style="color:#111827;text-decoration:none;">${escapeHtml(phone)}</a>` : 'No especificado'}
    </td>
  </tr>
  <tr>
    <td class="label" style="padding:12px 20px;font-size:14px;color:#6b7280;font-weight:500;width:35%;border-bottom:none;">Asunto</td>
    <td class="value" style="padding:12px 20px;font-size:14px;color:#111827;font-weight:500;border-bottom:none;">${escapeHtml(subject)}</td>
  </tr>
</table>

<!-- MENSAJE -->
<h2 class="section-title" style="font-size:16px;font-weight:600;color:#111827;margin:0 0 15px 0;padding-bottom:8px;border-bottom:2px solid #e5e7eb;">
  Mensaje del Cliente
</h2>

<div class="message-box" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px;padding:20px;margin-bottom:25px;">
  <p class="message-text" style="font-size:15px;line-height:1.7;color:#374151;margin:0;white-space:pre-wrap;">
    ${escapeHtml(message)}
  </p>
</div>

<hr class="divider" style="border:none;border-top:1px solid #e5e7eb;margin:30px 0;">

<!-- BOTON RESPONDER -->
<div class="btn-container" style="text-align:center;padding:10px 0;">
  <p style="font-size:14px;color:#6b7280;margin:0 0 15px 0;">
    Responde al cliente para brindar una atencion rapida
  </p>
  <a href="mailto:${escapeHtml(email)}?subject=Respuesta: ${escapeHtml(subject)}" class="btn" style="display:inline-block;background:#cf741f;color:#ffffff;padding:14px 40px;text-decoration:none;font-weight:600;font-size:15px;border-radius:4px;">
    Responder al Cliente
  </a>
</div>

</td>
</tr>

<!-- FOOTER -->
<tr>
<td class="footer" style="background:#f9fafb;padding:20px 30px;text-align:center;border-top:1px solid #e5e7eb;">
  <p style="margin:0;font-size:12px;color:#9ca3af;">
    Zorro Ludico
  </p>
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
      from: process.env.SMTP_FROM || '"Zorro Ludico" <jinfranko@zorroludico.cl>',
      to: destEmail,
      replyTo: email,
      subject: `Nuevo mensaje de contacto: ${subject}`,
      html: emailTemplate,
    };

    const info = await transporter.sendMail(mailOptions);
    return true;

  } catch (error) {
    console.error('Error enviando email de contacto:', error);
    
    if (process.env.NODE_ENV === 'development') {
      return true;
    }
    
    return false;
  }
}


export async function sendProductOnSaleEmail(
  productName: string,
  productPrice: number,
  productOriginalPrice: number,
  productImage: string | Buffer, 
  productId: number,
  usersEmails: string[],
  discountPercent: number
) {
  if (!usersEmails || usersEmails.length === 0) {
    console.log('No hay usuarios para notificar sobre la oferta');
    return true;
  }

  console.log('Enviando notificaciones de oferta a', usersEmails.length, 'usuarios');

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  // Función para obtener la imagen 
  const getImageData = async (imagePath: string): Promise<{ buffer: Buffer | null; mimeType: string }> => {
    try {
      if (Buffer.isBuffer(imagePath)) {
        return { buffer: imagePath, mimeType: 'image/png' };
      }

      if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        const response = await fetch(imagePath);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        const contentType = response.headers.get('content-type') || 'image/png';
        return { buffer, mimeType: contentType };
      }

      if (imagePath.startsWith('/uploads/') || imagePath.startsWith('uploads/')) {
        const fs = await import('fs');
        const path = await import('path');
        
        const basePath = process.cwd();
        let fullPath = '';
        
        if (imagePath.startsWith('/uploads/')) {
          fullPath = path.join(basePath, 'public', imagePath);
        } else if (imagePath.startsWith('uploads/')) {
          fullPath = path.join(basePath, 'public', imagePath);
        } else {
          fullPath = path.join(basePath, 'public', 'uploads', 'products', imagePath);
        }

        if (fs.existsSync(fullPath)) {
          const fileBuffer = fs.readFileSync(fullPath);
          const ext = path.extname(fullPath).toLowerCase();
          const mimeType = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp'
          }[ext] || 'image/png';
          
          return { buffer: fileBuffer, mimeType };
        }
      }

      console.warn(`Imagen no encontrada para ${productName}, usando imagen por defecto`);
      const defaultImagePath = path.join(process.cwd(), 'public', 'diverse-products-still-life.png');
      const fs = await import('fs');
      if (fs.existsSync(defaultImagePath)) {
        const buffer = fs.readFileSync(defaultImagePath);
        return { buffer, mimeType: 'image/png' };
      }

      return { buffer: null, mimeType: 'image/png' };
    } catch (error) {
      console.error('Error obteniendo imagen:', error);
      return { buffer: null, mimeType: 'image/png' };
    }
  };

  const calculateRealDiscount = (originalPrice: number, salePrice: number) => {
    if (originalPrice <= 0 || salePrice >= originalPrice) return 0;
    const discount = ((originalPrice - salePrice) / originalPrice) * 100;
    return Math.round(discount);
  };

  const realDiscountPercent = calculateRealDiscount(productOriginalPrice, productPrice);
  const finalDiscountPercent = realDiscountPercent > 0 ? realDiscountPercent : discountPercent;

  const productUrl = `${process.env.NEXTAUTH_URL}/products/${productId}`;

  let imageBuffer: Buffer | null = null;
  let imageMimeType = 'image/png';
  let imageDataUrl = '';

  if (productImage) {
    try {
      const result = await getImageData(productImage as string);
      if (result.buffer) {
        imageBuffer = result.buffer;
        imageMimeType = result.mimeType;
        imageDataUrl = `data:${imageMimeType};base64,${imageBuffer.toString('base64')}`;
      } else {
        imageDataUrl = `${process.env.NEXTAUTH_URL}/diverse-products-still-life.png`;
      }
    } catch (error) {
      imageDataUrl = `${process.env.NEXTAUTH_URL}/diverse-products-still-life.png`;
    }
  } else {
    imageDataUrl = `${process.env.NEXTAUTH_URL}/diverse-products-still-life.png`;
  }

  const attachments = [];
  if (imageBuffer) {
    attachments.push({
      filename: 'product-image.jpg',
      content: imageBuffer,
      cid: 'productImage', 
      contentType: imageMimeType
    });
  }

  const emailTemplate = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Oferta en tu producto favorito</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f3f4f6;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #f3f4f6;
      padding: 20px 0;
    }
    
    .main {
      background: #ffffff;
      max-width: 600px;
      margin: 0 auto;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    
    .header {
      background: #111827;
      padding: 30px 40px;
    }
    
    .header h1 {
      margin: 0;
      color: #ffffff;
      font-size: 24px;
      font-weight: 700;
    }
    
    .header p {
      margin: 5px 0 0 0;
      color: #d1d5db;
      font-size: 14px;
    }
    
    .header .date {
      color: #d1d5db;
      font-size: 13px;
      margin: 5px 0 0 0;
      text-align: right;
    }
    
    .content {
      padding: 40px 40px 30px;
    }
    
    .greeting {
      font-size: 24px;
      font-weight: 700;
      color: #111827;
      margin: 0 0 12px 0;
    }
    
    .description {
      color: #374151;
      font-size: 15px;
      line-height: 1.6;
      margin: 0 0 25px 0;
    }
    
    .offer-box {
      background: #fef2f2;
      border-left: 4px solid #C2410C;
      border-radius: 4px;
      padding: 16px 20px;
      margin: 0 0 25px 0;
    }
    
    .offer-box p {
      margin: 0;
      font-size: 15px;
      color: #374151;
      line-height: 1.6;
    }
    
    .offer-box strong {
      color: #C2410C;
    }
    
    .product-card {
      background: #f9fafb;
      border: 2px solid #e5e7eb;
      border-radius: 12px;
      padding: 16px 20px;
      margin: 0 0 25px 0;
      display: table;
      width: 100%;
      box-sizing: border-box;
    }
    
    .product-row {
      display: table-row;
    }
    
    .product-cell {
      display: table-cell;
      vertical-align: middle;
      padding: 0 8px;
    }
    
    .product-image-cell {
      width: 80px;
      padding-right: 16px;
      min-width: 80px;
    }
    
    .product-image-container {
      width: 80px;
      height: 80px;
      border-radius: 8px;
      overflow: hidden;
      background-color: #e5e7eb;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .product-image {
      width: 80px;
      height: 80px;
      border-radius: 8px;
      object-fit: cover;
      display: block;
    }
    
    .product-name-cell {
      white-space: nowrap;
      padding-right: 16px;
      width: auto;
    }
    
    .product-name {
      font-size: 15px;
      font-weight: 600;
      color: #111827;
      margin: 0;
      white-space: nowrap;
      display: inline-block;
    }
    
    .prices-cell {
      text-align: right;
      white-space: nowrap;
      padding-left: 16px;
      width: auto;
    }
    
    .prices-container {
      display: inline-block;
      white-space: nowrap;
    }
    
    .price-item {
      display: inline-block;
      margin: 0 6px;
      vertical-align: middle;
    }
    
    .current-price {
      font-size: 20px;
      font-weight: 700;
      color: #C2410C;
    }
    
    .original-price {
      font-size: 15px;
      color: #9ca3af;
      text-decoration: line-through;
    }
    
    .discount-badge {
      display: inline-block;
      background: #dcfce7;
      color: #166534;
      font-size: 12px;
      font-weight: 600;
      padding: 2px 10px;
      border-radius: 20px;
      white-space: nowrap;
    }
    
    .price-separator {
      display: inline-block;
      margin: 0 4px;
      color: #9ca3af;
      font-size: 14px;
    }
    
    .btn-container {
      text-align: center;
      margin: 0 0 25px 0;
    }
    
    .btn-primary {
      display: inline-block;
      background: #C2410C;
      color: #ffffff;
      padding: 14px 40px;
      text-decoration: none;
      font-weight: 600;
      font-size: 16px;
      border-radius: 8px;
      text-align: center;
    }
    
    .btn-primary:hover {
      background: #9A3412;
    }
    
    .details-table {
      width: 100%;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-collapse: collapse;
      margin: 0 0 30px 0;
    }
    
    .details-table td {
      padding: 12px 20px;
      font-size: 14px;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .details-table tr:last-child td {
      border-bottom: none;
    }
    
    .details-table .label {
      color: #6b7280;
      font-weight: 400;
    }
    
    .details-table .value {
      color: #111827;
      font-weight: 500;
      text-align: right;
    }
    
    .details-table .value-sale {
      color: #C2410C;
      font-weight: 700;
      text-align: right;
    }
    
    .hr-divider {
      border: none;
      border-top: 1px solid #e5e7eb;
      margin: 25px 0;
    }
    
    .footer {
      background: #f9fafb;
      padding: 20px 40px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    
    .footer p {
      margin: 0;
      font-size: 12px;
      color: #9ca3af;
    }
    
    @media (max-width: 500px) {
      .header {
        padding: 20px;
      }
      
      .header h1 {
        font-size: 20px;
      }
      
      .content {
        padding: 25px 20px;
      }
      
      .product-card {
        padding: 12px 16px;
      }
      
      .product-image-cell {
        width: 60px;
        min-width: 60px;
        padding-right: 12px;
      }
      
      .product-image-container {
        width: 60px;
        height: 60px;
      }
      
      .product-image {
        width: 60px;
        height: 60px;
      }
      
      .product-name {
        font-size: 13px;
      }
      
      .current-price {
        font-size: 17px;
      }
      
      .original-price {
        font-size: 13px;
      }
      
      .discount-badge {
        font-size: 11px;
        padding: 2px 8px;
      }
      
      .price-item {
        margin: 0 4px;
      }
      
      .price-separator {
        margin: 0 2px;
        font-size: 12px;
      }
      
      .details-table td {
        padding: 10px 14px;
        font-size: 13px;
      }
      
      .btn-primary {
        display: block;
        padding: 16px 20px;
      }
      
      .footer {
        padding: 15px 20px;
      }
    }
    
    @media (max-width: 400px) {
      .product-name-cell {
        max-width: 70px;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      .product-name {
        max-width: 70px;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
  </style>
</head>
<body>

<table width="100%" cellpadding="0" cellspacing="0" class="wrapper">
  <tr>
    <td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" class="main" style="background:#ffffff;max-width:600px;border-radius:8px;overflow:hidden;">
        
        <tr>
          <td class="header" style="background:#cf741f;padding:30px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="left">
                  <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Zorro Lúdico</h1>
                  <p style="margin:5px 0 0 0;color:#d1d5db;font-size:14px;">Tu producto favorito está en oferta</p>
                </td>
                <td align="right" style="color:#d1d5db;font-size:13px;white-space:nowrap;">
                  ${new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' })}
                </td>
              </tr>
            </table>
          </td>
        </tr>
        
        <tr>
          <td class="content" style="padding:40px 40px 30px;">
            
            <p class="greeting" style="font-size:24px;font-weight:700;color:#111827;margin:0 0 12px 0;">
              ¡Buenas noticias!
            </p>
            
            <p class="description" style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 25px 0;">
              El producto que marcaste como favorito ha bajado de precio. No dejes pasar esta oportunidad.
            </p>
            
            <div class="offer-box" style="background:#fef2f2;border-left:4px solid #C2410C;border-radius:4px;padding:16px 20px;margin:0 0 25px 0;">
              <p style="margin:0;font-size:15px;color:#374151;line-height:1.6;">
                Oferta especial: <strong style="color:#C2410C;">${finalDiscountPercent}%</strong> de descuento en este producto.
              </p>
            </div>
            
            <div class="product-card" style="background:#f9fafb;border:2px solid #e5e7eb;border-radius:12px;padding:16px 20px;margin:0 0 25px 0;display:table;width:100%;box-sizing:border-box;">
              <div class="product-row" style="display:table-row;">
                
                <div class="product-cell product-image-cell" style="display:table-cell;vertical-align:middle;padding:0 8px;width:80px;padding-right:16px;min-width:80px;">
                  <div class="product-image-container" style="width:80px;height:80px;border-radius:8px;overflow:hidden;background-color:#e5e7eb;display:flex;align-items:center;justify-content:center;">
                    <img src="${imageBuffer ? 'cid:productImage' : imageDataUrl}" 
                         alt="${productName}" 
                         class="product-image" 
                         style="width:80px;height:80px;border-radius:8px;object-fit:cover;display:block;"
                         onerror="this.src='${process.env.NEXTAUTH_URL}/diverse-products-still-life.png'">
                  </div>
                </div>
                
                <div class="product-cell product-name-cell" style="display:table-cell;vertical-align:middle;padding:0 8px;white-space:nowrap;padding-right:16px;width:auto;">
                  <span class="product-name" style="font-size:15px;font-weight:600;color:#111827;margin:0;white-space:nowrap;display:inline-block;">
                    ${productName}
                  </span>
                </div>
                
                <div class="product-cell prices-cell" style="display:table-cell;vertical-align:middle;padding:0 8px;text-align:right;white-space:nowrap;padding-left:16px;width:auto;">
                  <div class="prices-container" style="display:inline-block;white-space:nowrap;">
                    
                    <span class="price-item current-price" style="display:inline-block;margin:0 6px;vertical-align:middle;font-size:20px;font-weight:700;color:#C2410C;">
                      ${formatPrice(productPrice)}
                    </span>
                    
                    <span class="price-separator" style="display:inline-block;margin:0 4px;color:#9ca3af;font-size:14px;">|</span>
                    
                    <span class="price-item original-price" style="display:inline-block;margin:0 6px;vertical-align:middle;font-size:15px;color:#9ca3af;text-decoration:line-through;">
                      ${formatPrice(productOriginalPrice)}
                    </span>
                    
                    <span class="price-separator" style="display:inline-block;margin:0 4px;color:#9ca3af;font-size:14px;">|</span>
                    
                    <span class="price-item discount-badge" style="display:inline-block;margin:0 6px;vertical-align:middle;background:#dcfce7;color:#166534;font-size:12px;font-weight:600;padding:2px 10px;border-radius:20px;white-space:nowrap;">
                      -${finalDiscountPercent}%
                    </span>
                    
                  </div>
                </div>
                
              </div>
            </div>
            
            <div class="btn-container" style="text-align:center;margin:0 0 25px 0;">
              <a href="${productUrl}" class="btn-primary" style="display:inline-block;background:#C2410C;color:#ffffff;padding:14px 40px;text-decoration:none;font-weight:600;font-size:16px;border-radius:8px;text-align:center;">
                Ver Producto
              </a>
            </div>
            
            <hr class="hr-divider" style="border:none;border-top:1px solid #e5e7eb;margin:25px 0;">
            
            <table class="details-table" style="width:100%;background:#f9fafb;border:1px solid #e5e7eb;border-collapse:collapse;margin:0 0 30px 0;">
              <tr>
                <td class="label" style="padding:12px 20px;font-size:14px;color:#6b7280;font-weight:400;border-bottom:1px solid #e5e7eb;">Producto</td>
                <td class="value" style="padding:12px 20px;font-size:14px;color:#111827;font-weight:500;text-align:right;border-bottom:1px solid #e5e7eb;">${productName}</td>
              </tr>
              <tr>
                <td class="label" style="padding:12px 20px;font-size:14px;color:#6b7280;font-weight:400;border-bottom:1px solid #e5e7eb;">Precio original</td>
                <td class="value" style="padding:12px 20px;font-size:14px;color:#111827;font-weight:500;text-align:right;border-bottom:1px solid #e5e7eb;">${formatPrice(productOriginalPrice)}</td>
              </tr>
              <tr>
                <td class="label" style="padding:12px 20px;font-size:14px;color:#6b7280;font-weight:400;border-bottom:1px solid #e5e7eb;">Precio de oferta</td>
                <td class="value-sale" style="padding:12px 20px;font-size:14px;color:#C2410C;font-weight:700;text-align:right;border-bottom:1px solid #e5e7eb;">${formatPrice(productPrice)}</td>
              </tr>
              <tr>
                <td class="label" style="padding:12px 20px;font-size:14px;color:#6b7280;font-weight:400;border-bottom:none;">Descuento</td>
                <td class="value" style="padding:12px 20px;font-size:14px;color:#111827;font-weight:500;text-align:right;border-bottom:none;">${finalDiscountPercent}%</td>
              </tr>
            </table>
            
          </td>
        </tr>
        
        <tr>
          <td class="footer" style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              Zorro Lúdico &bull; Tu tienda de confianza
            </p>
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
      from: process.env.SMTP_FROM || '"Zorro Lúdico" <jinfranko@zorroludico.cl>',
      bcc: usersEmails.join(','),
      subject: `¡Oferta! ${productName} - ${finalDiscountPercent}% de descuento`,
      html: emailTemplate,
      attachments: attachments 
    };

    const info = await transporter.sendMail(mailOptions);
    return true;

  } catch (error) {
    
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