// app/api/admin/orders/[id]/route.ts
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

    // 🔥 INCLUIR shipping_type y shipping_details
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
        o.payment_method,
        o.shipping_type,
        o.shipping_details
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

    // 🔥 PARSEAR shipping_details
    let shippingDetails = null
    if (order.shipping_details) {
      try {
        shippingDetails = typeof order.shipping_details === 'string' 
          ? JSON.parse(order.shipping_details) 
          : order.shipping_details
      } catch (e) {
        console.error('Error parsing shipping_details:', e)
      }
    }

    // 🔥 Determinar el método de envío mostrado
    let shippingMethodDisplay = 'Método no especificado'
    let shippingType = order.shipping_type || 'standard'
    
    if (shippingDetails) {
      if (shippingDetails.selectedBranch) {
        shippingType = 'branch_pickup'
        shippingMethodDisplay = 'Retiro en Sucursal'
      } else if (shippingDetails.isCashOnDelivery) {
        shippingType = 'cash_on_delivery'
        shippingMethodDisplay = 'Envío por Pagar'
      } else if (shippingDetails.serviceName) {
        shippingMethodDisplay = shippingDetails.serviceName
        if (shippingDetails.serviceName.toLowerCase().includes('domicilio') || 
            shippingDetails.serviceName.toLowerCase().includes('envío')) {
          shippingType = 'home_delivery'
        }
      } else if (shippingDetails.type === 'bodega_pickup') {
        shippingType = 'bodega_pickup'
        shippingMethodDisplay = 'Retiro en Bodega'
      }
    }

    // Si no hay shippingDetails pero hay shipping_type
    if (!shippingDetails && order.shipping_type) {
      switch (order.shipping_type) {
        case 'branch_pickup':
          shippingMethodDisplay = 'Retiro en Sucursal'
          break
        case 'cash_on_delivery':
          shippingMethodDisplay = 'Envío por Pagar'
          break
        case 'home_delivery':
          shippingMethodDisplay = 'Envío a Domicilio'
          break
        case 'bodega_pickup':
          shippingMethodDisplay = 'Retiro en Bodega'
          break
        default:
          shippingMethodDisplay = 'Envío Estándar'
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
      shipping_method: shippingMethodDisplay,
      shipping_type: shippingType,
      shipping_details: shippingDetails,
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

    // 🔥 INCLUIR 'confirmed' EN LOS ESTADOS VÁLIDOS
    const validStatuses = ['pending', 'processing', 'confirmed', 'shipped', 'delivered', 'cancelled']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Estado no válido. Debe ser uno de: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    await query(
      'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, orderId]
    )

    console.log(`Admin: Order ${orderId} status updated to ${status}`)

    return NextResponse.json({ success: true, message: 'Estado actualizado correctamente' })

  } catch (error) {
    console.error('Error actualizando estado del pedido:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}