// app/api/orders/[id]/retry-boleta/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { emitirBoletaApiGateway, obtenerPDFApiGateway } from '@/lib/apigateway-service';
import { sendBoletaEmail } from '@/lib/email-service';
import { obtenerBoletaConVerificacion } from '@/lib/boleta-helper';

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
  const shippingDetails = order.shipping_details ? JSON.parse(order.shipping_details) : null;

  // Caso 1: Retiro en Bodega
  if (shippingType === 'bodega_pickup' && shippingDetails?.selectedBranch) {
    const branch = shippingDetails.selectedBranch;
    return {
      street: branch.address || 'Arcangel 1200, San Miguel',
      commune_name: 'San Miguel',
      region_name: 'Región Metropolitana',
      postal_code: '8900000',
      department: '',
      instructions: 'Retiro en Bodega - Horario: Lunes a Viernes 12:00 - 18:00 hrs'
    };
  }

  // Caso 2: Retiro en Sucursal
  if (shippingType === 'branch_pickup' && shippingDetails?.selectedBranch) {
    const branch = shippingDetails.selectedBranch;
    const addressParts = branch.address ? branch.address.split(',') : ['Sucursal Chilexpress'];
    let commune = 'Santiago';
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
      region_name: 'Región Metropolitana',
      postal_code: '000000',
      department: '',
      instructions: `Retiro en Sucursal - ${branch.name}${branch.telephone ? ` - Teléfono: ${branch.telephone}` : ''}`
    };
  }

  // Caso 3: Envío a Domicilio
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

    // ============================================================
    // 1. OBTENER LA ORDEN CON TODOS SUS DATOS
    // ============================================================
    const orders = await query(
      `SELECT 
        o.*,
        u.email as customer_email,
        u.first_name as customer_first_name,
        u.last_name as customer_last_name,
        u.phone as customer_phone,
        u.rut as customer_rut,
        u.is_guest as is_guest,
        ua.street as shipping_street,
        ua.commune_name as shipping_commune,
        ua.region_name as shipping_region,
        ua.postal_code as shipping_postal_code,
        ua.department as shipping_department,
        ua.delivery_instructions as shipping_instructions
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN user_addresses ua ON o.shipping_address_id = ua.id
      WHERE o.id = ?`,
      [orderId]
    ) as any[];

    if (orders.length === 0) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
    }

    const order = orders[0];

    // ============================================================
    // 2. VALIDACIONES ESTRICTAS
    // ============================================================

    //  2.1 - Solo órdenes con pago aprobado
    if (order.payment_status !== 'paid') {
      return NextResponse.json({
        error: 'Esta orden no tiene un pago aprobado. No se puede generar boleta.',
        code: 'PAYMENT_NOT_PAID'
      }, { status: 400 });
    }

    //  2.2 - Solo órdenes SIN boleta
    if (order.boleta_emitida === 1) {
      // Verificar si realmente tiene boleta en la tabla boletas
      const boletaExistente = await query(
        `SELECT id, folio FROM boletas WHERE order_id = ?`,
        [orderId]
      ) as any[];
      
      if (boletaExistente.length > 0) {
        return NextResponse.json({
          error: 'Esta orden ya tiene una boleta emitida',
          code: 'BOLETA_ALREADY_EXISTS',
          folio: boletaExistente[0].folio
        }, { status: 400 });
      } else {
        // Caso inconsistente: boleta_emitida=1 pero no hay registro en boletas
        // Corregimos el estado
        await query(
          `UPDATE orders SET boleta_emitida = 0 WHERE id = ?`,
          [orderId]
        );
      }
    }

    //  2.3 - Verificar que NO sea una orden de SimpleFactura
    // Las órdenes antiguas de SimpleFactura tienen boleta_emitida=1 y tienen registros en boletas
    // Para seguridad, verificamos que la orden sea posterior a la migración a ApiGateway
    const fechaMigracion = new Date('2026-08-31'); // Fecha de migración a ApiGateway
    
    // Si la orden es anterior a la migración, verificar si tiene boleta antigua
    if (new Date(order.created_at) < fechaMigracion) {
      const boletaAntigua = await query(
        `SELECT id, folio FROM boletas WHERE order_id = ?`,
        [orderId]
      ) as any[];
      
      if (boletaAntigua.length > 0) {
        return NextResponse.json({
          error: 'Esta orden tiene una boleta emitida con SimpleFactura. No se puede reemitir.',
          code: 'SIMPLEFACTURA_LEGACY',
          folio: boletaAntigua[0].folio
        }, { status: 400 });
      }
    }

    //  2.4 - Verificar límite de reintentos (máximo 3)
    const intentos = order.boleta_intentos || 0;
    if (intentos >= 3) {
      return NextResponse.json({
        error: 'Se excedió el número máximo de reintentos (3). Contacta a soporte.',
        code: 'MAX_RETRIES_EXCEEDED',
        maxIntentos: 3
      }, { status: 400 });
    }

    //  2.5 - Verificar que la orden tenga productos
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
      return NextResponse.json({ 
        error: 'No hay productos en esta orden',
        code: 'NO_PRODUCTS'
      }, { status: 400 });
    }

    // ============================================================
    // 3. REGISTRAR EL INTENTO
    // ============================================================
    await query(
      `UPDATE orders SET 
        boleta_intentos = ?,
        boleta_ultimo_intento = NOW()
      WHERE id = ?`,
      [intentos + 1, orderId]
    );

    // ============================================================
    // 4. PREPARAR DATOS PARA LA BOLETA
    // ============================================================
    let rutCliente = order.customer_rut || '66666666-6';
    if (order.is_guest === 1) {
      rutCliente = '66666666-6';
    }

    const nombreCliente = order.customer_first_name && order.customer_last_name
      ? `${order.customer_first_name} ${order.customer_last_name}`.trim()
      : order.is_guest === 1 ? 'Consumidor Final' : 'Cliente';

    const cliente = {
      rut: rutCliente,
      nombre: nombreCliente || 'Consumidor Final',
      direccion: order.shipping_street || 'Santiago',
      comuna: order.shipping_commune || 'Santiago',
      ciudad: order.shipping_region || 'Santiago',
      telefono: order.customer_phone || undefined,
      email: order.customer_email || undefined
    };

    const productos = orderItems.map((item: any) => ({
      nombre: item.product_name,
      cantidad: item.quantity,
      precio: parseFloat(item.product_price)
    }));

    const total = parseFloat(order.total);

    // ============================================================
    // 5. INTENTAR EMITIR LA BOLETA CON APIGATEWAY
    // ============================================================
    try {
      const result = await emitirBoletaApiGateway(productos, cliente, total);

      const folio = result.data?.folio || result.folio;
      const montoTotal = result.data?.total || result.total || total;

      if (!folio) {
        throw new Error('No se obtuvo folio de la boleta');
      }

      // ============================================================
      //  GUARDAR EN BASE DE DATOS
      // ============================================================
      const neto = Math.round(total / 1.19);
      const iva = total - neto;
      const fechaEmision = new Date().toISOString().slice(0, 19).replace('T', ' ');

      const insertResult = await query(
        `INSERT INTO boletas (
          order_id, folio, tipo_dte, rut_emisor, rut_receptor, 
          razon_social_receptor, monto_total, iva, fecha_emision, ambiente, estado_sii
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          folio,
          39,
          process.env.APIGATEWAY_RUT_EMISOR || '78364115-1',
          cliente.rut,
          cliente.nombre,
          montoTotal,
          iva,
          fechaEmision,
          'certificacion',
          'emitida'
        ]
      ) as any;

      await query(
        `UPDATE orders SET 
          boleta_id = ?,
          boleta_emitida = 1,
          boleta_intentos = 0
        WHERE id = ?`,
        [insertResult.insertId, orderId]
      );

      // ============================================================
      // 7. OBTENER PDF Y ENVIAR EMAIL
      // ============================================================
      try {
        console.log('Obteniendo PDF');
        
        const resultadoBoletaVerificada = await obtenerBoletaConVerificacion(
          folio,
          fechaEmision
        );

        if (resultadoBoletaVerificada.success && resultadoBoletaVerificada.pdfBuffer) {
          const pdfBuffer = resultadoBoletaVerificada.pdfBuffer;
          
          // Construir dirección de envío
          const shippingAddress = extraerShippingAddress(order);

          const emailData = {
            orderNumber: order.order_number,
            customerName: `${order.customer_first_name || ''} ${order.customer_last_name || ''}`.trim() || 'Cliente',
            customerEmail: order.customer_email,
            customerPhone: order.customer_phone || 'No especificado',
            orderDate: new Date(order.created_at).toLocaleDateString('es-CL'),
            paymentMethod: "Transbank Webpay",
            items: orderItems.map((item: any) => ({
              product_name: item.product_name,
              product_price: parseFloat(item.product_price),
              quantity: item.quantity,
              subtotal: parseFloat(item.subtotal)
            })),
            subtotal: parseFloat(order.subtotal),
            discount: parseFloat(order.discount || 0),
            shipping: parseFloat(order.shipping || 0),
            tax: 0,
            total: parseFloat(order.total || 0),
            shippingAddress: shippingAddress,
            storeInfo: {
              name: process.env.APIGATEWAY_RAZON_SOCIAL || "Zorro Lúdico",
              rut: process.env.APIGATEWAY_RUT_EMISOR || "78364115-1",
              giro: process.env.APIGATEWAY_GIRO || "Venta de juegos",
              direccion: process.env.APIGATEWAY_DIRECCION || "Marchant Pereira 150 Oficina 901",
              comuna: process.env.APIGATEWAY_COMUNA || "San Miguel",
              ciudad: process.env.APIGATEWAY_CIUDAD || "Santiago"
            }
          };

          await sendBoletaEmail(emailData, pdfBuffer, folio);
          console.log(' Email con boleta enviado a:', order.customer_email);
        } else {
          console.warn(' No se pudo obtener PDF para el email');
        }
      } catch (emailError) {
        console.error('Error enviando email en reintento:', emailError);
        // No fallamos el reintento si el email falla
      }

      return NextResponse.json({
        success: true,
        message: `Boleta emitida exitosamente. Folio: ${folio}`,
        folio: folio,
        boleta_id: insertResult.insertId
      });

    } catch (boletaError: any) {
      // ============================================================
      // 8. ERROR - GUARDAR EN BD Y RETORNAR
      // ============================================================
      console.error('Error emitiendo boleta en reintento:', boletaError.message);
      
      await query(
        `UPDATE orders SET boleta_error = ? WHERE id = ?`,
        [boletaError.message || 'Error al emitir boleta', orderId]
      );

      return NextResponse.json({
        error: `Error al emitir boleta: ${boletaError.message}`,
        code: 'BOLETA_EMISSION_ERROR',
        intentos: intentos + 1,
        maxIntentos: 3
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Error en retry-boleta:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}