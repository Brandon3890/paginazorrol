// app/api/orders/fix-numbers/route.ts - NUEVO ARCHIVO
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { transbankService } from '@/lib/transbank-service'

export async function POST() {
  try {
    // Obtener todas las órdenes que tienen order_number igual a transbank_buy_order
    const orders = await query(
      `SELECT id, order_number, transbank_buy_order 
       FROM orders 
       WHERE order_number = transbank_buy_order 
          OR order_number IS NULL 
          OR order_number = ''`
    ) as any[]

    console.log(`🔄 Corrigiendo ${orders.length} órdenes con números duplicados...`)

    let fixedCount = 0

    for (const order of orders) {
      // Generar nuevo order_number único
      const newOrderNumber = transbankService.generateOrderNumber()
      
      await query(
        `UPDATE orders SET 
          order_number = ?,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [newOrderNumber, order.id]
      )
      
      console.log(`✅ Orden ${order.id} corregida:`, {
        old: order.order_number,
        new: newOrderNumber,
        transbank: order.transbank_buy_order
      })
      
      fixedCount++
    }

    return NextResponse.json({
      success: true,
      fixed: fixedCount,
      totalChecked: orders.length,
      message: `Se corrigieron ${fixedCount} órdenes con números duplicados`
    })

  } catch (error) {
    console.error('Error corrigiendo números de orden:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}