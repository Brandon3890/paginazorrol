import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserIdFromRequest } from '@/lib/auth-utils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(request)
    const { id: orderId } = await params
    
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
      return NextResponse.json({ error: 'No tienes permisos para ver este pedido' }, { status: 403 })
    }

    // Obtener la orden con datos del usuario
    const orders = await query(
      `SELECT 
        o.*, 
        u.email, 
        u.first_name, 
        u.last_name, 
        u.phone, 
        u.is_guest,
        o.transbank_payment_type,
        o.transbank_installments_number,
        o.transbank_transaction_date,
        o.payment_method
       FROM orders o 
       LEFT JOIN users u ON o.user_id = u.id 
       WHERE o.id = ?`,
      [orderId]
    ) as any[]

    if (orders.length === 0) {
      return NextResponse.json(
        { error: 'Pedido no encontrado' },
        { status: 404 }
      )
    }

    const order = orders[0]

    // Obtener items de la orden
    const orderItems = await query(
      `SELECT * FROM order_items WHERE order_id = ?`,
      [orderId]
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
        `SELECT street, commune_name, region_name, postal_code, department, delivery_instructions, title 
         FROM user_addresses WHERE id = ?`,
        [order.shipping_address_id]
      ) as any[]
      
      if (addresses.length > 0) {
        shippingAddress = addresses[0]
      }
    }

    // Obtener información del cupón si existe
    let couponInfo = null
    if (order.coupon_code) {
      const coupon = await query(
        `SELECT code, discount_percentage, type FROM coupons WHERE code = ?`,
        [order.coupon_code]
      ) as any[]
      if (coupon.length > 0) {
        couponInfo = coupon[0]
      }
    }

    // Construir objeto transbank_info
    const transbankInfo = {
      authorization_code: order.transbank_authorization_code || null,
      payment_type: order.transbank_payment_type || null,
      installments: order.transbank_installments_number !== null && order.transbank_installments_number !== undefined ? order.transbank_installments_number : null,
      card_number: order.transbank_card_number || null,
      transaction_date: order.transbank_transaction_date || null
    }

    const responseOrder = {
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      payment_status: order.payment_status,
      payment_method: order.payment_method || 'transbank',
      subtotal: parseFloat(order.subtotal) || 0,
      discount: parseFloat(order.discount) || 0,
      shipping: parseFloat(order.shipping) || 0,
      tax: parseFloat(order.tax) || 0,
      total: parseFloat(order.total) || 0,
      notes: order.notes || '',
      coupon_code: order.coupon_code || '',
      coupon_info: couponInfo,
      created_at: order.created_at,
      updated_at: order.updated_at,
      customer_email: order.email || '',
      customer_first_name: order.first_name || '',
      customer_last_name: order.last_name || '',
      customer_phone: order.phone || '',
      is_guest: order.is_guest === 1,
      items: itemsWithImages.map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.product_name,
        product_price: parseFloat(item.product_price) || 0,
        quantity: item.quantity || 0,
        subtotal: parseFloat(item.subtotal) || 0,
        image_url: item.image_url || '',
        category: item.category || ''
      })),
      shipping_address: shippingAddress,
      transbank_info: transbankInfo
    }

    return NextResponse.json(responseOrder)

  } catch (error) {
    console.error('Error obteniendo detalles del pedido:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(request)
    const { id: orderId } = await params
    
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

    const body = await request.json()
    const { status } = body

    if (!status) {
      return NextResponse.json(
        { error: 'El estado es requerido' },
        { status: 400 }
      )
    }

    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Estado no valido' },
        { status: 400 }
      )
    }

    await query(
      'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, orderId]
    )

    return NextResponse.json({ success: true, message: 'Estado actualizado correctamente' })

  } catch (error) {
    console.error('Error actualizando estado del pedido:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}