// app/api/orders/[id]/resend-email/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sendBoletaEmail } from '@/lib/email-service';
import { obtenerPDFSimpleFactura } from '@/lib/simplefactura-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orderId = parseInt(id);

    if (isNaN(orderId)) {
      return NextResponse.json({ error: 'ID de orden inválido' }, { status: 400 });
    }

    // Obtener datos de la orden con la boleta
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

    // Buscar el folio de la boleta en múltiples lugares
    let boletaFolio = order.boleta_folio;
    
    if (!boletaFolio && order.boleta_id) {
      const boletaData = await query(
        `SELECT folio FROM boletas WHERE id = ? AND order_id = ?`,
        [order.boleta_id, orderId]
      ) as any[];
      
      if (boletaData.length > 0) {
        boletaFolio = boletaData[0].folio;
      }
    }

    if (!boletaFolio) {
      const boletaData = await query(
        `SELECT folio FROM boletas WHERE order_id = ?`,
        [orderId]
      ) as any[];
      
      if (boletaData.length > 0) {
        boletaFolio = boletaData[0].folio;
      }
    }

    if (!boletaFolio) {
      console.error('❌ No se encontró boleta para la orden:', orderId);
      return NextResponse.json(
        { error: 'Esta orden aún no tiene una boleta electrónica emitida. Por favor contacta a soporte.' },
        { status: 400 }
      );
    }

    // Obtener productos
    const orderItems = await query(
      `SELECT product_name, product_price, quantity, subtotal
       FROM order_items 
       WHERE order_id = ?`,
      [orderId]
    ) as any[];

    if (orderItems.length === 0) {
      return NextResponse.json(
        { error: 'No se encontraron productos para esta orden' },
        { status: 400 }
      );
    }

    // Calcular IVA
    const subtotalConIVA = parseFloat(order.subtotal);
    const ivaIncluido = subtotalConIVA - Math.round(subtotalConIVA / 1.19);

    const emailData = {
      orderNumber: order.order_number,
      customerName: `${order.customer_first_name || ''} ${order.customer_last_name || ''}`.trim() || 'Cliente',
      customerEmail: order.customer_email,
      customerPhone: order.customer_phone || 'No especificado',
      orderDate: new Date(order.created_at).toLocaleDateString('es-CL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
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

    try {
      const pdfUint8Array = await obtenerPDFSimpleFactura(Number(boletaFolio));
      const pdfBuffer = Buffer.from(pdfUint8Array);
      
      const emailSent = await sendBoletaEmail(emailData, pdfBuffer, String(boletaFolio));
      
      if (emailSent) {
        return NextResponse.json({
          success: true,
          message: `Email con boleta reenviado exitosamente a ${order.customer_email}. Folio: ${boletaFolio}`,
          boleta: { folio: boletaFolio },
          productsCount: orderItems.length
        });
      } else {
        return NextResponse.json(
          { error: 'No se pudo enviar el email de confirmación' },
          { status: 500 }
        );
      }
      
    } catch (pdfError: any) {
      console.error('❌ Error:', pdfError);
      return NextResponse.json(
        { error: `Error al obtener la boleta PDF: ${pdfError.message}` },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('❌ Error:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}