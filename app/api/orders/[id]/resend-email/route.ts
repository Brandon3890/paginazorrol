// app/api/orders/[id]/resend-email/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sendBoletaEmail } from '@/lib/email-service';
import { obtenerPDFApiGateway, obtenerFechaEmisionSII } from '@/lib/apigateway-service';
import { obtenerBoletaConVerificacion } from '@/lib/boleta-helper';
import fs from 'fs';
import path from 'path';

/**
 * Formatear fecha a YYYY-MM-DD
 */
function formatearFecha(fecha: string | Date): string {
  if (!fecha) {
    return new Date().toISOString().split('T')[0];
  }
  
  if (typeof fecha === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return fecha;
    }
    if (fecha.includes(' ')) {
      return fecha.split(' ')[0];
    }
    if (fecha.includes('T')) {
      return fecha.split('T')[0];
    }
    if (fecha.includes('Z')) {
      return fecha.replace('Z', '').split('T')[0];
    }
    try {
      const parsed = new Date(fecha);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
    } catch (e) {
      return new Date().toISOString().split('T')[0];
    }
    return fecha;
  }
  
  if (fecha instanceof Date) {
    return fecha.toISOString().split('T')[0];
  }
  
  return new Date().toISOString().split('T')[0];
}

/**
 * Extraer dirección de envío desde la orden
 */
function extraerShippingAddress(order: any): {
  street: string;
  commune_name: string;
  region_name: string;
  postal_code: string;
  department: string;
  instructions: string;
} {
  const shippingType = order.shipping_type || '';
  const shippingDetails = order.shipping_details ? 
    (typeof order.shipping_details === 'string' ? JSON.parse(order.shipping_details) : order.shipping_details) : 
    null;

  if (shippingType === 'bodega_pickup' && shippingDetails?.selectedBranch) {
    const branch = shippingDetails.selectedBranch;
    return {
      street: branch.address || 'Arcangel 1200, San Miguel',
      commune_name: 'San Miguel',
      region_name: 'Región Metropolitana',
      postal_code: '8900000',
      department: '',
      instructions: 'Retiro en Bodega - Horario: Lunes a Viernes 10:00 - 18:00 hrs'
    };
  }

  if (shippingType === 'branch_pickup' && shippingDetails?.selectedBranch) {
    const branch = shippingDetails.selectedBranch;
    return {
      street: branch.address || 'Sucursal Chilexpress',
      commune_name: 'Santiago',
      region_name: 'Región Metropolitana',
      postal_code: '000000',
      department: '',
      instructions: `Retiro en Sucursal - ${branch.name}${branch.telephone ? ` - Teléfono: ${branch.telephone}` : ''}`
    };
  }

  if (order.shipping_street) {
    return {
      street: order.shipping_street || 'No especificada',
      commune_name: order.shipping_commune || 'No especificada',
      region_name: order.shipping_region || 'No especificada',
      postal_code: order.shipping_postal_code || '000000',
      department: order.shipping_department || '',
      instructions: order.shipping_instructions || ''
    };
  }

  return {
    street: 'No especificada',
    commune_name: 'No especificada',
    region_name: 'No especificada',
    postal_code: '000000',
    department: '',
    instructions: ''
  };
}

/**
 * Obtener el PDF de la boleta - PRIORIDAD: PDF Admin > ApiGateway
 * @param order - Datos de la orden
 * @param usarBoletaAntigua - Si es true, fuerza usar ApiGateway aunque exista PDF admin
 */
