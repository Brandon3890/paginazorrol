import { NextRequest, NextResponse } from 'next/server'
import { transbankService } from '@/lib/transbank-service'
import { query } from '@/lib/db'

// CONFIRMAR RESERVA 
async function confirmarReserva(orderId: number) {
  try {
    // Obtener info de la orden
    const [orderInfo] = await query(
      `SELECT user_id, customer_email, customer_rut FROM orders WHERE id = ?`,
      [orderId]
    ) as any[];

    if (!orderInfo) {
      console.log('Orden no encontrada');
      return false;
    }

    const userId = orderInfo?.user_id;
    const customerEmail = orderInfo?.customer_email;

    console.log(`Confirmando reserva para orden`);

    let reservations: any[] = [];

    // Si es usuario registrado, buscar por user_id
    if (userId) {
      reservations = await query(
        `SELECT id, product_id, quantity, identifier FROM stock_reservations 
         WHERE user_id = ? AND expires_at > NOW()`,
        [userId]
      ) as any[];

      if (reservations.length > 0) {
        console.log(`reservas encontradas`);
      }
    }

    // Si no hay, buscar por identifier del invitado usando guest_orders
    if (reservations.length === 0) {
      const guestOrders = await query(
        `SELECT guest_session_id FROM guest_orders WHERE order_id = ?`,
        [orderId]
      ) as any[];

      if (guestOrders.length > 0) {
        const guestSessionId = guestOrders[0].guest_session_id;
        const identifier = `guest_${guestSessionId}`;

        reservations = await query(
          `SELECT id, product_id, quantity, identifier FROM stock_reservations 
           WHERE identifier = ? AND expires_at > NOW()`,
          [identifier]
        ) as any[];

        if (reservations.length > 0) {
          console.log(` ${reservations.length} reservas encontradas por el identificador`);
        }
      }
    }

    //  Si aún no hay, buscar por identifier basado en user_id (invitados sin guest_orders)
    if (reservations.length === 0 && userId) {
      reservations = await query(
        `SELECT id, product_id, quantity, identifier FROM stock_reservations 
         WHERE identifier LIKE 'guest_%' AND user_id = ? AND expires_at > NOW()`,
        [userId]
      ) as any[];

      if (reservations.length > 0) {
        console.log(` ${reservations.length} reservas encontradas por user_id invitado`);
      }
    }

    if (reservations.length === 0) {
      console.log('No hay reservas activas para confirmar');
      return true;
    }

    // 5. Eliminar reservas confirmadas (el stock ya estaba descontado en el carrito)
    for (const res of reservations) {
      await query('DELETE FROM stock_reservations WHERE id = ?', [res.id]);
    }

    console.log(`${reservations.length} reservas confirmadas (eliminadas)`);
    return true;

  } catch (error) {
    console.error('Error confirmando reserva:', error);
    return false;
  }
}

// LIBERAR STOCK
async function liberarStock(orderId: number) {
  try {
    const [orderInfo] = await query(
      `SELECT user_id, customer_email, customer_rut FROM orders WHERE id = ?`,
      [orderId]
    ) as any[];

    if (!orderInfo) {
      console.log(' Orden no encontrada');
      return false;
    }

    const userId = orderInfo?.user_id;
    const customerEmail = orderInfo?.customer_email;

    let reservations: any[] = [];

    // Buscar por user_id
    if (userId) {
      reservations = await query(
        `SELECT id, product_id, quantity FROM stock_reservations 
         WHERE user_id = ? AND expires_at > NOW()`,
        [userId]
      ) as any[];
      
      if (reservations.length > 0) {
        console.log(` ${reservations.length} reservas encontradas por usuario`);
      }
    }

    // Buscar por identifier del invitado
    if (reservations.length === 0) {
      const guestOrders = await query(
        `SELECT guest_session_id FROM guest_orders WHERE order_id = ?`,
        [orderId]
      ) as any[];
      
      if (guestOrders.length > 0) {
        const guestSessionId = guestOrders[0].guest_session_id;
        const identifier = `guest_${guestSessionId}`;
        
        reservations = await query(
          `SELECT id, product_id, quantity FROM stock_reservations 
           WHERE identifier = ? AND expires_at > NOW()`,
          [identifier]
        ) as any[];
        
        if (reservations.length > 0) {
          console.log(` ${reservations.length} reservas encontradas por el identificador`);
        }
      }
    }

    // 3. Buscar por identifier basado en user_id invitado
    if (reservations.length === 0 && userId) {
      reservations = await query(
        `SELECT id, product_id, quantity FROM stock_reservations 
         WHERE identifier LIKE 'guest_%' AND user_id = ? AND expires_at > NOW()`,
        [userId]
      ) as any[];

      if (reservations.length > 0) {
        console.log(` ${reservations.length} reservas encontradas por user_id invitado`);
      }
    }

    if (reservations.length === 0) {
      console.log('No hay reservas activas para liberar');
      return true;
    }
    
    console.log(`Liberando ${reservations.length} reservas`);
    
    // Devolver stock
    for (const res of reservations) {
      await query(
        `UPDATE products SET stock = stock + ? WHERE id = ?`,
        [res.quantity, res.product_id]
      );
      console.log(`Stock devuelto al producto`);
    }
    
    // Eliminar reservas
    for (const res of reservations) {
      await query('DELETE FROM stock_reservations WHERE id = ?', [res.id]);
    }
    
    console.log(' Reservas eliminadas y stock devuelto');
    return true;
    
  } catch (error) {
    console.error('Error liberando stock:', error);
    return false;
  }
}

