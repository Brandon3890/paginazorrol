import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sendBoletaEmail } from '@/lib/email-service';
import { obtenerPDFApiGateway, obtenerFechaEmisionSII } from '@/lib/apigateway-service';
import { obtenerBoletaConVerificacion } from '@/lib/boleta-helper';

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
 * (Misma función que en payment/response)
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
  const shippingDetails = order.shipping_details ? JSON.parse(order.shipping_details) : null;

  // Caso 1: Retiro en Bodega (bodega_pickup)
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

  // Caso 2: Retiro en Sucursal (branch_pickup)
  if (shippingType === 'branch_pickup' && shippingDetails?.selectedBranch) {
    const branch = shippingDetails.selectedBranch;
    // Intentar extraer comuna y región de la dirección
    const addressParts = branch.address ? branch.address.split(',') : ['Sucursal Chilexpress'];
    let commune = 'Santiago';
    let region = 'Región Metropolitana';
    
    // Intentar encontrar comuna en el texto de la dirección
    const commonCommunes = ['Santiago', 'Providencia', 'Las Condes', 'Vitacura', 'Ñuñoa', 'La Reina', 'Peñalolén', 'Macul', 'San Miguel', 'San Joaquín', 'Estación Central', 'Quinta Normal', 'Renca', 'Independencia', 'Recoleta', 'Huechuraba', 'Conchalí', 'Cerro Navia', 'Lo Prado', 'Pudahuel', 'Maipú', 'Cerrillos', 'Lo Espejo', 'San Bernardo', 'La Cisterna', 'El Bosque', 'La Granja', 'San Ramón', 'La Pintana', 'Lo Barnechea', 'Colina', 'Lampa', 'Tiltil', 'Pirque', 'Puente Alto', 'San José de Maipo', 'Buin', 'Calera de Tango', 'Paine', 'Melipilla', 'Curacaví', 'María Pinto', 'San Pedro', 'Alhué', 'Talagante', 'Peñaflor', 'El Monte', 'Isla de Maipo', 'Padre Hurtado', 'Litueche'];
    
    for (const c of commonCommunes) {
      if (branch.address && branch.address.includes(c)) {
        commune = c;
        break;
      }
    }
    
    return {
      street: branch.address || 'Sucursal Chilexpress',
      commune_name: commune,
      region_name: region,
      postal_code: '000000',
      department: '',
      instructions: `Retiro en Sucursal - ${branch.name}${branch.telephone ? ` - Teléfono: ${branch.telephone}` : ''}`
    };
  }

  // Caso 3: Envío a Domicilio (home_delivery, standard, express, cash_on_delivery)
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

  // Caso 4: Fallback - valores por defecto
  console.log(' No se encontró dirección en la orden, usando valores por defecto');
  return {
    street: 'No especificada',
    commune_name: 'No especificada',
    region_name: 'No especificada',
    postal_code: '000000',
    department: '',
    instructions: ''
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orderId = id;

    // Obtener datos de la orden (incluyendo shipping_type y shipping_details)
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

    const subtotalConIVA = parseFloat(order.subtotal) || 0;
    const subtotalNeto = Math.round(subtotalConIVA / 1.19);
    const ivaIncluido = subtotalConIVA - subtotalNeto;

    // EXTRAER DIRECCIÓN DE ENVÍO DESDE LA ORDEN
    const shippingAddress = extraerShippingAddress(order);

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
      shippingAddress: shippingAddress, // Usar la dirección extraída
      storeInfo: {
        name: process.env.APIGATEWAY_RAZON_SOCIAL || "Zorro Lúdico",
        rut: process.env.APIGATEWAY_RUT_EMISOR || "78364115-1",
        giro: process.env.APIGATEWAY_GIRO || "Venta de juegos",
        direccion: process.env.APIGATEWAY_DIRECCION || "Marchant Pereira 150 Oficina 901",
        comuna: process.env.APIGATEWAY_COMUNA || "San Miguel",
        ciudad: process.env.APIGATEWAY_CIUDAD || "Santiago"
      }
    };

    try {
      // Formatear fecha correctamente
      let fechaFormateada: string;
      
      if (order.boleta_fecha) {
        fechaFormateada = formatearFecha(order.boleta_fecha);
      } else {
        fechaFormateada = new Date().toISOString().split('T')[0];
      }

      // Intentar obtener la fecha real del SII
      console.log(` Buscando fecha real de la boleta`);
      const fechaSII = await obtenerFechaEmisionSII(order.boleta_folio);

      if (fechaSII) {
        fechaFormateada = fechaSII;
        console.log(`Usando fecha del SII: ${fechaFormateada}`);
        
        try {
          await query(
            `UPDATE boletas SET fecha_emision = ? WHERE folio = ?`,
            [fechaSII, order.boleta_folio]
          );
          console.log(`Fecha actualizada en BD: ${fechaSII}`);
        } catch (updateError) {
          console.warn(' No se pudo actualizar la fecha en BD');
        }
      } else {
        console.log(` No se encontró la boleta en el SII, usando fecha: ${fechaFormateada}`);
      }

      // OBTENER BOLETA CON VERIFICACIÓN DE ESTADO
      console.log(` Obteniendo boleta ${order.boleta_folio} con verificación...`);
      
      const resultadoBoleta = await obtenerBoletaConVerificacion(
        order.boleta_folio,
        fechaFormateada
      );
      
      if (!resultadoBoleta.success || !resultadoBoleta.pdfBuffer) {
        console.error('Error obteniendo boleta:', resultadoBoleta.error);
        return NextResponse.json(
          { error: resultadoBoleta.error || 'No se pudo obtener la boleta' },
          { status: 500 }
        );
      }
      
      const pdfBuffer = resultadoBoleta.pdfBuffer;
      
      // Enviar email con la boleta PDF adjunta y la dirección correcta
      console.log(' Enviando email con shippingAddress:', emailData.shippingAddress);
      
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

    } catch (error: any) {
      console.error('Error obteniendo PDF o enviando email:', error);
      return NextResponse.json(
        { error: error.message || 'Error al obtener la boleta PDF o enviar el email' },
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