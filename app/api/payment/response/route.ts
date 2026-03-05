// app/api/payment/response/route.ts - VERSIÓN CON ACTUALIZACIÓN DE STOCK SOLO EN PAGO EXITOSO
import { NextRequest, NextResponse } from 'next/server'
import { transbankService } from '@/lib/transbank-service'
import { query } from '@/lib/db'
import { sendOrderConfirmationEmail } from '@/lib/email-service';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const token_ws = formData.get('token_ws') as string
    const TBK_TOKEN = formData.get('TBK_TOKEN') as string

    console.log('🔄 Respuesta de Webpay recibida:', { 
      token_ws: token_ws ? `PRESENTE (${token_ws.substring(0, 10)}...)` : 'AUSENTE', 
      TBK_TOKEN: TBK_TOKEN ? `PRESENTE (${TBK_TOKEN.substring(0, 10)}...)` : 'AUSENTE' 
    })

    // CASO 1: Pago cancelado por el usuario (TBK_TOKEN presente)
    if (TBK_TOKEN && !token_ws) {
      console.log('❌ Pago ABORTADO por el usuario con TBK_TOKEN:', TBK_TOKEN)
      
      // Buscar la orden por session_id (TBK_TOKEN es el session_id)
      const orders = await query(
        `SELECT * FROM orders WHERE transbank_session_id = ?`,
        [TBK_TOKEN]
      ) as any[]

      if (orders.length > 0) {
        const order = orders[0]
        console.log('📋 Orden encontrada para cancelación:', {
          orderId: order.id,
          orderNumber: order.order_number,
          transbankBuyOrder: order.transbank_buy_order,
          amount: order.transbank_amount
        })
        
        // Actualizar la orden como CANCELADA - NO ACTUALIZAR STOCK
        await query(
          `UPDATE orders SET 
            payment_status = 'failed',
            status = 'cancelled',
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
          [order.id]
        )
        
        console.log('✅ Orden marcada como cancelada:', order.id)
        console.log('📦 Stock NO actualizado - pago cancelado por usuario')
        
        // Redirigir a página de cancelación
        return NextResponse.redirect(
          `${process.env.NEXTAUTH_URL}/order-success?orderId=${order.id}&status=cancelled`
        )
      } else {
        console.error('❌ Orden no encontrada para session_id:', TBK_TOKEN)
        return NextResponse.redirect(
          `${process.env.NEXTAUTH_URL}/order-success?status=cancelled&message=order_not_found`
        )
      }
    }

    // CASO 2: Pago exitoso (token_ws presente)
    if (token_ws && !TBK_TOKEN) {
      console.log('💰 Procesando pago EXITOSO con token_ws:', token_ws.substring(0, 20) + '...')
      
      try {
        // Confirmar transacción con Transbank
        const commitResponse = await transbankService.commitTransaction(token_ws)
        console.log('📊 Respuesta de commit Transbank:', {
          status: commitResponse.status,
          response_code: commitResponse.response_code,
          buy_order: commitResponse.buy_order,
          amount: commitResponse.amount,
          authorization_code: commitResponse.authorization_code
        })

        // Buscar la orden por buy_order de Transbank
        const orders = await query(
          `SELECT * FROM orders WHERE transbank_buy_order = ?`,
          [commitResponse.buy_order]
        ) as any[]

        if (orders.length > 0) {
          const order = orders[0]
          console.log('📋 Orden encontrada para confirmación:', {
            orderId: order.id,
            orderNumber: order.order_number,
            transbankBuyOrder: order.transbank_buy_order,
            amount: order.transbank_amount,
            currentStatus: order.status,
            paymentStatus: order.payment_status
          })
                    
          // VERIFICAR ESTADO CON EL MÉTODO MEJORADO
          if (transbankService.isTransactionApproved(commitResponse)) {
            // Pago EXITOSO - APROBADO POR TRANSBANK
            
            // VERIFICAR QUE LA ORDEN NO ESTÉ YA MARCADA COMO PAGADA (EVITAR DUPLICADOS)
            if (order.payment_status === 'paid') {
              console.log('⚠️ Orden ya estaba marcada como pagada, evitando duplicación')
            } else {
              console.log('✅ Procesando pago exitoso por primera vez')
              
              // ACTUALIZAR STOCK DE PRODUCTOS
              try {
                console.log('📦 Descontando stock por pago exitoso...')
                
                // Obtener los items de la orden
                const orderItems = await query(
                  `SELECT product_id, quantity FROM order_items WHERE order_id = ?`,
                  [order.id]
                ) as any[];
                
                console.log(`📊 Productos a actualizar stock:`, orderItems)
                
                // Actualizar stock para cada producto
                for (const item of orderItems) {
                  const result: any = await query(
                    `UPDATE products 
                     SET stock = GREATEST(0, stock - ?), 
                         in_stock = (stock - ?) > 0,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE id = ?`,
                    [item.quantity, item.quantity, item.product_id]
                  );
                  
                  if (result.affectedRows > 0) {
                    console.log(`✅ Stock actualizado para producto ${item.product_id}: -${item.quantity} unidades`)
                  } else {
                    console.warn(`⚠️ No se pudo actualizar stock para producto ${item.product_id}`)
                  }
                }
                
                console.log('🎯 Stock actualizado exitosamente para todos los productos')
              } catch (stockError) {
                console.error('❌ Error actualizando stock:', stockError);
              }

              // ENVIAR EMAIL DE CONFIRMACIÓN
              try {
                  console.log('📧 Preparando envío de email de confirmación...')
                  
                  // Obtener información completa de la orden para el email
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
                    WHERE o.id = ?`,
                    [order.id]
                  ) as any[];

                  if (orderDetails.length > 0) {
                    const firstItem = orderDetails[0];
                    
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

                    console.log('📧 Enviando email de confirmación a:', firstItem.customer_email);
                    
                    const emailSent = await sendOrderConfirmationEmail(emailData);
                    
                    if (emailSent) {
                      console.log('✅ Email de confirmación enviado exitosamente');
                    } else {
                      console.warn('⚠️ No se pudo enviar el email de confirmación');
                    }
                  }
                } catch (emailError) {
                  console.error('❌ Error enviando email de confirmación:', emailError);
                  // No bloquear el flujo por error de email
                }
            }

            // Actualizar estado de la orden a PAGADO
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

            console.log('✅ Pago APROBADO por Transbank para orden:', order.id)

            // Redirigir a página de éxito
            return NextResponse.redirect(
              `${process.env.NEXTAUTH_URL}/order-success?orderId=${order.id}&status=success`
            )
          } else {
            // Pago RECHAZADO por Transbank
            const rejectionReason = transbankService.getResponseCodeDescription(commitResponse.response_code)
            console.log('❌ Pago RECHAZADO por Transbank:', {
              reason: rejectionReason,
              status: commitResponse.status,
              response_code: commitResponse.response_code
            })
            
            // NO ACTUALIZAR STOCK - PAGO RECHAZADO
            await query(
              `UPDATE orders SET 
                payment_status = 'failed',
                status = 'cancelled',
                transbank_authorization_code = ?,
                updated_at = CURRENT_TIMESTAMP
              WHERE id = ?`,
              [commitResponse.authorization_code || 'REJECTED', order.id]
            )

            console.log('📦 Stock NO actualizado - pago rechazado por Transbank')

            return NextResponse.redirect(
              `${process.env.NEXTAUTH_URL}/order-success?orderId=${order.id}&status=error&message=payment_rejected&reason=${encodeURIComponent(rejectionReason)}`
            )
          }
        } else {
          console.error('❌ Orden no encontrada para buy_order:', commitResponse.buy_order)
          
          // Intentar buscar por token como fallback
          const fallbackOrders = await query(
            `SELECT * FROM orders WHERE transbank_token = ?`,
            [token_ws]
          ) as any[]
          
          if (fallbackOrders.length > 0) {
            const fallbackOrder = fallbackOrders[0]
            console.log('🔍 Orden encontrada por token fallback:', fallbackOrder.id)
            return NextResponse.redirect(
              `${process.env.NEXTAUTH_URL}/order-success?orderId=${fallbackOrder.id}&status=error&message=order_mismatch`
            )
          }
          
          return NextResponse.redirect(
            `${process.env.NEXTAUTH_URL}/order-success?status=error&message=order_not_found`
          )
        }

      } catch (commitError: any) {
        console.error('❌ Error confirmando pago con Transbank:', {
          error: commitError.message,
          token: token_ws.substring(0, 20) + '...'
        })
        
        // NO ACTUALIZAR STOCK - ERROR EN CONFIRMACIÓN
        console.log('📦 Stock NO actualizado - error en confirmación de pago')
        
        // Intentar encontrar la orden para redirigir con orderId
        let orderId = null
        let orderNumber = null
        try {
          // Buscar por token primero
          const ordersByToken = await query(
            `SELECT * FROM orders WHERE transbank_token = ?`,
            [token_ws]
          ) as any[]
          
          if (ordersByToken.length > 0) {
            orderId = ordersByToken[0].id
            orderNumber = ordersByToken[0].order_number
          } else {
            // Buscar por session_id como último recurso
            const statusResponse = await transbankService.getTransactionStatus(token_ws)
            if (statusResponse.session_id) {
              const ordersBySession = await query(
                `SELECT * FROM orders WHERE transbank_session_id = ?`,
                [statusResponse.session_id]
              ) as any[]
              if (ordersBySession.length > 0) {
                orderId = ordersBySession[0].id
                orderNumber = ordersBySession[0].order_number
              }
            }
          }
        } catch (searchError) {
          console.error('Error en búsqueda de orden fallback:', searchError)
        }
        
        return NextResponse.redirect(
          `${process.env.NEXTAUTH_URL}/order-success?orderId=${orderId || ''}&status=error&message=payment_failed`
        )
      }
    }

    // CASO 3: Ambos tokens presentes (situación inesperada)
    if (token_ws && TBK_TOKEN) {
      console.error('⚠️ Situación inesperada: Ambos tokens presentes', {
        token_ws: token_ws.substring(0, 10) + '...',
        TBK_TOKEN: TBK_TOKEN.substring(0, 10) + '...'
      })
      
      // Priorizar TBK_TOKEN (cancelación del usuario)
      const orders = await query(
        `SELECT * FROM orders WHERE transbank_session_id = ?`,
        [TBK_TOKEN]
      ) as any[]

      if (orders.length > 0) {
        // NO ACTUALIZAR STOCK - CANCELACIÓN
        await query(
          `UPDATE orders SET 
            payment_status = 'failed',
            status = 'cancelled',
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
          [orders[0].id]
        )
        
        console.log('📦 Stock NO actualizado - situación inesperada con ambos tokens')
        
        return NextResponse.redirect(
          `${process.env.NEXTAUTH_URL}/order-success?orderId=${orders[0].id}&status=cancelled&message=unexpected_tokens`
        )
      }
    }

    // CASO 4: Tokens inválidos o ausentes
    console.error('❌ Tokens inválidos o ausentes:', { 
      token_ws: token_ws ? 'PRESENTE' : 'AUSENTE', 
      TBK_TOKEN: TBK_TOKEN ? 'PRESENTE' : 'AUSENTE' 
    })
    
    console.log('📦 Stock NO actualizado - tokens inválidos')
    
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/order-success?status=error&message=invalid_tokens`
    )

  } catch (error: any) {
    console.error('❌ Error CRÍTICO procesando respuesta de Webpay:', {
      error: error.message,
      stack: error.stack
    })
    
    console.log('📦 Stock NO actualizado - error crítico')
    
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/order-success?status=error&message=processing_error`
    )
  }
}

// Manejar GET para redirecciones directas
export async function GET(request: NextRequest) {
  console.log('📥 GET recibido en /api/payment/response')
  
  const searchParams = request.nextUrl.searchParams
  const token_ws = searchParams.get('token_ws')
  const TBK_TOKEN = searchParams.get('TBK_TOKEN')
  
  if (token_ws || TBK_TOKEN) {
    console.log('🔄 Reenviando parámetros GET a POST:', {
      token_ws: token_ws ? 'PRESENTE' : 'AUSENTE',
      TBK_TOKEN: TBK_TOKEN ? 'PRESENTE' : 'AUSENTE'
    })
    
    // Reenviar a POST con los parámetros
    const formData = new FormData()
    if (token_ws) formData.append('token_ws', token_ws)
    if (TBK_TOKEN) formData.append('TBK_TOKEN', TBK_TOKEN)
    
    return POST(new NextRequest(request.nextUrl, {
      method: 'POST',
      body: formData
    }))
  }
  
  // Si no hay tokens, redirigir al inicio
  console.log('🔀 Redirigiendo al inicio - sin tokens')
  return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/`)
}