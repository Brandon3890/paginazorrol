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

    const cliente = {
      rut: order.customer_rut || '55555555-5',
      nombre: `${order.customer_first_name || ''} ${order.customer_last_name || ''}`.trim() || 'Consumidor Final',
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

    const result = await emitirBoletaSimpleFactura(
      productos,
      cliente,
      total
    );

    if (result.status === 200) {
      console.log('Boleta emitida exitosamente.');
      return {
        success: true,
        folio: result.data.folio
      };
    } else {
      console.error('Error emitiendo boleta:', result.error);
      return { success: false, error: result.error };
    }

  } catch (error: any) {
    console.error('Error en emitirBoleta:', error.message);
    return { success: false, error: error.message };
  }
}

// ============================================================
// FUNCIÓN PARA DESCONTAR STOCK DE PRODUCTOS
// ============================================================
async function descontarStock(orderId: number) {
  try {
    console.log('🔄 Descontando stock para orden:', orderId);
    
    // Obtener los items de la orden
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
      // Verificar stock actual
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
        // Podríamos lanzar un error o continuar
        continue;
      }

      // Actualizar stock
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

// ============================================================
// FUNCIÓN PARA LIBERAR RESERVAS DE STOCK (SOLO USUARIOS AUTENTICADOS)
// ============================================================
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
        
        // Liberar reservas solo si hay userId (usuario autenticado)
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
        
        return NextResponse.redirect(
          process.env.NEXTAUTH_URL + '/order-success?orderId=' + order.id + '&status=cancelled'
        )
      } else {
        return NextResponse.redirect(
          process.env.NEXTAUTH_URL + '/order-success?status=cancelled&message=order_not_found'
        )
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
          return NextResponse.redirect(
            process.env.NEXTAUTH_URL + '/order-success?status=error&message=order_not_found'
          )
        }

        const order = orders[0]

        if (transbankService.isTransactionApproved(commitResponse)) {
          
          const [orderCheck] = await query(
            `SELECT payment_status, status FROM orders WHERE id = ?`,
            [order.id]
          ) as any[]
          
          if (orderCheck && orderCheck.payment_status === 'paid') {
            console.log('Esta orden ya fue procesada, saltando...')
            return NextResponse.redirect(
              new URL(
                '/order-success?orderId=' + order.id + '&status=success',
                process.env.NEXTAUTH_URL
              )
            )
          }
          
          if (order.payment_status !== 'paid') {
            console.log('Procesando pago exitoso');

            // ============================================================
            // DESCONTAR STOCK - TANTO PARA AUTENTICADOS COMO INVITADOS
            // ============================================================
            await descontarStock(order.id);

            // Eliminar reservas de stock solo si hay userId (usuario autenticado)
            if (order.user_id) {
              await query(
                'DELETE FROM stock_reservations WHERE user_id = ?',
                [order.user_id]
              );
              console.log('Reservas eliminadas para usuario:', order.user_id);
            } else {
              console.log('✅ Usuario invitado, stock ya descontado directamente');
            }

            // ============================================================
            // EMITIR BOLETA
            // ============================================================
            console.log('Emitiendo boleta electronica...');
            const resultadoBoleta = await emitirBoleta(order.id);
            
            let pdfBuffer = null;
            let folio = null;
            
            if (resultadoBoleta.success) {
              folio = resultadoBoleta.folio;
              console.log('Boleta emitida, folio:', folio);
              
              pdfBuffer = await obtenerPDFBoleta(folio);
              if (pdfBuffer) {
                console.log('PDF de boleta obtenido correctamente');
              } else {
                console.warn('No se pudo obtener el PDF de la boleta');
              }
            } else {
              console.error('Error emitiendo boleta:', resultadoBoleta.error);
            }

            // ============================================================
            // ENVIAR EMAIL DE CONFIRMACIÓN
            // ============================================================
            try {
              const orderDetails = await query(
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
                  ua.street as shipping_street,
                  ua.commune_name as shipping_commune,
                  ua.region_name as shipping_region,
                  ua.postal_code as shipping_postal_code
                FROM orders o
                LEFT JOIN order_items oi ON o.id = oi.order_id
                LEFT JOIN users u ON o.user_id = u.id
                LEFT JOIN user_addresses ua ON o.shipping_address_id = ua.id
                WHERE o.id = ?`,
                [order.id]
              ) as any[];

              if (orderDetails.length > 0 && orderDetails[0].customer_email) {
                const firstItem = orderDetails[0];
                
                const subtotalConIVA = parseFloat(firstItem.subtotal);
                const subtotalNeto = Math.round(subtotalConIVA / 1.19);
                const ivaIncluido = subtotalConIVA - subtotalNeto;
                
                const emailData = {
                  orderNumber: firstItem.order_number,
                  customerName: (firstItem.customer_first_name || '' + ' ' + firstItem.customer_last_name || '').trim() || 'Cliente',
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
                    quantity: item.quantity
                  })),
                  subtotal: subtotalConIVA,
                  discount: parseFloat(firstItem.discount || 0),
                  shipping: parseFloat(firstItem.shipping || 0),
                  tax: ivaIncluido,
                  total: parseFloat(firstItem.total),
                  shippingAddress: {
                    street: firstItem.shipping_street || 'No especificada',
                    commune_name: firstItem.shipping_commune || 'No especificada',
                    region_name: firstItem.shipping_region || 'No especificada',
                    postal_code: firstItem.shipping_postal_code || '000000'
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

                if (pdfBuffer && folio) {
                  await sendBoletaEmail(emailData, pdfBuffer, folio);
                  console.log('Email con boleta PDF enviado a:', firstItem.customer_email);
                } else {
                  console.warn('No se pudo enviar boleta PDF, enviando solo confirmacion');
                  await sendBoletaEmail(emailData, Buffer.from(''), 'SIN_FOLIO');
                }
              }
            } catch (emailError) {
              console.error('Error enviando email:', emailError);
            }
          }

          // ============================================================
          // ACTUALIZAR ESTADO DE LA ORDEN
          // ============================================================
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

          console.log('Pago APROBADO - Stock descontado correctamente')

          return NextResponse.redirect(
            new URL(
              '/order-success?orderId=' + order.id + '&status=success',
              process.env.NEXTAUTH_URL
            )
          )

        } else {
          // ============================================================
          // PAGO RECHAZADO
          // ============================================================
          const rejectionReason = transbankService.getResponseCodeDescription(commitResponse.response_code)
          
          // Liberar reservas solo si hay userId (usuario autenticado)
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

          return NextResponse.redirect(
            process.env.NEXTAUTH_URL + '/order-success?orderId=' + order.id + '&status=error&message=payment_rejected&reason=' + encodeURIComponent(rejectionReason)
          )
        }

      } catch (commitError: any) {
        console.error('Error confirmando pago:', commitError)
        return NextResponse.redirect(
          process.env.NEXTAUTH_URL + '/order-success?status=error&message=payment_failed'
        )
      }
    }

    console.error('Tokens invalidos o ausentes')
    return NextResponse.redirect(
      process.env.NEXTAUTH_URL + '/order-success?status=error&message=invalid_tokens'
    )

  } catch (error: any) {
    console.error('Error CRITICO:', error)
    return NextResponse.redirect(
      process.env.NEXTAUTH_URL + '/order-success?status=error&message=processing_error'
    )
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