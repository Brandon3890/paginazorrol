// app/api/admin/orders/route.ts - CORREGIDO
import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth'
import { queryRows } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación y rol de admin
    const user = await verifyAdmin(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Obtener todas las órdenes con información de usuarios y items
    const orders = await queryRows(`
      SELECT 
        o.*,
        u.email as customer_email,
        u.first_name as customer_first_name,
        u.last_name as customer_last_name,
        u.phone as customer_phone,
        ua.street,
        ua.commune_name,
        ua.region_name,
        ua.postal_code
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN user_addresses ua ON o.shipping_address_id = ua.id
      ORDER BY o.created_at DESC
    `)

    // Obtener items para cada orden
    const ordersWithItems = await Promise.all(
      orders.map(async (order: any) => {
        const items = await queryRows(
          'SELECT * FROM order_items WHERE order_id = ?',
          [order.id]
        )

        return {
          ...order,
          items
        }
      })
    )

    return NextResponse.json(ordersWithItems)
  } catch (error) {
    console.error('Error fetching orders:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}