// app/api/orders/normalize/route.ts - NUEVO ARCHIVO
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { transbankService } from '@/lib/transbank-service'

export async function POST() {
  try {
    // Obtener todas las órdenes que necesitan normalización
    const orders = await query(
      `SELECT id, order_number, transbank_buy_order 
       FROM orders 
       WHERE order_number = transbank_buy_order 
          OR transbank_buy_order IS NULL 
          OR order_number LIKE 'TBK%'`
    ) as any[]

    console.log(`🔄 Normalizando ${orders.length} órdenes...`)

    let updatedCount = 0

    for (const order of orders) {
      // Generar nuevo order_number si es necesario
      let newOrderNumber = order.order_number
      
      if (order.order_number === order.transbank_buy_order || 
          order.order_number.startsWith('TBK') ||
          order.transbank_buy_order === null) {
        
        newOrderNumber = transbankService.generateOrderNumber()
        
        // Generar nuevo transbank_buy_order si es null
        const newTransbankBuyOrder = order.transbank_buy_order || transbankService.generateBuyOrder()

        await query(
          `UPDATE orders SET 
            order_number = ?,
            transbank_buy_order = ?,
            updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [newOrderNumber, newTransbankBuyOrder, order.id]
        )
        
        console.log(`✅ Orden ${order.id} normalizada:`, {
          old: order.order_number,
          new: newOrderNumber,
          transbank: newTransbankBuyOrder
        })
        
        updatedCount++
      }
    }

    return NextResponse.json({
      success: true,
      normalized: updatedCount,
      totalChecked: orders.length,
      message: `Se normalizaron ${updatedCount} órdenes`
    })

  } catch (error) {
    console.error('Error normalizando órdenes:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}