// app/api/orders/normalize-all/route.ts - NUEVO ARCHIVO
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { orderNumberService } from '@/lib/order-number-service'

export async function POST() {
  try {
    // Obtener TODAS las órdenes para normalizar
    const orders = await query(
      `SELECT id, order_number, transbank_buy_order, created_at 
       FROM orders 
       ORDER BY created_at DESC`
    ) as any[]

    console.log(`🔄 Normalizando ${orders.length} órdenes...`)

    let normalizedCount = 0
    let skippedCount = 0

    for (const order of orders) {
      // Solo normalizar si el order_number no es válido o es igual al transbank_buy_order
      const isValid = orderNumberService.isValidOrderNumber(order.order_number)
      const isDifferent = order.order_number !== order.transbank_buy_order
      
      if (!isValid || !isDifferent) {
        // Generar nuevo número de orden válido
        const newOrderNumber = orderNumberService.generateOrderNumber()
        
        await query(
          `UPDATE orders SET 
            order_number = ?,
            updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [newOrderNumber, order.id]
        )
        
        console.log(`✅ Orden ${order.id} normalizada:`, {
          old: order.order_number,
          new: newOrderNumber,
          transbank: order.transbank_buy_order,
          fecha: order.created_at
        })
        
        normalizedCount++
      } else {
        skippedCount++
        console.log(`⏭️ Orden ${order.id} ya está normalizada:`, order.order_number)
      }
    }

    return NextResponse.json({
      success: true,
      normalized: normalizedCount,
      skipped: skippedCount,
      total: orders.length,
      message: `Se normalizaron ${normalizedCount} órdenes de ${orders.length} totales`
    })

  } catch (error) {
    console.error('Error normalizando órdenes:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}