async function obtenerPDFBoleta(
  order: any, 
  orderId: string,
  usarBoletaAntigua: boolean = false
): Promise<{ buffer: Buffer; fuente: 'admin' | 'apigateway' } | null> {
  
  // ✅ Si se solicita explícitamente la boleta antigua, usar ApiGateway
  if (usarBoletaAntigua) {
    if (!order.boleta_folio) {
      return null;
    }

    try {
      let fechaFormateada = order.boleta_fecha 
        ? formatearFecha(order.boleta_fecha) 
        : new Date().toISOString().split('T')[0];

      const fechaSII = await obtenerFechaEmisionSII(order.boleta_folio);
      if (fechaSII) {
        fechaFormateada = fechaSII;
      }

      const pdfBuffer = await obtenerPDFApiGateway(
        order.boleta_folio,
        fechaFormateada
      );
      
      console.log(` PDF obtenido de ApiGateway (forzado) para folio`);
      return { buffer: pdfBuffer, fuente: 'apigateway' };
    } catch (error) {
      console.error(' Error obteniendo PDF de ApiGateway:', error);
      return null;
    }
  }

  // ✅ PRIORIDAD 1: Si hay PDF subido por admin, usarlo
  if (order.boleta_pdf_path) {
    try {
      let filePath = order.boleta_pdf_path;
      if (filePath.startsWith('/uploads/')) {
        filePath = path.join(process.cwd(), 'public', filePath);
      }
      
      if (fs.existsSync(filePath)) {
        const buffer = fs.readFileSync(filePath);
        console.log(` Usando PDF subido por admin`);
        return { buffer, fuente: 'admin' };
      } else {
        console.warn(` El PDF subido por admin no existe: ${filePath}, intentando con ApiGateway`);
      }
    } catch (error) {
      console.error(' Error leyendo PDF subido por admin:', error);
    }
  }

  // ✅ PRIORIDAD 2: Si no hay PDF subido o falló, usar ApiGateway
  if (!order.boleta_folio) {
    return null;
  }

  try {
    let fechaFormateada = order.boleta_fecha 
      ? formatearFecha(order.boleta_fecha) 
      : new Date().toISOString().split('T')[0];

    const fechaSII = await obtenerFechaEmisionSII(order.boleta_folio);
    if (fechaSII) {
      fechaFormateada = fechaSII;
      console.log(`Usando fecha del SII: ${fechaFormateada}`);
    }

    const pdfBuffer = await obtenerPDFApiGateway(
      order.boleta_folio,
      fechaFormateada
    );
    
    console.log(` PDF obtenido de ApiGateway para folio: ${order.boleta_folio}`);
    return { buffer: pdfBuffer, fuente: 'apigateway' };
  } catch (error) {
    console.error(' Error obteniendo PDF de ApiGateway:', error);
    return null;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orderId = id;

    //  Obtener el parámetro para forzar boleta antigua
    const url = new URL(request.url);
    const usarBoletaAntigua = url.searchParams.get('antigua') === 'true';


    // ============================================================
    // 1. OBTENER DATOS DE LA ORDEN
    // ============================================================
    const orderData = await query(
      `SELECT 
        o.*,
        u.email as customer_email,
        u.first_name as customer_first_name,
        u.last_name as customer_last_name,
        u.phone as customer_phone,
        ua.street as shipping_street,
        ua.commune_name as shipping_commune,
        ua.region_name as shipping_region,
        ua.postal_code as shipping_postal_code,
        b.folio as boleta_folio,
        b.fecha_emision as boleta_fecha,
        b.id as boleta_id,
        o.boleta_pdf_path,
        o.boleta_pdf_folio
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN user_addresses ua ON o.shipping_address_id = ua.id
      LEFT JOIN boletas b ON o.id = b.order_id
      WHERE o.id = ?`,
      [orderId]
    ) as any[];

    if (orderData.length === 0) {
      return NextResponse.json(
        { error: 'Orden no encontrada' },
        { status: 404 }
      );
    }

    const order = orderData[0];

    if (!order.customer_email) {
      return NextResponse.json(
        { error: 'No se encontró información del cliente para esta orden' },
        { status: 400 }
      );
    }

    // ============================================================
    // 2. VERIFICAR QUE EXISTA BOLETA O PDF
    // ============================================================
    const tienePDFAdmin = !!order.boleta_pdf_path;
    const tieneFolio = !!order.boleta_folio;

    if (!tienePDFAdmin && !tieneFolio) {
      return NextResponse.json(
        { error: 'Esta orden no tiene una boleta electrónica emitida ni PDF subido por admin' },
        { status: 400 }
      );
    }

    // Si se pide boleta antigua pero no tiene folio
    if (usarBoletaAntigua && !tieneFolio) {
      return NextResponse.json(
        { error: 'Esta orden no tiene una boleta antigua para enviar' },
        { status: 400 }
      );
    }

    // ============================================================
    // 3. OBTENER ITEMS DE LA ORDEN
    // ============================================================
    const orderItems = await query(
      `SELECT 
        oi.product_name,
        oi.product_price,
        oi.quantity,
        oi.subtotal
      FROM order_items oi
      WHERE oi.order_id = ?`,
      [orderId]
    ) as any[];

    if (orderItems.length === 0) {
      return NextResponse.json(
        { error: 'No se encontraron productos para esta orden' },
        { status: 400 }
      );
    }

    // ============================================================
    // 4. PREPARAR DATOS PARA EL EMAIL
    // ============================================================
    const subtotalConIVA = parseFloat(order.subtotal) || 0;
    const subtotalNeto = Math.round(subtotalConIVA / 1.19);
    const ivaIncluido = subtotalConIVA - subtotalNeto;
    const shippingAddress = extraerShippingAddress(order);

    //  Determinar qué folio usar para el email
    let folioParaEmail = order.boleta_folio || 'N/A';
    let fuentePDF = 'apigateway';

    if (!usarBoletaAntigua && order.boleta_pdf_path && order.boleta_pdf_folio) {
      folioParaEmail = order.boleta_pdf_folio;
      fuentePDF = 'admin';
    }

    const emailData = {
      orderNumber: order.order_number,
      customerName: `${order.customer_first_name || ''} ${order.customer_last_name || ''}`.trim() || 'Cliente',
      customerEmail: order.customer_email,
      customerPhone: order.customer_phone || 'No especificado',
      orderDate: new Date(order.created_at).toLocaleDateString('es-CL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      paymentMethod: "Transbank Webpay",
      items: orderItems.map((item: any) => ({
        product_name: item.product_name,
        product_price: parseFloat(item.product_price),
        quantity: item.quantity,
        subtotal: parseFloat(item.subtotal)
      })),
      subtotal: subtotalConIVA,
      discount: parseFloat(order.discount || 0),
      shipping: parseFloat(order.shipping || 0),
      tax: ivaIncluido,
      total: parseFloat(order.total || 0),
      shippingAddress: shippingAddress,
      boletaFolio: folioParaEmail,
      storeInfo: {
        name: process.env.APIGATEWAY_RAZON_SOCIAL || "Zorro Lúdico",
        rut: process.env.APIGATEWAY_RUT_EMISOR || "78364115-1",
        giro: process.env.APIGATEWAY_GIRO || "Venta de juegos",
        direccion: process.env.APIGATEWAY_DIRECCION || "Marchant Pereira 150 Oficina 901",
        comuna: process.env.APIGATEWAY_COMUNA || "San Miguel",
        ciudad: process.env.APIGATEWAY_CIUDAD || "Santiago"
      }
    };

    // ============================================================
    // 5. OBTENER EL PDF
    // ============================================================
    console.log(` Obteniendo PDF `);
    const resultadoPDF = await obtenerPDFBoleta(order, orderId, usarBoletaAntigua);

    if (!resultadoPDF) {
      return NextResponse.json(
        { error: 'No se pudo obtener el PDF de la boleta' },
        { status: 500 }
      );
    }

    const pdfBuffer = resultadoPDF.buffer;
    const fuente = resultadoPDF.fuente;

    console.log(` PDF obtenido`);

    // ============================================================
    // 6. ENVIAR EMAIL CON EL PDF
    // ============================================================
    const emailSent = await sendBoletaEmail(emailData, pdfBuffer, folioParaEmail);

    if (emailSent) {
      return NextResponse.json({
        success: true,
        message: `Email con boleta reenviado exitosamente. ${orderItems.length} producto(s) incluido(s).`,
        boleta: { 
          folio: folioParaEmail,
          fuente: fuente === 'admin' ? 'admin_upload' : 'apigateway'
        },
        productsCount: orderItems.length
      });
    } else {
      return NextResponse.json(
        { error: 'No se pudo enviar el email de confirmación' },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('Error reenviando email de orden:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}