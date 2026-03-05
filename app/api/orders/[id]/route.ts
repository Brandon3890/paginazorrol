import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserIdFromRequest } from '@/lib/auth-utils'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(request)
    
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Verificar que el usuario es admin
    const users = await query(
      `SELECT role FROM users WHERE id = ?`,
      [userId]
    ) as any[]

    const user = users.length > 0 ? users[0] : null
    
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'No tienes permisos para actualizar pedidos' }, { status: 403 })
    }

    const { id } = await params
    const orderId = parseInt(id)

    if (isNaN(orderId)) {
      return NextResponse.json({ error: 'ID de orden inválido' }, { status: 400 })
    }

    const body = await request.json()
    const { status } = body

    if (!status || !['pending', 'processing', 'shipped', 'delivered', 'cancelled'].includes(status)) {
      return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
    }

    // Actualizar el estado de la orden
    await query(
      `UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [status, orderId]
    )

    console.log(`✅ Order ${orderId} status updated to ${status}`)

    return NextResponse.json({ 
      success: true, 
      message: 'Estado actualizado correctamente' 
    })

  } catch (error) {
    console.error('Error actualizando estado de orden:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// Mantener el GET existente para obtener detalles de orden individual
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(request)
    
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const orderId = parseInt(id)

    if (isNaN(orderId)) {
      return NextResponse.json({ error: 'ID de orden inválido' }, { status: 400 })
    }

    // Obtener información del usuario
    const users = await query(
      `SELECT email, first_name, last_name, phone FROM users WHERE id = ?`,
      [userId]
    ) as any[]

    const user = users.length > 0 ? users[0] : null

    // Obtener la orden principal
    const orders = await query(
      `SELECT * FROM orders WHERE id = ? AND user_id = ?`,
      [orderId, userId]
    ) as any[]

    if (orders.length === 0) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
    }

    const order = orders[0]

    // Obtener los items de la orden
    const orderItems = await query(
      `SELECT * FROM order_items WHERE order_id = ?`,
      [orderId]
    ) as any[]

    // Obtener las imágenes de los productos desde la tabla products
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

    // Si hay shipping_address_id, obtener la dirección
    let shippingAddress = undefined
    if (order.shipping_address_id) {
      const addresses = await query(
        `SELECT * FROM user_addresses WHERE id = ? AND user_id = ?`,
        [order.shipping_address_id, userId]
      ) as any[]
      
      if (addresses.length > 0) {
        const address = addresses[0]
        shippingAddress = {
          street: address.street,
          commune_name: address.commune_name,
          region_name: address.region_name,
          postal_code: address.postal_code,
          department: address.department,
          delivery_instructions: address.delivery_instructions
        }
      }
    }

    // Combinar datos en formato compatible con el frontend
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
      shipping_method: order.payment_method,
      customer_email: user?.email || '',
      customer_first_name: user?.first_name || '',
      customer_last_name: user?.last_name || '',
      customer_phone: user?.phone || '',
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
        category: item.category || 'General'
      })),
      shipping_address: shippingAddress
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