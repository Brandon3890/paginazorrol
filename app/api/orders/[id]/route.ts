import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sendBoletaEmail } from '@/lib/email-service';
import { obtenerPDFSimpleFactura } from '@/lib/simplefactura-service';
import { getUserIdFromRequest } from '@/lib/auth-utils';

// ============================================
// GET - Obtener detalles de una orden específica
// ============================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orderId = parseInt(id);
    
    if (isNaN(orderId)) {
      return NextResponse.json(
        { error: 'ID de orden inválido' },
        { status: 400 }
      );
    }

    // Verificar autenticación
    const userId = await getUserIdFromRequest(request);
    
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Verificar que la orden pertenece al usuario o es admin
    const userCheck = await query(
      `SELECT role FROM users WHERE id = ?`,
      [userId]
    ) as any[];
    
    const userRole = userCheck.length > 0 ? userCheck[0].role : 'customer';
    const isAdmin = userRole === 'admin';

    // Obtener la orden
    let orderQuery = `
      SELECT 
        o.*,
        u.email as customer_email,
        u.first_name as customer_first_name,
        u.last_name as customer_last_name,
        u.phone as customer_phone,
        ua.street as shipping_street,
        ua.commune_name as shipping_commune,
        ua.region_name as shipping_region,
        ua.postal_code as shipping_postal_code,
        ua.department as shipping_department,
        ua.delivery_instructions as shipping_instructions,
        b.folio as boleta_folio,
        b.id as boleta_id,
        b.monto_total as boleta_monto,
        b.fecha_emision as boleta_fecha,
        b.estado_sii as boleta_estado
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN user_addresses ua ON o.shipping_address_id = ua.id
      LEFT JOIN boletas b ON o.id = b.order_id
      WHERE o.id = ?
    `;

    const orderData = await query(orderQuery, [orderId]) as any[];

    if (orderData.length === 0) {
      return NextResponse.json(
        { error: 'Orden no encontrada' },
        { status: 404 }
      );
    }

    const order = orderData[0];

    // Verificar permisos: solo el dueño o admin pueden ver
    if (!isAdmin && order.user_id !== userId) {
      return NextResponse.json(
        { error: 'No tienes permisos para ver esta orden' },
        { status: 403 }
      );
    }

    // Obtener los items de la orden con imágenes
    const orderItems = await query(
      `SELECT 
        oi.id,
        oi.product_id,
        oi.product_name,
        oi.product_price,
        oi.quantity,
        oi.subtotal,
        p.image as image_url,
        c.name as category
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE oi.order_id = ?`,
      [orderId]
    ) as any[];

    console.log(`📦 Orden ${order.order_number}: ${orderItems.length} productos encontrados`);

    // Construir respuesta
    const response = {
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      payment_status: order.payment_status,
      subtotal: parseFloat(order.subtotal),
      discount: parseFloat(order.discount || 0),
      shipping: parseFloat(order.shipping || 0),
      tax: parseFloat(order.tax || 0),
      total: parseFloat(order.total),
      notes: order.notes,
      coupon_code: order.coupon_code,
      shipping_method: order.payment_method,
      created_at: order.created_at,
      updated_at: order.updated_at,
      items: orderItems.map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.product_name,
        product_price: parseFloat(item.product_price),
        quantity: item.quantity,
        subtotal: parseFloat(item.subtotal),
        image_url: item.image_url,
        category: item.category
      })),
      customer_email: order.customer_email || '',
      customer_first_name: order.customer_first_name || '',
      customer_last_name: order.customer_last_name || '',
      customer_phone: order.customer_phone || '',
      shipping_address: order.shipping_street ? {
        street: order.shipping_street,
        commune_name: order.shipping_commune || '',
        region_name: order.shipping_region || '',
        postal_code: order.shipping_postal_code || '',
        department: order.shipping_department || '',
        delivery_instructions: order.shipping_instructions || ''
      } : undefined,
      boleta_emitida: order.boleta_id ? 1 : 0,
      boleta_info: order.boleta_folio ? {
        folio: order.boleta_folio,
        monto_total: parseFloat(order.boleta_monto || 0),
        fecha_emision: order.boleta_fecha,
        estado_sii: order.boleta_estado || 'emitida'
      } : undefined
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('Error obteniendo orden:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Reenviar email con boleta
// ============================================
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orderId = id;

    // Obtener datos de la orden
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
        b.id as boleta_id
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

    if (!order.boleta_folio) {
      return NextResponse.json(
        { error: 'Esta orden aún no tiene una boleta electrónica emitida' },
        { status: 400 }
      );
    }

    // Obtener TODOS los productos de la orden
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

    console.log('Productos encontrados en la orden:', orderItems.length);

    // Calcular el IVA incluido
    const subtotalConIVA = parseFloat(order.subtotal) || 0;
    const subtotalNeto = Math.round(subtotalConIVA / 1.19);
    const ivaIncluido = subtotalConIVA - subtotalNeto;

    // Preparar datos para el email
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
      shippingAddress: {
        street: order.shipping_street || 'No especificada',
        commune_name: order.shipping_commune || 'No especificada',
        region_name: order.shipping_region || 'No especificada',
        postal_code: order.shipping_postal_code || '000000'
      },
      storeInfo: {
        name: "Zorro Ludico",
        rut: process.env.SIMPLEFACTURA_RUT_EMISOR || "78181331-1",
        giro: process.env.SIMPLEFACTURA_GIRO || "Venta de juegos",
        direccion: process.env.SIMPLEFACTURA_DIRECCION || "Calle 7 numero 3",
        comuna: process.env.SIMPLEFACTURA_COMUNA || "Santiago",
        ciudad: process.env.SIMPLEFACTURA_CIUDAD || "Santiago"
      }
    };

    try {
      const pdfUint8Array = await obtenerPDFSimpleFactura(order.boleta_folio);
      const pdfBuffer = Buffer.from(pdfUint8Array);
      
      const emailSent = await sendBoletaEmail(emailData, pdfBuffer, order.boleta_folio);
      
      if (emailSent) {
        return NextResponse.json({
          success: true,
          message: `Email con boleta reenviado exitosamente. ${orderItems.length} producto(s) incluido(s).`,
          boleta: { folio: order.boleta_folio },
          productsCount: orderItems.length
        });
      } else {
        return NextResponse.json(
          { error: 'No se pudo enviar el email de confirmación' },
          { status: 500 }
        );
      }
      
    } catch (pdfError) {
      console.error('Error obteniendo PDF o enviando email:', pdfError);
      return NextResponse.json(
        { error: 'Error al obtener la boleta PDF o enviar el email' },
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