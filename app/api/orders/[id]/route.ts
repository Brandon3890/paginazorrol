// app/api/orders/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserIdFromRequest } from '@/lib/auth-utils'

// GET - Público para order-success
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orderId = parseInt(id)

    if (isNaN(orderId)) {
      return NextResponse.json({ error: 'ID de orden inválido' }, { status: 400 })
    }

    // Buscar orden por ID (sin verificar usuario - público para lectura)
    const orders = await query(
      `SELECT o.*, 
        u.email as customer_email,
        u.first_name as customer_first_name,
        u.last_name as customer_last_name,
        u.phone as customer_phone,
        u.rut as customer_rut
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.id = ?`,
      [orderId]
    ) as any[]

    if (orders.length === 0) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
    }

    const order = orders[0]

    // Obtener items
    const orderItems = await query(
      `SELECT * FROM order_items WHERE order_id = ?`,
      [orderId]
    ) as any[]

    const orderWithItems = {
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      payment_status: order.payment_status,
      subtotal: parseFloat(order.subtotal),
      discount: parseFloat(order.discount),
      shipping: parseFloat(order.shipping),
      tax: parseFloat(order.tax),
      total: parseFloat(order.total),
      notes: order.notes,
      coupon_code: order.coupon_code,
      customer_email: order.customer_email || '',
      customer_first_name: order.customer_first_name || '',
      customer_last_name: order.customer_last_name || '',
      customer_phone: order.customer_phone || '',
      customer_rut: order.customer_rut || '55555555-5',
      boleta_id: order.boleta_id,
      boleta_emitida: order.boleta_emitida || 0,
      boleta_folio: order.boleta_folio,
      created_at: order.created_at,
      updated_at: order.updated_at,
      items: orderItems.map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.product_name,
        product_price: parseFloat(item.product_price),
        quantity: item.quantity,
        subtotal: parseFloat(item.subtotal)
      }))
    }

    return NextResponse.json(orderWithItems)

  } catch (error) {
    console.error('Error obteniendo orden:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// PATCH - Requiere autenticación (solo admin)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(request)
    
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Verificar admin
    const users = await query(
      `SELECT role FROM users WHERE id = ?`,
      [userId]
    ) as any[]

    const user = users.length > 0 ? users[0] : null
    
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'No tienes permisos' }, { status: 403 })
    }

    const { id } = await params
    const orderId = parseInt(id)
    const body = await request.json()
    const { status } = body

    await query(
      `UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [status, orderId]
    )

    return NextResponse.json({ success: true })

  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}