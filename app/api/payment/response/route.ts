// app/api/payment/response/route.ts - VERSIÓN CORREGIDA CON sendBoletaEmail
import { NextRequest, NextResponse } from 'next/server'
import { transbankService } from '@/lib/transbank-service'
import { query } from '@/lib/db'
import { sendBoletaEmail } from '@/lib/email-service';

// Función auxiliar para obtener el PDF de la boleta
async function obtenerPDFBoleta(folio: string): Promise<Buffer | null> {
  try {
    console.log('📄 Obteniendo PDF de boleta para folio:', folio);
    
    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/simplefactura/pdf?folio=${folio}`);
    
    if (!response.ok) {
      throw new Error(`Error al obtener PDF: ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
    
  } catch (error: any) {
    console.error('❌ Error obteniendo PDF:', error.message);
    return null;
  }
}

// Función auxiliar para emitir boleta
async function emitirBoleta(orderId: number) {
  try {
    console.log('📄 Iniciando emisión de boleta para orden:', orderId);
    
    // Obtener datos de la orden
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

    // Obtener productos de la orden
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

    // Preparar datos del cliente
    const cliente = {
      rut: order.customer_rut || '55555555-5',
      nombre: `${order.customer_first_name || ''} ${order.customer_last_name || ''}`.trim() || 'Consumidor Final',
      direccion: order.shipping_street || 'Santiago',
      comuna: order.shipping_commune || 'Santiago',
      ciudad: order.shipping_region || 'Santiago'
    };

    // Preparar productos para la boleta
    const productos = orderItems.map((item: any) => ({
      nombre: item.product_name,
      cantidad: item.quantity,
      precio: parseFloat(item.product_price) // Este precio YA incluye IVA
    }));

    // Calcular total
    const total = parseFloat(order.total);

    // Llamar a la API de emisión de boleta
    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/simplefactura/emitir-boleta`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cliente,
        productos,
        total,
        ordenId: order.id,
        ordenNumero: order.order_number
      }),
    });

    const result = await response.json();

    if (result.success) {
      console.log('✅ Boleta emitida exitosamente. Folio:', result.folio);
      return { success: true, folio: result.folio, boletaId: result.boletaId };
    } else {
      console.error('❌ Error emitiendo boleta:', result.error);
      return { success: false, error: result.error };
    }

  } catch (error: any) {
    console.error('❌ Error en emitirBoleta:', error.message);
    return { success: false, error: error.message };
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const token_ws = formData.get('token_ws') as string
    const TBK_TOKEN = formData.get('TBK_TOKEN') as string

    console.log('🔄 Respuesta de Webpay recibida:', { 
      token_ws: token_ws ? `PRESENTE (${token_ws.substring(0, 10)}...)` : 'AUSENTE', 
      TBK_TOKEN: TBK_TOKEN ? `PRESENTE (${TBK_TOKEN.substring(0, 10)}...)` : 'AUSENTE' 
    })

    // CASO 1: Pago cancelado por el usuario
    if (TBK_TOKEN && !token_ws) {
      console.log('❌ Pago ABORTADO por el usuario con TBK_TOKEN:', TBK_TOKEN)
      
      const orders = await query(
        `SELECT * FROM orders WHERE transbank_session_id = ?`,
        [TBK_TOKEN]
      ) as any[]

      if (orders.length > 0) {
        const order = orders[0]
        
        await query(
          'DELETE FROM stock_reservations WHERE user_id = ?',
          [order.user_id]
        );
        
        await query(
          `UPDATE orders SET 
            payment_status = 'failed',
            status = 'cancelled',
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
          [order.id]
        )
        
        return NextResponse.redirect(
          `${process.env.NEXTAUTH_URL}/order-success?orderId=${order.id}&status=cancelled`
        )
      } else {
        return NextResponse.redirect(
          `${process.env.NEXTAUTH_URL}/order-success?status=cancelled&message=order_not_found`
        )
      }
    }

    // CASO 2: Pago exitoso
    if (token_ws && !TBK_TOKEN) {
      console.log('💰 Procesando pago EXITOSO con token_ws')
      
      try {
        const commitResponse = await transbankService.commitTransaction(token_ws)
        
        const orders = await query(
          `SELECT * FROM orders WHERE transbank_buy_order = ?`,
          [commitResponse.buy_order]
        ) as any[]

        if (orders.length === 0) {
          return NextResponse.redirect(
            `${process.env.NEXTAUTH_URL}/order-success?status=error&message=order_not_found`
          )
        }

        const order = orders[0]

        if (transbankService.isTransactionApproved(commitResponse)) {
          
          if (order.payment_status !== 'paid') {
            console.log('✅ Procesando pago exitoso - DESCONTANDO STOCK')
            
            // Descontar stock
            const orderItems = await query(
              `SELECT product_id, quantity FROM order_items WHERE order_id = ?`,
              [order.id]
            ) as any[];
            
            for (const item of orderItems) {
              await query(
                `UPDATE products 
                 SET stock = stock - ?,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = ? AND stock >= ?`,
                [item.quantity, item.product_id, item.quantity]
              );
            }
            
            // Eliminar reservas
            await query(
              'DELETE FROM stock_reservations WHERE user_id = ?',
              [order.user_id]
            );

            // ========== EMITIR BOLETA ==========
            console.log('📄 Emitiendo boleta electrónica...');
            const resultadoBoleta = await emitirBoleta(order.id);
            
            let pdfBuffer = null;
            let folio = null;
            
            if (resultadoBoleta.success) {
              folio = resultadoBoleta.folio;
              console.log('✅ Boleta emitida, folio:', folio);
              
              // Obtener el PDF de la boleta
              pdfBuffer = await obtenerPDFBoleta(folio);
              if (pdfBuffer) {
                console.log('✅ PDF de boleta obtenido correctamente');
              } else {
                console.warn('⚠️ No se pudo obtener el PDF de la boleta');
              }
            } else {
              console.error('⚠️ Error emitiendo boleta:', resultadoBoleta.error);
            }

            // ========== ENVIAR EMAIL CON BOLETA ==========
            try {
              // Obtener datos completos para el email
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
                
                // Calcular el IVA incluido correctamente
                const subtotalConIVA = parseFloat(firstItem.subtotal);
                const subtotalNeto = Math.round(subtotalConIVA / 1.19);
                const ivaIncluido = subtotalConIVA - subtotalNeto;
                
                // Preparar datos para sendBoletaEmail
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
                    quantity: item.quantity
                  })),
                  subtotal: subtotalConIVA, // Ya incluye IVA
                  discount: parseFloat(firstItem.discount || 0),
                  shipping: parseFloat(firstItem.shipping || 0),
                  tax: ivaIncluido, // IVA incluido (para desglose)
                  total: parseFloat(firstItem.total),
                  shippingAddress: {
                    street: firstItem.shipping_street || 'No especificada',
                    commune_name: firstItem.shipping_commune || 'No especificada',
                    region_name: firstItem.shipping_region || 'No especificada',
                    postal_code: firstItem.shipping_postal_code || '000000'
                  },
                  storeInfo: {
                    name: "Zorro Lúdico",
                    rut: process.env.SIMPLEFACTURA_RUT_EMISOR || "78181331-1",
                    giro: "Venta de juegos",
                    direccion: "Calle 7 numero 3",
                    comuna: "Santiago",
                    ciudad: "Santiago"
                  }
                };

                // Enviar email con la boleta PDF (los 3 argumentos requeridos)
                if (pdfBuffer && folio) {
                  await sendBoletaEmail(emailData, pdfBuffer, folio);
                  console.log('📧 Email con boleta PDF enviado a:', firstItem.customer_email);
                } else {
                  // Si no hay PDF, enviar solo confirmación sin boleta
                  console.warn('⚠️ No se pudo enviar boleta PDF, enviando solo confirmación');
                  // Enviar email sin PDF (pasar null o un buffer vacío)
                  await sendBoletaEmail(emailData, Buffer.from(''), 'SIN_FOLIO');
                }
              }
            } catch (emailError) {
              console.error('❌ Error enviando email:', emailError);
            }
          }

          // Actualizar estado de la orden
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
              commitResponse.transaction_date,
              order.id
            ]
          )

          console.log('✅ Pago APROBADO para orden:', order.id)

          return NextResponse.redirect(
            `${process.env.NEXTAUTH_URL}/order-success?orderId=${order.id}&status=success`
          )

        } else {
          // Pago rechazado
          const rejectionReason = transbankService.getResponseCodeDescription(commitResponse.response_code)
          
          await query(
            'DELETE FROM stock_reservations WHERE user_id = ?',
            [order.user_id]
          );
          
          await query(
            `UPDATE orders SET 
              payment_status = 'failed',
              status = 'cancelled',
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
            [order.id]
          )

          return NextResponse.redirect(
            `${process.env.NEXTAUTH_URL}/order-success?orderId=${order.id}&status=error&message=payment_rejected&reason=${encodeURIComponent(rejectionReason)}`
          )
        }

      } catch (commitError: any) {
        console.error('❌ Error confirmando pago:', commitError)
        return NextResponse.redirect(
          `${process.env.NEXTAUTH_URL}/order-success?status=error&message=payment_failed`
        )
      }
    }

    // CASO 3: Tokens inválidos
    console.error('❌ Tokens inválidos o ausentes')
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/order-success?status=error&message=invalid_tokens`
    )

  } catch (error: any) {
    console.error('❌ Error CRÍTICO:', error)
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/order-success?status=error&message=processing_error`
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
  
  return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/`)
}