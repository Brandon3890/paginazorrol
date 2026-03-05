// app/api/orders/cleanup/route.ts - VERSIÓN CORREGIDA
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function POST() {
  try {
    // Eliminar órdenes duplicadas o huérfanas
    const result = await query(`
      DELETE FROM orders 
      WHERE user_id IS NULL 
        OR (payment_status = 'pending' AND created_at < DATE_SUB(NOW(), INTERVAL 1 HOUR))
    `) as any

    console.log(`🧹 Órdenes limpiadas: ${result.affectedRows}`)

    return NextResponse.json({
      success: true,
      cleaned: result.affectedRows
    })

  } catch (error) {
    console.error('Error limpiando órdenes:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// También puedes agregar un método GET para limpiar desde el navegador
export async function GET() {
  try {
    const result = await query(`
      DELETE FROM orders 
      WHERE user_id IS NULL 
        OR (payment_status = 'pending' AND created_at < DATE_SUB(NOW(), INTERVAL 1 HOUR))
    `) as any

    console.log(`🧹 Órdenes limpiadas vía GET: ${result.affectedRows}`)

    return NextResponse.json({
      success: true,
      cleaned: result.affectedRows,
      message: `Se limpiaron ${result.affectedRows} órdenes`
    })

  } catch (error) {
    console.error('Error limpiando órdenes:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}