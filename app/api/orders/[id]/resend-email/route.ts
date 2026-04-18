// app/api/orders/[id]/resend-email/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sendBoletaEmail } from '@/lib/email-service';
import { getUserIdFromRequest } from '@/lib/auth-utils';
import { obtenerPDFSimpleFactura } from '@/lib/simplefactura-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(request);
    
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const orderId = id;

    // Obtener datos de la orden (sin JOIN con order_items para evitar duplicados)
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
      WHERE o.id = ? AND o.user_id = ?`,
      [orderId, userId]
    ) as any[];

    if (orderData.length === 0) {
      return NextResponse.json(
        { error: 'Orden no encontrada' },
        { status: 404 }
      );
    }

    const order = orderData[0];
    
    // Validar que tenemos datos del cliente
    if (!order.customer_email) {
      return NextResponse.json(
        { error: 'No se encontró información del cliente para esta orden' },
        { status: 400 }
      );
    }

    // Verificar que la orden tiene una boleta emitida
    if (!order.boleta_folio) {
      return NextResponse.json(
        { error: 'Esta orden aún no tiene una boleta electrónica emitida' },
        { status: 400 }
      );
    }

    // Obtener TODOS los productos de la orden (por separado)
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

    console.log('📦 Productos encontrados en la orden:', orderItems.length);
    orderItems.forEach((item, idx) => {
      console.log(`   ${idx + 1}. ${item.product_name} x${item.quantity} = $${item.product_price}`);
    });

    // Calcular el IVA incluido correctamente
    const subtotalConIVA = parseFloat(order.subtotal);
    const subtotalNeto = Math.round(subtotalConIVA / 1.19);
    const ivaIncluido = subtotalConIVA - subtotalNeto;

    // Preparar datos para el email - CON TODOS LOS PRODUCTOS
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
      total: parseFloat(order.total),
      shippingAddress: {
        street: order.shipping_street || 'No especificada',
        commune_name: order.shipping_commune || 'No especificada',
        region_name: order.shipping_region || 'No especificada',
        postal_code: order.shipping_postal_code || '000000'
      },
      storeInfo: {
        name: "Zorro Lúdico",
        rut: process.env.SIMPLEFACTURA_RUT_EMISOR || "78181331-1",
        giro: process.env.SIMPLEFACTURA_GIRO || "Venta de juegos",
        direccion: process.env.SIMPLEFACTURA_DIRECCION || "Calle 7 numero 3",
        comuna: process.env.SIMPLEFACTURA_COMUNA || "Santiago",
        ciudad: process.env.SIMPLEFACTURA_CIUDAD || "Santiago"
      }
    };

    console.log('📧 Reenviando email con boleta para orden:', order.order_number);
    console.log('   Folio boleta:', order.boleta_folio);
    console.log('   Total productos a incluir:', emailData.items.length);
    
    try {
      // Obtener el PDF de la boleta
      console.log('📄 Descargando PDF de boleta folio:', order.boleta_folio);
      const pdfUint8Array = await obtenerPDFSimpleFactura(order.boleta_folio);
      const pdfBuffer = Buffer.from(pdfUint8Array);
      
      // Enviar email con la boleta PDF adjunta
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
      console.error('❌ Error obteniendo PDF o enviando email:', pdfError);
      return NextResponse.json(
        { error: 'Error al obtener la boleta PDF o enviar el email' },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('❌ Error reenviando email de orden:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}