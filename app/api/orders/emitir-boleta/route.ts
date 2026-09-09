// app/api/orders/emitir-boleta/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { emitirBoletaApiGateway } from '@/lib/apigateway-service';

// RUT POR DEFECTO PARA CONSUMIDOR FINAL ANÓNIMO
const RUT_CONSUMIDOR_FINAL = '66666666-6';

function validarRUT(rut: string): boolean {
  if (rut === RUT_CONSUMIDOR_FINAL) return true;

  const rutRegex = /^[0-9]+-[0-9Kk]$/;
  if (!rutRegex.test(rut)) return false;

  const partes = rut.split('-');
  const cuerpo = partes[0];
  const digitoVerificador = partes[1].toUpperCase();

  let suma = 0;
  let multiplicador = 2;

  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }

  const resto = suma % 11;
  const dvCalculado = 11 - resto;
  let dvEsperado = '';

  if (dvCalculado === 11) dvEsperado = '0';
  else if (dvCalculado === 10) dvEsperado = 'K';
  else dvEsperado = dvCalculado.toString();

  return dvEsperado === digitoVerificador;
}

function limpiarRUT(rut: string): string {
  if (rut === RUT_CONSUMIDOR_FINAL) return rut;

  let clean = rut.replace(/\./g, '').toUpperCase();

  if (!clean.includes('-')) {
    const cuerpo = clean.slice(0, -1);
    const digito = clean.slice(-1);
    clean = `${cuerpo}-${digito}`;
  }

  return clean;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'Se requiere orderId' },
        { status: 400 }
      );
    }

    console.log(` Emitiendo boleta para la orden `);

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
        u.is_guest as is_guest
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.id = ?`,
      [orderId]
    ) as any[];

    if (orders.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Orden no encontrada' },
        { status: 404 }
      );
    }

    const order = orders[0];

    // ============================================================
    // 2. VERIFICAR QUE EL PAGO ESTÉ APROBADO
    // ============================================================
    if (order.payment_status !== 'paid') {
      return NextResponse.json(
        { success: false, error: 'El pago no está aprobado' },
        { status: 400 }
      );
    }

    // ============================================================
    // 3. VERIFICAR SI YA EXISTE BOLETA
    // ============================================================
    const boletaExistente = await query(
      `SELECT id, folio FROM boletas WHERE order_id = ?`,
      [orderId]
    ) as any[];

    if (boletaExistente.length > 0) {
      console.log(` Boleta ya existe para orden ${orderId}`);
      return NextResponse.json({
        success: true,
        folio: boletaExistente[0].folio,
        data: { id: boletaExistente[0].id },
        message: 'Boleta ya emitida anteriormente'
      });
    }

    // ============================================================
    // 4. OBTENER ITEMS DE LA ORDEN
    // ============================================================
    const orderItems = await query(
      `SELECT product_name, product_price, quantity, subtotal 
       FROM order_items 
       WHERE order_id = ?`,
      [orderId]
    ) as any[];

    if (orderItems.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No hay productos en esta orden' },
        { status: 400 }
      );
    }

    // ============================================================
    // 5. PREPARAR DATOS DEL CLIENTE
    // ============================================================
    // Usar el RUT de la orden (que ya viene del checkout)
    let rutCliente = order.customer_rut || RUT_CONSUMIDOR_FINAL;
    
    // Validar y limpiar el RUT
    if (rutCliente !== RUT_CONSUMIDOR_FINAL && validarRUT(rutCliente)) {
      rutCliente = limpiarRUT(rutCliente);
    } else if (rutCliente !== RUT_CONSUMIDOR_FINAL) {
      console.warn(` RUT inválido: ${rutCliente}, usando consumidor final`);
      rutCliente = RUT_CONSUMIDOR_FINAL;
    }

    const nombreCliente = order.customer_first_name && order.customer_last_name
      ? `${order.customer_first_name} ${order.customer_last_name}`.trim()
      : 'Consumidor Final';

    const emailCliente = order.customer_email || undefined;
    const telefonoCliente = order.customer_phone || undefined;

    // ============================================================
    // 6. PREPARAR DIRECCIÓN
    // ============================================================
    let direccion = 'Santiago';
    let comuna = 'Santiago';
    let ciudad = 'Santiago';

    if (order.shipping_address_id) {
      const address = await query(
        `SELECT street, commune_name, region_name FROM user_addresses WHERE id = ?`,
        [order.shipping_address_id]
      ) as any[];
      
      if (address.length > 0) {
        direccion = address[0].street || 'Santiago';
        comuna = address[0].commune_name || 'Santiago';
        ciudad = address[0].region_name || 'Santiago';
      }
    }

    // Si es retiro en bodega
    if (order.shipping_type === 'bodega_pickup') {
      direccion = 'Arcangel 1200, San Miguel';
      comuna = 'San Miguel';
      ciudad = 'Región Metropolitana';
    }

    // ============================================================
    // 7. PREPARAR PRODUCTOS
    // ============================================================
    const productos = orderItems.map((item: any) => ({
      nombre: item.product_name,
      cantidad: item.quantity,
      precio: parseFloat(item.product_price)
    }));

    const totalFinal = parseFloat(order.total);

    // ============================================================
    // 8. CONSTRUIR RECEPTOR
    // ============================================================
    const receptor = {
      rut: rutCliente,
      nombre: nombreCliente,
      direccion: direccion,
      comuna: comuna,
      ciudad: ciudad,
      telefono: telefonoCliente,
      email: emailCliente
    };


    // ============================================================
    // 9. EMITIR CON APIGATEWAY
    // ============================================================
    const resultado = await emitirBoletaApiGateway(
      productos,
      receptor,
      totalFinal
    );

    const folio = resultado.data?.folio || resultado.folio;
    const montoTotal = resultado.data?.total || resultado.total || totalFinal;

    if (!folio) {
      throw new Error('No se obtuvo folio de la boleta');
    }

    console.log(` Boleta emitida. Folio: ${folio}`);

    // ============================================================
    // 10. GUARDAR EN BASE DE DATOS
    // ============================================================
    const neto = Math.round(totalFinal / 1.19);
    const iva = totalFinal - neto;
    const fechaEmision = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const insertResult = await query(
      `INSERT INTO boletas (
        order_id, folio, tipo_dte, rut_emisor, rut_receptor, 
        razon_social_receptor, monto_total, iva, fecha_emision, 
        ambiente, estado_sii, fecha_creacion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        orderId,
        folio,
        39,
        process.env.APIGATEWAY_RUT_EMISOR || '78364115-1',
        receptor.rut,
        receptor.nombre,
        montoTotal,
        iva,
        fechaEmision,
        'produccion',
        'emitida'
      ]
    ) as any;

    console.log(` Boleta guardada `);

    // Actualizar la orden
    await query(
      `UPDATE orders SET 
        boleta_id = ?, 
        boleta_emitida = 1,
        boleta_intentos = 0,
        boleta_error = NULL
      WHERE id = ?`,
      [insertResult.insertId, orderId]
    );

    return NextResponse.json({
      success: true,
      folio: folio,
      data: resultado.data || resultado,
      boletaId: insertResult.insertId
    });

  } catch (error: any) {
    console.error(' Error en emitir-boleta:', error.message);
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno' },
      { status: 500 }
    );
  }
}