import { NextRequest, NextResponse } from 'next/server';
import { query, queryRows } from '@/lib/db';
import { sendOrderConfirmationEmail } from '@/lib/email-service';
import { getUserIdFromRequest } from '@/lib/auth-utils';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(request);
    
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // ✅ Esperar los params
    const { id } = await params;
    const orderId = id;

    // Verificar que la orden existe y pertenece al usuario
    const orderDetails = await query(
      `SELECT 
        o.*,
        oi.product_name,
        oi.product_price,
        oi.quantity,
        oi.subtotal,
        p.category_id,
        c.name as category_name,
        ua.street as shipping_street,
        ua.commune_name as shipping_commune,
        ua.region_name as shipping_region,
        ua.postal_code as shipping_postal_code,
        u.email as customer_email,
        u.first_name as customer_first_name,
        u.last_name as customer_last_name,
        u.phone as customer_phone
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN user_addresses ua ON o.shipping_address_id = ua.id
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.id = ? AND o.user_id = ?`,
      [orderId, userId]
    ) as any[];

    if (orderDetails.length === 0) {
      return NextResponse.json(
        { error: 'Orden no encontrada' },
        { status: 404 }
      );
    }

    const firstItem = orderDetails[0];
    
    // ✅ Validar que tenemos datos del cliente desde la tabla users
    if (!firstItem.customer_email) {
      return NextResponse.json(
        { error: 'No se encontró información del cliente para esta orden' },
        { status: 400 }
      );
    }

    // Preparar datos para el email
    const emailData = {
      orderNumber: firstItem.order_number,
      customerName: `${firstItem.customer_first_name || ''} ${firstItem.customer_last_name || ''}`.trim() || 'Cliente',
      customerEmail: firstItem.customer_email,
      customerPhone: firstItem.customer_phone || 'No especificado',
      orderDate: new Date(firstItem.created_at).toLocaleDateString('es-CL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      paymentMethod: "Transbank Webpay",
      items: orderDetails.map((item: any) => ({
        product_name: item.product_name,
        product_price: parseFloat(item.product_price),
        quantity: item.quantity,
        category: item.category_name || 'General'
      })),
      subtotal: parseFloat(firstItem.subtotal),
      discount: parseFloat(firstItem.discount || 0),
      shipping: parseFloat(firstItem.shipping || 0),
      tax: parseFloat(firstItem.tax || 0),
      total: parseFloat(firstItem.total),
      shippingAddress: {
        street: firstItem.shipping_street || 'No especificada',
        commune_name: firstItem.shipping_commune || 'No especificada',
        region_name: firstItem.shipping_region || 'No especificada',
        postal_code: firstItem.shipping_postal_code || '000000'
      }
    };

    console.log('📧 Reenviando email de confirmación para orden:', firstItem.order_number);
    console.log('📧 Datos del email:', {
      customerEmail: emailData.customerEmail,
      customerName: emailData.customerName,
      total: emailData.total
    });
    
    const emailSent = await sendOrderConfirmationEmail(emailData);
    
    if (emailSent) {
      return NextResponse.json({
        success: true,
        message: 'Email de confirmación reenviado exitosamente'
      });
    } else {
      return NextResponse.json(
        { error: 'No se pudo enviar el email de confirmación' },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('❌ Error reenviando email de orden:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}