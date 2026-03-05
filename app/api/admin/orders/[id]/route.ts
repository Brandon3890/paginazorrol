// app/api/admin/orders/[id]/route.ts - VERSIÓN CORREGIDA
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserIdFromRequest } from '@/lib/auth-utils'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
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
      return NextResponse.json({ error: 'No tienes permisos para ver esta orden' }, { status: 403 })
    }

    // Obtener el ID de los parámetros
    const { id } = params
    console.log('🔍 Order ID from params:', id)
    
    const orderId = parseInt(id)

    if (isNaN(orderId)) {
      console.error('❌ Invalid order ID:', id)
      return NextResponse.json({ error: 'ID de orden inválido' }, { status: 400 })
    }

    // Obtener la orden principal con información del usuario
    const orders = await query(
      `SELECT o.*, u.email, u.first_name, u.last_name, u.phone 
       FROM orders o 
       LEFT JOIN users u ON o.user_id = u.id 
       WHERE o.id = ?`,
      [orderId]
    ) as any[]

    if (orders.length === 0) {
      console.error('❌ Order not found:', orderId)
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
    }

    const order = orders[0]

    // Obtener los items de la orden
    const orderItems = await query(
      `SELECT oi.*, p.image, c.name as category_name
       FROM order_items oi 
       LEFT JOIN products p ON oi.product_id = p.id 
       LEFT JOIN categories c ON p.category_id = c.id 
       WHERE oi.order_id = ?`,
      [orderId]
    ) as any[]

    // Si hay shipping_address_id, obtener la dirección
    let shippingAddress = undefined
    if (order.shipping_address_id) {
      const addresses = await query(
        `SELECT * FROM user_addresses WHERE id = ?`,
        [order.shipping_address_id]
      ) as any[]
      
      if (addresses.length > 0) {
        const address = addresses[0]
        shippingAddress = {
          street: address.street,
          commune_name: address.commune_name,
          region_name: address.region_name,
          postal_code: address.postal_code,
          department: address.department,
          delivery_instructions: address.delivery_instructions,
          title: address.title
        }
      }
    }

    // Obtener información del cupón si existe
    let couponInfo = null
    if (order.coupon_id) {
      const coupons = await query(
        `SELECT code, discount_percentage, type FROM coupons WHERE id = ?`,
        [order.coupon_id]
      ) as any[]
      
      if (coupons.length > 0) {
        couponInfo = coupons[0]
      }
    }

    // Combinar datos en formato compatible con el frontend
    const orderWithItems = {
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      payment_status: order.payment_status,
      payment_method: order.payment_method,
      subtotal: parseFloat(order.subtotal),
      discount: parseFloat(order.discount),
      shipping: parseFloat(order.shipping),
      tax: parseFloat(order.tax),
      total: parseFloat(order.total),
      notes: order.notes,
      coupon_code: order.coupon_code || couponInfo?.code,
      coupon_info: couponInfo,
      customer_email: order.email || '',
      customer_first_name: order.first_name || '',
      customer_last_name: order.last_name || '',
      customer_phone: order.phone || '',
      created_at: order.created_at,
      updated_at: order.updated_at,
      items: orderItems.map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.product_name,
        product_price: parseFloat(item.product_price),
        quantity: item.quantity,
        subtotal: parseFloat(item.subtotal),
        image_url: item.image,
        category: item.category_name || 'General'
      })),
      shipping_address: shippingAddress,
      // Información de Transbank si existe
      transbank_info: {
        authorization_code: order.transbank_authorization_code,
        payment_type: order.transbank_payment_type,
        installments: order.transbank_installments_number,
        card_number: order.transbank_card_number,
        transaction_date: order.transbank_transaction_date
      }
    }

    console.log('✅ Admin order details loaded successfully:', {
      orderId: orderWithItems.id,
      orderNumber: orderWithItems.order_number,
      customer: `${orderWithItems.customer_first_name} ${orderWithItems.customer_last_name}`,
      itemsCount: orderWithItems.items.length
    })

    return NextResponse.json(orderWithItems)

  } catch (error) {
    console.error('❌ Error obteniendo detalles de orden para admin:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const { id } = params
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