//  USAR CUPÓN
async function usarCupon(orderId: number) {
  try {
    const [order] = await query(
      `SELECT coupon_id FROM orders WHERE id = ?`,
      [orderId]
    ) as any[]

    if (!order || !order.coupon_id) {
      console.log('No hay cupón asociado a esta orden')
      return true
    }

    console.log(`Usando cupón `)

    const [coupon] = await query(
      `SELECT id, current_uses, max_uses, is_active FROM coupons WHERE id = ?`,
      [order.coupon_id]
    ) as any[]

    if (!coupon) {
      console.log(`Cupón  no encontrado`)
      return false
    }

    if (!coupon.is_active) {
      console.log(`Cupón  está inactivo`)
      return false
    }

    if (coupon.current_uses >= coupon.max_uses) {
      console.log(`Cupón ya alcanzó su límite de usos`)
      return false
    }

    await query(
      `UPDATE coupons 
       SET current_uses = current_uses + 1, 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = ? AND current_uses < max_uses`,
      [order.coupon_id]
    )

    console.log(` Cupón usado exitosamente `)
    return true

  } catch (error) {
    console.error('Error usando cupón:', error)
    return false
  }
}

// LIMPIAR RESERVAS EXPIRADAS
async function limpiarReservasExpiradas() {
  try {
    const expiredReservations = await query(
      `SELECT product_id, quantity FROM stock_reservations WHERE expires_at < NOW()`
    ) as any[]

    if (expiredReservations && expiredReservations.length > 0) {
      console.log(`Devolviendo stock de ${expiredReservations.length} reservas expiradas...`)
      
      for (const res of expiredReservations) {
        await query(
          `UPDATE products 
           SET stock = stock + ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [res.quantity, res.product_id]
        )
        console.log(`Stock devuelto para el producto `)
      }
      
      await query('DELETE FROM stock_reservations WHERE expires_at < NOW()')
      console.log('Reservas expiradas eliminadas y stock devuelto')
    }
    
    return true
  } catch (error) {
    console.error('Error limpiando reservas expiradas:', error)
    return false
  }
}

// POST - PROCESAR RESPUESTA DE PAGO
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const token_ws = formData.get('token_ws') as string
    const TBK_TOKEN = formData.get('TBK_TOKEN') as string

    await limpiarReservasExpiradas()

    //  Pago ABORTADO
    if (TBK_TOKEN && !token_ws) {
      console.log('Pago ABORTADO por el usuario')
      
      const orders = await query(
        `SELECT * FROM orders WHERE transbank_session_id = ?`,
        [TBK_TOKEN]
      ) as any[]

      if (orders.length > 0) {
        const order = orders[0]
        console.log(`Orden abortado`)
        await liberarStock(order.id);
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
      }
    }

    // Pago EXITOSO
    if (token_ws && !TBK_TOKEN) {
      console.log(' Procesando pago EXITOSO')
      
      try {
        const commitResponse = await transbankService.commitTransaction(token_ws)
        
        const orders = await query(
          `SELECT * FROM orders WHERE transbank_buy_order = ?`,
          [commitResponse.buy_order]
        ) as any[]

        if (orders.length === 0) {
          console.log('Orden no encontrada para orden')
          const redirectUrl = new URL('/order-success', process.env.NEXTAUTH_URL)
          redirectUrl.searchParams.set('status', 'error')
          redirectUrl.searchParams.set('message', 'order_not_found')
          return NextResponse.redirect(redirectUrl)
        }

        const order = orders[0]
        console.log(`Orden Procesada respuesta de pago`)

        const isApproved = transbankService.isTransactionApproved(commitResponse)
        
        if (isApproved) {
          const [orderCheck] = await query(
            `SELECT payment_status, status FROM orders WHERE id = ?`,
            [order.id]
          ) as any[]
          
          if (orderCheck && orderCheck.payment_status === 'paid') {
            console.log(` Orden ya fue procesada, saltando...`)
            const redirectUrl = new URL('/order-success', process.env.NEXTAUTH_URL)
            redirectUrl.searchParams.set('orderId', order.id.toString())
            redirectUrl.searchParams.set('status', 'success')
            return NextResponse.redirect(redirectUrl)
          }
          
          console.log(` Pago APROBADO - Procesando pedido `);

          // CONFIRMAR RESERVA (eliminar reservas, stock ya descontado)
          await confirmarReserva(order.id);

          // USAR CUPÓN
          await usarCupon(order.id);

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
              boleta_emitida = 0
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


          const redirectUrl = new URL('/order-success', process.env.NEXTAUTH_URL)
          redirectUrl.searchParams.set('orderId', order.id.toString())
          redirectUrl.searchParams.set('status', 'success')
          redirectUrl.searchParams.set('processing', 'true')
          
          return NextResponse.redirect(redirectUrl)

        } else {
          const rejectionReason = transbankService.getResponseCodeDescription(commitResponse.response_code)
          console.log(` Pago RECHAZADO para orden`)
          
          await liberarStock(order.id);
          
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
        console.error(' Error confirmando pago:', commitError)
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

// MANEJAR REDIRECT DE TRANSBANK
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