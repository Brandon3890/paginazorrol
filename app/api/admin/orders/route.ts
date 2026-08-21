// app/api/orders/route.ts - NUEVO ARCHIVO
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserIdFromRequest } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request)
    
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

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
          `SELECT * FROM order_items WHERE order_id = ?`,
          [order.id]
        ) as any[]

        // Obtener imágenes de los productos
        const itemsWithImages = await Promise.all(
          orderItems.map(async (item: any) => {
            try {
              const products = await query(
                `SELECT image FROM products WHERE id = ?`,
                [item.product_id]
              ) as any[]
              
              if (products.length > 0) {
                return {
                  ...item,
                  image_url: products[0].image
                }
              }
            } catch (error) {
              console.error(`Error obteniendo imagen para producto ${item.product_id}:`, error)
            }
            
            return item
          })
        )

        // Obtener dirección de envío si existe
        let shippingAddress = undefined
        if (order.shipping_address_id) {
          const addresses = await query(
            `SELECT street, commune_name, region_name, postal_code, department 
             FROM user_addresses WHERE id = ? AND user_id = ?`,
            [order.shipping_address_id, userId]
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
          discount: parseFloat(order.discount),
          shipping: parseFloat(order.shipping),
          tax: parseFloat(order.tax),
          total: parseFloat(order.total),
          notes: order.notes,
          coupon_code: order.coupon_code,
          shipping_method: order.payment_method,
          created_at: order.created_at,
          updated_at: order.updated_at,
          items: itemsWithImages.map((item: any) => ({
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
          customer_email: order.customer_email || '',
          customer_first_name: order.customer_first_name || '',
          customer_last_name: order.customer_last_name || '',
          customer_phone: order.customer_phone || ''
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