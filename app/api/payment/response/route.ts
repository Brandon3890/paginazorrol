import { NextRequest, NextResponse } from 'next/server'
import { transbankService } from '@/lib/transbank-service'
import { query } from '@/lib/db'
import { sendBoletaEmail } from '@/lib/email-service';
import { emitirBoletaSimpleFactura, obtenerPDFSimpleFactura } from '@/lib/simplefactura-service'

async function obtenerPDFBoleta(folio: string): Promise<Buffer | null> {
  try {
    console.log('Obteniendo PDF');
    const pdfUint8Array = await obtenerPDFSimpleFactura(Number(folio));
    return Buffer.from(pdfUint8Array);
  } catch (error: any) {
    console.error('Error obteniendo PDF:', error.message);
    return null;
  }
}

async function emitirBoleta(orderId: number) {
  try {
    console.log('Iniciando emision de boleta para orden:', orderId);
    
    const orderData = await query(
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
        ua.region_name as shipping_region
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN user_addresses ua ON o.shipping_address_id = ua.id
      WHERE o.id = ?`,
      [orderId]
    ) as any[];

    if (orderData.length === 0) {
      throw new Error('Orden no encontrada');
    }

    const order = orderData[0];

    // VERIFICAR SI YA EXISTE BOLETA
    const boletaExistente = await query(
      `SELECT id, folio FROM boletas WHERE order_id = ?`,
      [orderId]
    ) as any[];

    if (boletaExistente.length > 0) {
      console.log('✅ Boleta ya existe para orden:', orderId, 'folio:', boletaExistente[0].folio);
      return {
        success: true,
        folio: boletaExistente[0].folio,
        boletaId: boletaExistente[0].id,
        yaExistia: true
      };
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
      throw new Error('No hay productos en la orden');
    }

    let rutCliente = order.customer_rut || '55555555-5';
    
    if (order.is_guest === 1) {
      rutCliente = '55555555-5';
      console.log('👤 Cliente invitado, usando RUT por defecto:', rutCliente);
    }

    if (rutCliente === '55555555-5' || !rutCliente || rutCliente === '') {
      rutCliente = '55555555-5';
    }

    const nombreCliente = order.customer_first_name && order.customer_last_name
      ? `${order.customer_first_name} ${order.customer_last_name}`.trim()
      : order.is_guest === 1 
        ? 'Consumidor Final' 
        : 'Cliente';

    console.log('📋 Datos para boleta:', {
      rut: rutCliente,
      nombre: nombreCliente,
      is_guest: order.is_guest
    });

    const cliente = {
      rut: rutCliente,
      nombre: nombreCliente || 'Consumidor Final',
      direccion: order.shipping_street || 'Santiago',
      comuna: order.shipping_commune || 'Santiago',
      ciudad: order.shipping_region || 'Santiago'
    };

    const productos = orderItems.map((item: any) => ({
      nombre: item.product_name,
      cantidad: item.quantity,
      precio: parseFloat(item.product_price)
    }));

    const total = parseFloat(order.total);

    console.log('📦 Emitiendo boleta para:', cliente.nombre, 'con', productos.length, 'productos');

    const result = await emitirBoletaSimpleFactura(
      productos,
      cliente,
      total
    );

    if (result.status === 200) {
      console.log('✅ Boleta emitida exitosamente. Folio:', result.data.folio);
      
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
          result.data.folio,
          39,
          process.env.SIMPLEFACTURA_RUT_EMISOR || '78181331-1',
          cliente.rut,
          cliente.nombre,
          result.data.total,
          iva,
          fechaEmision,
          'certificacion',
          'emitida'
        ]
      ) as any;

      await query(
        `UPDATE orders SET boleta_id = ?, boleta_emitida = 1 WHERE id = ?`,
        [insertResult.insertId, orderId]
      );

      return {
        success: true,
        folio: result.data.folio,
        boletaId: insertResult.insertId,
        yaExistia: false
      };
    } else {
      console.error('❌ Error emitiendo boleta:', result.error);
      return { success: false, error: result.error };
    }

  } catch (error: any) {
    console.error('❌ Error en emitirBoleta:', error.message);
    return { success: false, error: error.message };
  }
}

async function descontarStock(orderId: number) {
  try {
    console.log('🔄 Descontando stock para orden:', orderId);
    
    const orderItems = await query(
      `SELECT product_id, quantity FROM order_items WHERE order_id = ?`,
      [orderId]
    ) as any[];

    if (!orderItems || orderItems.length === 0) {
      console.log('⚠️ No hay items en la orden, no se descuenta stock');
      return true;
    }

    console.log(`📦 Descontando stock de ${orderItems.length} productos...`);

    for (const item of orderItems) {
      const [productCheck] = await query(
        `SELECT stock, name FROM products WHERE id = ?`,
        [item.product_id]
      ) as any[];

      if (!productCheck) {
        console.warn(`⚠️ Producto ${item.product_id} no encontrado, saltando...`);
        continue;
      }

      const stockActual = productCheck.stock;
      const nuevaCantidad = stockActual - item.quantity;

      if (nuevaCantidad < 0) {
        console.error(`❌ Stock insuficiente para producto ${item.product_id}. Stock: ${stockActual}, Solicitado: ${item.quantity}`);
        continue;
      }

      await query(
        `UPDATE products SET stock = ?, in_stock = CASE WHEN ? > 0 THEN 1 ELSE 0 END WHERE id = ?`,
        [nuevaCantidad, nuevaCantidad, item.product_id]
      );

      console.log(`✅ Stock actualizado: ${productCheck.name} (ID: ${item.product_id}) ${stockActual} → ${nuevaCantidad}`);
    }

    console.log('✅ Stock descontado correctamente');
    return true;

  } catch (error) {
    console.error('❌ Error descontando stock:', error);
    return false;
  }
}

async function liberarStock(userId: number) {
  try {
    const reservations = await query(
      `SELECT product_id, quantity FROM stock_reservations WHERE user_id = ? AND expires_at > NOW()`,
      [userId]
    ) as any[]
    
    if (!reservations || reservations.length === 0) {
      console.log('No hay reservas activas para usuario', userId, 'saltando liberacion')
      return true
    }
    
    console.log('Liberando', reservations.length, 'reservas para usuario', userId)
    
    for (const res of reservations) {
      const [productCheck] = await query(
        `SELECT stock FROM products WHERE id = ?`,
        [res.product_id]
      ) as any[]
      
      if (productCheck) {
        await query(
          `UPDATE products SET stock = stock + ? WHERE id = ?`,
          [res.quantity, res.product_id]
        )
        console.log('Stock devuelto para producto', res.product_id, '+', res.quantity, 'unidades')
      } else {
        console.warn('Producto', res.product_id, 'no encontrado, no se puede devolver stock')
      }
    }
    
    await query(
      'DELETE FROM stock_reservations WHERE user_id = ?',
      [userId]
    )
    console.log('Reservas eliminadas para usuario', userId)
    return true
  } catch (error) {
    console.error('Error liberando stock:', error)
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const token_ws = formData.get('token_ws') as string
    const TBK_TOKEN = formData.get('TBK_TOKEN') as string

    console.log('Respuesta de Webpay recibida:', { 
      token_ws: token_ws ? 'PRESENTE (' + token_ws.substring(0, 10) + '...)' : 'AUSENTE', 
      TBK_TOKEN: TBK_TOKEN ? 'PRESENTE (' + TBK_TOKEN.substring(0, 10) + '...)' : 'AUSENTE' 
    })

    // CASO: Pago ABORTADO por el usuario
    if (TBK_TOKEN && !token_ws) {
      console.log('Pago ABORTADO por el usuario')
      
      const orders = await query(
        `SELECT * FROM orders WHERE transbank_session_id = ?`,
        [TBK_TOKEN]
      ) as any[]

      if (orders.length > 0) {
        const order = orders[0]
        
        if (order.user_id) {
          await liberarStock(order.user_id)
        } else {
          console.log('⚠️ Usuario invitado, no hay reservas que liberar');
        }
        
        await query(
          `UPDATE orders SET 
            payment_status = 'failed',
            status = 'cancelled',
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
          [order.id]
        )
        
        const redirectUrl = new URL('/order-success', process.env.NEXTAUTH_URL)
        redirectUrl.searchParams.set('orderId', order.id.toString())
        redirectUrl.searchParams.set('status', 'cancelled')
        
        return NextResponse.redirect(redirectUrl)
      } else {
        const redirectUrl = new URL('/order-success', process.env.NEXTAUTH_URL)
        redirectUrl.searchParams.set('status', 'cancelled')
        redirectUrl.searchParams.set('message', 'order_not_found')
        
        return NextResponse.redirect(redirectUrl)
      }
    }

    // CASO: Pago EXITOSO
    if (token_ws && !TBK_TOKEN) {
      console.log('Procesando pago EXITOSO con token_ws')
      
      try {
        const commitResponse = await transbankService.commitTransaction(token_ws)
        
        const orders = await query(
          `SELECT * FROM orders WHERE transbank_buy_order = ?`,
          [commitResponse.buy_order]
        ) as any[]

        if (orders.length === 0) {
          const redirectUrl = new URL('/order-success', process.env.NEXTAUTH_URL)
          redirectUrl.searchParams.set('status', 'error')
          redirectUrl.searchParams.set('message', 'order_not_found')
          
          return NextResponse.redirect(redirectUrl)
        }

        const order = orders[0]

        if (transbankService.isTransactionApproved(commitResponse)) {
          
          const [orderCheck] = await query(
            `SELECT payment_status, status FROM orders WHERE id = ?`,
            [order.id]
          ) as any[]
          
          if (orderCheck && orderCheck.payment_status === 'paid') {
            console.log('Esta orden ya fue procesada, saltando...')
            const redirectUrl = new URL('/order-success', process.env.NEXTAUTH_URL)
            redirectUrl.searchParams.set('orderId', order.id.toString())
            redirectUrl.searchParams.set('status', 'success')
            
            return NextResponse.redirect(redirectUrl)
          }
          
          if (order.payment_status !== 'paid') {
            console.log('Procesando pago exitoso');

            // DESCONTAR STOCK
            await descontarStock(order.id);

            // Eliminar reservas de stock
            if (order.user_id) {
              await query(
                'DELETE FROM stock_reservations WHERE user_id = ?',
                [order.user_id]
              );
              console.log('Reservas eliminadas para usuario:', order.user_id);
            } else {
              console.log('✅ Usuario invitado, stock ya descontado directamente');
            }

            // EMITIR BOLETA
            console.log('Emitiendo boleta electronica...');
            const resultadoBoleta = await emitirBoleta(order.id);
            
            let pdfBuffer = null;
            let folio = null;
            
            if (resultadoBoleta.success) {
              folio = resultadoBoleta.folio;
              console.log('✅ Boleta emitida/obtenida, folio:', folio);
              
              pdfBuffer = await obtenerPDFBoleta(folio);
              if (pdfBuffer) {
                console.log('PDF de boleta obtenido correctamente');
              } else {
                console.warn('No se pudo obtener el PDF de la boleta');
              }
            } else {
              console.error('❌ Error emitiendo boleta:', resultadoBoleta.error);
            }

            // ENVIAR EMAIL DE CONFIRMACIÓN
            try {
              const orderDetailsResult = await query(
                `SELECT 
                  o.*,
                  oi.product_name,
                  oi.product_price,
                  oi.quantity,
                  oi.subtotal,
                  u.email as customer_email,
                  u.first_name as customer_first_name,
                  u.last_name as customer_last_name,
                  u.phone as customer_phone,
                  u.is_guest as is_guest,
                  ua.street as shipping_street,
                  ua.commune_name as shipping_commune,
                  ua.region_name as shipping_region,
                  ua.postal_code as shipping_postal_code,
                  ua.department as shipping_department,
                  ua.delivery_instructions as shipping_instructions
                FROM orders o
                LEFT JOIN order_items oi ON o.id = oi.order_id
                LEFT JOIN users u ON o.user_id = u.id
                LEFT JOIN user_addresses ua ON o.shipping_address_id = ua.id
                WHERE o.id = ?`,
                [order.id]
              ) as any[]; // 👈 Casteo explícito a any[]

              if (orderDetailsResult && orderDetailsResult.length > 0) {
                const firstItem = orderDetailsResult[0];
                
                // Obtener email del cliente si no está en los detalles
                let customerEmail = firstItem.customer_email;
                if (!customerEmail) {
                  const userResult = await query(
                    `SELECT email FROM users WHERE id = ?`,
                    [order.user_id]
                  ) as any[];
                  if (userResult && userResult.length > 0) {
                    customerEmail = userResult[0].email;
                  }
                }
                
                if (customerEmail) {
                  // Construir dirección de envío
                  const shippingAddress = firstItem.shipping_street ? {
                    street: firstItem.shipping_street || 'No especificada',
                    commune_name: firstItem.shipping_commune || 'No especificada',
                    region_name: firstItem.shipping_region || 'No especificada',
                    postal_code: firstItem.shipping_postal_code || '000000',
                    department: firstItem.shipping_department || '',
                    instructions: firstItem.shipping_instructions || ''
                  } : null;
                  
                  // Calcular subtotales
                  let subtotalConIVA = 0;
                  for (const item of orderDetailsResult) {
                    subtotalConIVA += parseFloat(item.subtotal) || 0;
                  }
                  const subtotalNeto = Math.round(subtotalConIVA / 1.19);
                  const ivaIncluido = subtotalConIVA - subtotalNeto;
                  
                  const emailData = {
                    orderNumber: firstItem.order_number,
                    customerName: (firstItem.customer_first_name || '' + ' ' + firstItem.customer_last_name || '').trim() || 'Cliente',
                    customerEmail: customerEmail,
                    customerPhone: firstItem.customer_phone || 'No especificado',
                    orderDate: new Date(firstItem.created_at).toLocaleDateString('es-CL', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    }),
                    paymentMethod: "Transbank Webpay",
                    items: orderDetailsResult.map((item: any) => ({
                      product_name: item.product_name,
                      product_price: parseFloat(item.product_price),
                      quantity: item.quantity,
                      subtotal: parseFloat(item.subtotal)
                    })),
                    subtotal: subtotalConIVA,
                    discount: parseFloat(firstItem.discount || 0),
                    shipping: parseFloat(firstItem.shipping || 0),
                    tax: ivaIncluido,
                    total: parseFloat(firstItem.total || 0),
                    shippingAddress: shippingAddress ? {
                      street: shippingAddress.street,
                      commune_name: shippingAddress.commune_name,
                      region_name: shippingAddress.region_name,
                      postal_code: shippingAddress.postal_code,
                      department: shippingAddress.department,
                      instructions: shippingAddress.instructions
                    } : {
                      street: 'No especificada',
                      commune_name: 'No especificada',
                      region_name: 'No especificada',
                      postal_code: '000000',
                      department: '',
                      instructions: ''
                    },
                    storeInfo: {
                      name: "Zorro Ludico",
                      rut: process.env.SIMPLEFACTURA_RUT_EMISOR || "78181331-1",
                      giro: "Venta de juegos",
                      direccion: "Calle 7 numero 3",
                      comuna: "Santiago",
                      ciudad: "Santiago"
                    }
                  };

                  // Enviar email con boleta
                  if (pdfBuffer && folio) {
                    await sendBoletaEmail(emailData, pdfBuffer, folio);
                    console.log('✅ Email con boleta PDF enviado a:', customerEmail);
                    if (shippingAddress) {
                      console.log('   📍 Dirección:', shippingAddress.street, shippingAddress.commune_name);
                    }
                  } else {
                    console.warn('⚠️ No se pudo enviar boleta PDF, enviando solo confirmación');
                    await sendBoletaEmail(emailData, Buffer.from(''), 'SIN_FOLIO');
                  }
                } else {
                  console.warn('⚠️ No se encontró email del cliente');
                }
              } else {
                console.warn('⚠️ No se encontraron detalles de la orden');
              }
            } catch (emailError) {
              console.error('❌ Error enviando email:', emailError);
            }
          }

          // ACTUALIZAR ESTADO DE LA ORDEN
          await query(
            `UPDATE orders SET 
              payment_status = 'paid',
              status = 'processing',
              transbank_token = ?,
              transbank_authorization_code = ?,
              transbank_payment_type = ?,
              transbank_installments_number = ?,
              transbank_card_number = ?,
              transbank_accounting_date = ?,
              transbank_transaction_date = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
            [
              token_ws,
              commitResponse.authorization_code,
              commitResponse.payment_type_code,
              commitResponse.installments_number,
              commitResponse.card_detail?.card_number || '',
              commitResponse.accounting_date,
              new Date(commitResponse.transaction_date)
                .toISOString()
                .slice(0, 19)
                .replace('T', ' '),
              order.id
            ]
          )

          console.log('Pago APROBADO - Stock descontado y boleta emitida correctamente')

          const redirectUrl = new URL('/order-success', process.env.NEXTAUTH_URL)
          redirectUrl.searchParams.set('orderId', order.id.toString())
          redirectUrl.searchParams.set('status', 'success')
          
          console.log('🔄 Redirigiendo a:', redirectUrl.toString())
          
          return NextResponse.redirect(redirectUrl)

        } else {
          // PAGO RECHAZADO
          const rejectionReason = transbankService.getResponseCodeDescription(commitResponse.response_code)
          
          if (order.user_id) {
            await liberarStock(order.user_id)
          } else {
            console.log('⚠️ Usuario invitado, no hay reservas que liberar');
          }
          
          await query(
            `UPDATE orders SET 
              payment_status = 'failed',
              status = 'cancelled',
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
            [order.id]
          )

          const redirectUrl = new URL('/order-success', process.env.NEXTAUTH_URL)
          redirectUrl.searchParams.set('orderId', order.id.toString())
          redirectUrl.searchParams.set('status', 'error')
          redirectUrl.searchParams.set('message', 'payment_rejected')
          redirectUrl.searchParams.set('reason', rejectionReason)

          return NextResponse.redirect(redirectUrl)
        }

      } catch (commitError: any) {
        console.error('Error confirmando pago:', commitError)
        const redirectUrl = new URL('/order-success', process.env.NEXTAUTH_URL)
        redirectUrl.searchParams.set('status', 'error')
        redirectUrl.searchParams.set('message', 'payment_failed')
        
        return NextResponse.redirect(redirectUrl)
      }
    }

    console.error('Tokens invalidos o ausentes')
    const redirectUrl = new URL('/order-success', process.env.NEXTAUTH_URL)
    redirectUrl.searchParams.set('status', 'error')
    redirectUrl.searchParams.set('message', 'invalid_tokens')
    
    return NextResponse.redirect(redirectUrl)

  } catch (error: any) {
    console.error('Error CRITICO:', error)
    const redirectUrl = new URL('/order-success', process.env.NEXTAUTH_URL)
    redirectUrl.searchParams.set('status', 'error')
    redirectUrl.searchParams.set('message', 'processing_error')
    
    return NextResponse.redirect(redirectUrl)
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const token_ws = searchParams.get('token_ws')
  const TBK_TOKEN = searchParams.get('TBK_TOKEN')
  
  if (token_ws || TBK_TOKEN) {
    const formData = new FormData()
    if (token_ws) formData.append('token_ws', token_ws)
    if (TBK_TOKEN) formData.append('TBK_TOKEN', TBK_TOKEN)
    
    return POST(new NextRequest(request.nextUrl, {
      method: 'POST',
      body: formData
    }))
  }
  
  return NextResponse.redirect(process.env.NEXTAUTH_URL + '/')
}