// app/api/payment/create/route.ts - USANDO EL NUEVO SISTEMA
import { NextRequest, NextResponse } from 'next/server'
import { transbankService } from '@/lib/transbank-service'
import { orderNumberService } from '@/lib/order-number-service'
import { query } from '@/lib/db'
import { getUserIdFromRequest } from '@/lib/auth-utils'

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request)
    
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { orderId, amount } = body

    if (!orderId || !amount) {
      return NextResponse.json(
        { error: 'Faltan datos requeridos: orderId y amount' },
        { status: 400 }
      )
    }

    // Verificar que la orden existe y pertenece al usuario
    const orders = await query(
      `SELECT * FROM orders WHERE id = ? AND user_id = ?`,
      [orderId, userId]
    ) as any[]

    if (orders.length === 0) {
      return NextResponse.json(
        { error: 'Orden no encontrada' },
        { status: 404 }
      )
    }

    const order = orders[0]
    
    console.log('📋 Orden original:', {
      id: order.id,
      currentOrderNumber: order.order_number,
      currentStatus: order.status
    })
    
    // GENERAR NUEVO ORDER_NUMBER ÚNICO (completamente independiente de Transbank)
    const newOrderNumber = orderNumberService.generateOrderNumber()
    // O usa esta alternativa más corta:
    // const newOrderNumber = orderNumberService.generateSimpleOrderNumber()
    
    // Generar datos ÚNICOS para Transbank (completamente diferentes)
    const transbankBuyOrder = transbankService.generateBuyOrder()
    const sessionId = transbankService.generateSessionId()
    const returnUrl = `${process.env.NEXTAUTH_URL}/api/payment/response`

    console.log('🎯 COMPARACIÓN DE NÚMEROS:', {
      'Nuestro Order Number': newOrderNumber,
      'Transbank Buy Order': transbankBuyOrder,
      '¿Son diferentes?': newOrderNumber !== transbankBuyOrder,
      'Longitud nuestro': newOrderNumber.length,
      'Longitud Transbank': transbankBuyOrder.length
    })

    // ACTUALIZAR LA ORDEN CON EL NUEVO ORDER_NUMBER Y DATOS DE TRANSBANK
    const updateResult = await query(
      `UPDATE orders SET 
        order_number = ?,
        transbank_buy_order = ?,
        transbank_session_id = ?,
        transbank_amount = ?,
        transbank_return_url = ?,
        payment_status = 'pending',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [newOrderNumber, transbankBuyOrder, sessionId, amount, returnUrl, orderId]
    ) as any

    console.log('✅ Orden actualizada en BD:', {
      affectedRows: updateResult.affectedRows,
      newOrderNumber: newOrderNumber,
      orderId: orderId
    })

    // VERIFICACIÓN FINAL - Leer la orden actualizada
    const updatedOrders = await query(
      `SELECT order_number, transbank_buy_order FROM orders WHERE id = ?`,
      [orderId]
    ) as any[]

    if (updatedOrders.length > 0) {
      const updatedOrder = updatedOrders[0]
      console.log('🔍 VERIFICACIÓN FINAL:', {
        'Número de Orden (Nuestro)': updatedOrder.order_number,
        'Buy Order (Transbank)': updatedOrder.transbank_buy_order,
        '¿SON DIFERENTES?': updatedOrder.order_number !== updatedOrder.transbank_buy_order,
        'Formato nuestro válido': orderNumberService.isValidOrderNumber(updatedOrder.order_number),
        'Fecha del pedido': orderNumberService.extractDate(updatedOrder.order_number)?.toISOString()
      })
    }

    // Crear transacción en Transbank
    const transaction = await transbankService.createTransaction({
      buy_order: transbankBuyOrder,
      session_id: sessionId,
      amount: amount,
      return_url: returnUrl
    })

    console.log('✅ Transacción Webpay creada exitosamente')

    return NextResponse.json({
      success: true,
      token: transaction.token,
      url: transaction.url,
      orderNumber: newOrderNumber,
      transbankBuyOrder: transbankBuyOrder,
      sessionId: sessionId,
      orderId: orderId
    })

  } catch (error: any) {
    console.error('❌ Error creando transacción Webpay:', error)
    return NextResponse.json(
      { 
        error: 'Error interno del servidor al crear transacción',
        details: error.message 
      },
      { status: 500 }
    )
  }
}