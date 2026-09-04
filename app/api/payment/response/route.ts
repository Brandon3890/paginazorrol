// app/api/payment/response/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { transbankService } from '@/lib/transbank-service'
import { query } from '@/lib/db'

async function descontarStock(orderId: number) {
  try {
    const orderItems = await query(
      `SELECT product_id, quantity FROM order_items WHERE order_id = ?`,
      [orderId]
    ) as any[];

    if (!orderItems || orderItems.length === 0) {
      return true;
    }

    console.log(` Procesando ${orderItems.length} productos`);

    const [orderInfo] = await query(
      `SELECT user_id FROM orders WHERE id = ?`,
      [orderId]
    ) as any[];

    const userId = orderInfo?.user_id;

    //  DEVOLVER STOCK DE LA RESERVA (si existe)
    if (userId) {
      console.log(` Devolviendo stock de reserva para usuario: ${userId}`);
      
      const reservations = await query(
        `SELECT product_id, quantity FROM stock_reservations WHERE user_id = ? AND expires_at > NOW()`,
        [userId]
      ) as any[];

      if (reservations && reservations.length > 0) {
        for (const res of reservations) {
          await query(
            `UPDATE products 
             SET stock = stock + ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [res.quantity, res.product_id]
          );
        }

        await query(
          'DELETE FROM stock_reservations WHERE user_id = ?',
          [userId]
        );
      }
    }

    // 2️ DESCONTAR STOCK DEFINITIVO
    for (const item of orderItems) {
      const [productCheck] = await query(
        `SELECT stock, name FROM products WHERE id = ?`,
        [item.product_id]
      ) as any[];

      if (!productCheck) {
        console.warn(` Producto ${item.product_id} no encontrado, saltando...`);
        continue;
      }

      const stockActual = productCheck.stock;
      const nuevaCantidad = stockActual - item.quantity;

      if (nuevaCantidad < 0) {
        console.error(` Stock insuficiente para producto ${item.product_id}. Stock: ${stockActual}, Solicitado: ${item.quantity}`);
        continue;
      }

      await query(
        `UPDATE products 
         SET stock = ?,
             in_stock = CASE WHEN ? > 0 THEN 1 ELSE 0 END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [nuevaCantidad, nuevaCantidad, item.product_id]
      );
    }

    console.log('Proceso de stock completado exitosamente');
    return true;

  } catch (error) {
    console.error(' Error procesando stock:', error);
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
      console.log('No hay reservas activas para el usuario')
      return true
    }
    
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
      } else {
        console.warn(' Producto no encontrado')
      }
    }
    
    await query(
      'DELETE FROM stock_reservations WHERE user_id = ?',
      [userId]
    )
    console.log(' Reservas eliminadas para usuario', userId)
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

    // ============================================================
    // CASO 1: Pago ABORTADO por el usuario
    // ============================================================
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

    // ============================================================
    // CASO 2: Pago EXITOSO - SOLO PROCESAR EL PAGO (NO EMITIR BOLETA)
    // ============================================================
    if (token_ws && !TBK_TOKEN) {
      console.log('Procesando pago EXITOSO')
      
      try {
        // Confirmar la transacción con Transbank
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

        // ============================================================
        // VALIDACIÓN: Solo procesar si el pago está APROBADO
        // ============================================================
        const isApproved = transbankService.isTransactionApproved(commitResponse)
        
        if (isApproved) {
          
          // Verificar si la orden ya fue procesada
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
          
          // ============================================================
          //  PAGO APROBADO - SOLO PROCESAR EL PAGO
          // ============================================================
          console.log(' Pago APROBADO - Procesando pedido');

          //  DESCONTAR STOCK
          await descontarStock(order.id);

          // 2️ELIMINAR RESERVAS DE STOCK
          if (order.user_id) {
            await query(
              'DELETE FROM stock_reservations WHERE user_id = ?',
              [order.user_id]
            );
          }

          // ACTUALIZAR ESTADO DE LA ORDEN A "PAID"
          // IMPORTANTE: NO SE EMITE BOLETA AQUÍ, SE HARÁ EN ORDER-SUCCESS
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
              transbank_transaction_date = ?
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

          console.log('Pago APROBADO - Redirigiendo a order-success')

          const redirectUrl = new URL('/order-success', process.env.NEXTAUTH_URL)
          redirectUrl.searchParams.set('orderId', order.id.toString())
          redirectUrl.searchParams.set('status', 'success')
          
          console.log('Redirigiendo a:', redirectUrl.toString())
          
          return NextResponse.redirect(redirectUrl)

        } else {
          // ============================================================
          // PAGO RECHAZADO - NO SE PROCESA
          // ============================================================
          const rejectionReason = transbankService.getResponseCodeDescription(commitResponse.response_code)
          console.log(' Pago RECHAZADO:', rejectionReason)
          
          if (order.user_id) {
            await liberarStock(order.user_id)
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

    console.error(' Tokens invalidos o ausentes')
    const redirectUrl = new URL('/order-success', process.env.NEXTAUTH_URL)
    redirectUrl.searchParams.set('status', 'error')
    redirectUrl.searchParams.set('message', 'invalid_tokens')
    
    return NextResponse.redirect(redirectUrl)

  } catch (error: any) {
    console.error(' Error CRITICO:', error)
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