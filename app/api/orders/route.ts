import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserIdFromRequest } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request)
    
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Obtener información del usuario
    const userInfo = await query(
      `SELECT email, first_name, last_name, phone FROM users WHERE id = ?`,
      [userId]
    ) as any[]

    const user = userInfo.length > 0 ? userInfo[0] : null

    // Obtener todas las órdenes del usuario
    const orders = await query(
      `SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    ) as any[]

    console.log(`📦 Found ${orders.length} orders for user ${userId}`)

    // Para cada orden, obtener los items
    const ordersWithItems = await Promise.all(
      orders.map(async (order: any) => {
        // Obtener items de la orden
        const orderItems = await query(
          `SELECT 
            oi.id,
            oi.product_id,
            oi.product_name,
            oi.product_price,
            oi.quantity,
            oi.subtotal,
            p.image as image_url,
            c.name as category
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          LEFT JOIN categories c ON p.category_id = c.id
          WHERE oi.order_id = ?`,
          [order.id]
        ) as any[]

        // Obtener dirección de envío si existe
        let shippingAddress = undefined
        if (order.shipping_address_id) {
          const addresses = await query(
            `SELECT street, commune_name, region_name, postal_code, department, delivery_instructions
             FROM user_addresses WHERE id = ?`,
            [order.shipping_address_id]
          ) as any[]
          
          if (addresses.length > 0) {
            shippingAddress = addresses[0]
          }
        }

        return {
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          payment_status: order.payment_status,
          subtotal: parseFloat(order.subtotal),
          discount: parseFloat(order.discount || 0),
          shipping: parseFloat(order.shipping || 0),
          tax: parseFloat(order.tax || 0),
          total: parseFloat(order.total),
          notes: order.notes,
          coupon_code: order.coupon_code,
          shipping_method: order.payment_method,
          created_at: order.created_at,
          updated_at: order.updated_at,
          items: orderItems.map((item: any) => ({
            id: item.id,
            product_id: item.product_id,
            product_name: item.product_name,
            product_price: parseFloat(item.product_price),
            quantity: item.quantity,
            subtotal: parseFloat(item.subtotal),
            image_url: item.image_url,
            category: item.category
          })),
          shipping_address: shippingAddress,
          customer_email: user?.email || order.customer_email || '',
          customer_first_name: user?.first_name || order.customer_first_name || '',
          customer_last_name: user?.last_name || order.customer_last_name || '',
          customer_phone: user?.phone || order.customer_phone || ''
        }
      })
    )

    return NextResponse.json(ordersWithItems)

  } catch (error) {
    console.error('Error obteniendo órdenes:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}