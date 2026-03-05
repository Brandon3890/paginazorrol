// app/api/orders/update-images/route.ts - NUEVO ARCHIVO
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function POST() {
  try {
    // Obtener todos los order_items que no tienen image_url
    const orderItems = await query(
      `SELECT oi.id, oi.product_id, p.image 
       FROM order_items oi 
       LEFT JOIN products p ON oi.product_id = p.id 
       WHERE oi.image_url IS NULL OR oi.image_url = ''`
    ) as any[]

    console.log(`🔄 Actualizando ${orderItems.length} items sin imagen...`)

    let updatedCount = 0

    for (const item of orderItems) {
      if (item.image) {
        await query(
          `UPDATE order_items SET image_url = ? WHERE id = ?`,
          [item.image, item.id]
        )
        updatedCount++
        console.log(`✅ Item ${item.id} actualizado con imagen:`, item.image)
      }
    }

    return NextResponse.json({
      success: true,
      updated: updatedCount,
      total: orderItems.length,
      message: `Se actualizaron ${updatedCount} items con imágenes`
    })

  } catch (error) {
    console.error('Error actualizando imágenes:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}