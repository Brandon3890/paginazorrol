// app/api/simplefactura/emitir-boleta/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { emitirBoletaSimpleFactura, obtenerPDFSimpleFactura } from '@/lib/simplefactura-service';
import { sendBoletaEmail } from '@/lib/email-service';

// Función para validar RUT chileno (básica)
function validarRUT(rut: string): boolean {
  // Aceptar RUT de consumidor final
  if (rut === '55555555-5') return true;
  
  // Validar formato básico (sin puntos, con guión)
  const rutRegex = /^[0-9]+-[0-9Kk]$/;
  if (!rutRegex.test(rut)) return false;
  
  // Validar dígito verificador
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

// Función para limpiar RUT (quitar puntos, formatear)
function limpiarRUT(rut: string): string {
  // Si es consumidor final, devolver tal cual
  if (rut === '55555555-5') return rut;
  
  // Quitar puntos y convertir a mayúsculas
  let clean = rut.replace(/\./g, '').toUpperCase();
  
  // Asegurar formato NN-N
  if (!clean.includes('-')) {
    // Intentar separar cuerpo y dígito
    const cuerpo = clean.slice(0, -1);
    const digito = clean.slice(-1);
    clean = `${cuerpo}-${digito}`;
  }
  
  return clean;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cliente, productos, total, ordenId, ordenNumero } = body;

    console.log('📄 Emitiendo boleta para orden:', ordenId);
    console.log('   Cliente:', cliente.nombre, cliente.rut);
    console.log('   Productos:', productos.length);
    console.log('   Total:', total);

    // Validar datos mínimos
    if (!productos || productos.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No hay productos para emitir' },
        { status: 400 }
      );
    }

    // Limpiar y validar RUT
    let rutCliente = cliente.rut?.toString().trim() || '55555555-5';
    
    if (!validarRUT(rutCliente)) {
      console.log(`⚠️ RUT inválido: ${rutCliente}, usando consumidor final`);
      rutCliente = '55555555-5';
      cliente.nombre = 'Consumidor Final';
    } else {
      rutCliente = limpiarRUT(rutCliente);
    }
    
    // Verificar si ya existe una boleta para esta orden
    const boletaExistente = await query(
      `SELECT id, folio FROM boletas WHERE order_id = ?`,
      [ordenId]
    ) as any[];

    if (boletaExistente.length > 0) {
      console.log('📋 Boleta ya existe para orden:', ordenId, 'folio:', boletaExistente[0].folio);
      return NextResponse.json({
        success: true,
        folio: boletaExistente[0].folio,
        data: { id: boletaExistente[0].id },
        message: 'Boleta ya emitida anteriormente'
      });
    }

    // Preparar datos del cliente
    const receptor = {
      rut: rutCliente,
      nombre: cliente.nombre || 'Consumidor Final',
      direccion: cliente.direccion || 'Santiago',
      comuna: cliente.comuna || 'Santiago',
      ciudad: cliente.ciudad || 'Santiago'
    };

    console.log('   Receptor final:', receptor);

    // Emitir boleta
    const resultado = await emitirBoletaSimpleFactura(productos, receptor, total);

    if (resultado.status === 200 && resultado.data) {
      const neto = Math.round(total / 1.19);
      const iva = total - neto;
      const fechaEmision = new Date().toISOString().slice(0, 19).replace('T', ' ');
      
      // Guardar en base de datos
      const insertResult = await query(
        `INSERT INTO boletas (
          order_id, folio, tipo_dte, rut_emisor, rut_receptor, 
          razon_social_receptor, monto_total, iva, fecha_emision, ambiente, estado_sii
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ordenId,
          resultado.data.folio,
          39,
          process.env.SIMPLEFACTURA_RUT_EMISOR,
          receptor.rut,
          receptor.nombre,
          resultado.data.total,
          iva,
          fechaEmision,
          'certificacion',
          'emitida'
        ]
      ) as any;

      console.log('✅ Boleta guardada en BD con folio:', resultado.data.folio);

      // Actualizar la orden con la boleta
      await query(
        `UPDATE orders SET boleta_id = ?, boleta_emitida = 1 WHERE id = ?`,
        [insertResult.insertId, ordenId]
      );

      // ========== ENVIAR EMAIL CON BOLETA PDF ==========
      try {
        console.log('📧 Descargando PDF para enviar por email...');
        const pdfUint8Array = await obtenerPDFSimpleFactura(resultado.data.folio);
        
        // Convertir Uint8Array a Buffer para el email
        const pdfBuffer = Buffer.from(pdfUint8Array);
        
        // Obtener datos completos de la orden para el email
        const orderDataForEmail = await query(
          `SELECT 
            o.*,
            u.email as customer_email,
            u.first_name as customer_first_name,
            u.last_name as customer_last_name,
            u.phone as customer_phone,
            ua.street as shipping_street,
            ua.commune_name as shipping_commune,
            ua.region_name as shipping_region
          FROM orders o
          LEFT JOIN users u ON o.user_id = u.id
          LEFT JOIN user_addresses ua ON o.shipping_address_id = ua.id
          WHERE o.id = ?`,
          [ordenId]
        ) as any[];

        if (orderDataForEmail.length > 0) {
          const order = orderDataForEmail[0];
          
          // Calcular subtotal desde items
          const itemsForEmail = await query(
            `SELECT product_name, product_price, quantity FROM order_items WHERE order_id = ?`,
            [ordenId]
          ) as any[];
          
          const subtotal = itemsForEmail.reduce((sum, item) => sum + (item.product_price * item.quantity), 0);
          
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
            items: itemsForEmail.map((item: any) => ({
              product_name: item.product_name,
              product_price: parseFloat(item.product_price),
              quantity: item.quantity
            })),
            subtotal: subtotal,
            discount: parseFloat(order.discount || 0),
            shipping: parseFloat(order.shipping || 0),
            tax: parseFloat(order.tax || 0),
            total: parseFloat(order.total),
            shippingAddress: {
              street: order.shipping_street || 'No especificada',
              commune_name: order.shipping_commune || 'No especificada',
              region_name: order.shipping_region || 'No especificada'
            },
            storeInfo: {
              name: "Zorro Lúdico",
              rut: process.env.SIMPLEFACTURA_RUT_EMISOR,
              giro: process.env.SIMPLEFACTURA_GIRO,
              direccion: process.env.SIMPLEFACTURA_DIRECCION,
              comuna: process.env.SIMPLEFACTURA_COMUNA,
              ciudad: process.env.SIMPLEFACTURA_CIUDAD
            }
          };

          await sendBoletaEmail(emailData, pdfBuffer, resultado.data.folio);
          console.log('✅ Email con boleta enviado a:', order.customer_email);
        }
      } catch (emailError) {
        console.error('❌ Error enviando email con boleta:', emailError);
        // No fallar la emisión si falla el email
      }

      return NextResponse.json({
        success: true,
        folio: resultado.data.folio,
        data: resultado.data,
        boletaId: insertResult.insertId
      });
    } else {
      throw new Error(resultado.message || 'Error al emitir boleta');
    }

  } catch (error: any) {
    console.error('❌ Error en emitir-boleta:', error.message);
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno' },
      { status: 500 }
    );
  }
}