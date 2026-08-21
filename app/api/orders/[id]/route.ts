// app/api/orders/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

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

    // Query que trae TODOS los datos incluyendo shipping_type y shipping_details
    const orders = await query(
      `SELECT 
        o.*,
        u.email as customer_email, 
        u.first_name as customer_first_name, 
        u.last_name as customer_last_name, 
        u.phone as customer_phone, 
        u.rut as customer_rut,
        u.is_guest,
        ua.id as address_id,
        ua.street as shipping_street,
        ua.commune_name as shipping_commune,
        ua.region_name as shipping_region,
        ua.postal_code as shipping_postal_code,
        ua.department as shipping_department,
        ua.delivery_instructions as shipping_delivery_instructions,
        ua.title as shipping_title
      FROM orders o 
      LEFT JOIN users u ON o.user_id = u.id 
      LEFT JOIN user_addresses ua ON o.shipping_address_id = ua.id
      WHERE o.id = ?`,
      [orderId]
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

    // Obtener las imágenes de los productos
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

    // Construir dirección de envío
    const shippingAddress = order.shipping_street ? {
      street: order.shipping_street || 'Dirección no especificada',
      commune_name: order.shipping_commune || 'Comuna no especificada',
      region_name: order.shipping_region || 'Región no especificada',
      postal_code: order.shipping_postal_code || '000000',
      department: order.shipping_department || '',
      delivery_instructions: order.shipping_delivery_instructions || '',
      title: order.shipping_title || 'Dirección de envío'
    } : null

    // Obtener información de la boleta
    let boletaInfo = null
    
    if (order.boleta_id) {
      const boletas = await query(
        `SELECT id, folio, monto_total, fecha_emision, estado_sii, 
                rut_receptor, razon_social_receptor
         FROM boletas 
         WHERE id = ?`,
        [order.boleta_id]
      ) as any[];
      
      if (boletas.length > 0) {
        boletaInfo = {
          id: boletas[0].id,
          folio: boletas[0].folio,
          monto_total: parseFloat(boletas[0].monto_total),
          fecha_emision: boletas[0].fecha_emision,
          estado_sii: boletas[0].estado_sii,
          rut_receptor: boletas[0].rut_receptor,
          razon_social: boletas[0].razon_social_receptor
        }
      }
    }

    // Si no se encontró por boleta_id, buscar por order_id
    if (!boletaInfo) {
      const boletas = await query(
        `SELECT id, folio, monto_total, fecha_emision, estado_sii,
                rut_receptor, razon_social_receptor
         FROM boletas 
         WHERE order_id = ?`,
        [orderId]
      ) as any[];
      
      if (boletas.length > 0) {
        boletaInfo = {
          id: boletas[0].id,
          folio: boletas[0].folio,
          monto_total: parseFloat(boletas[0].monto_total),
          fecha_emision: boletas[0].fecha_emision,
          estado_sii: boletas[0].estado_sii,
          rut_receptor: boletas[0].rut_receptor,
          razon_social: boletas[0].razon_social_receptor
        }
        
        // Actualizar la orden con el boleta_id si no lo tiene
        if (!order.boleta_id) {
          await query(
            `UPDATE orders SET boleta_id = ?, boleta_emitida = 1 WHERE id = ?`,
            [boletas[0].id, orderId]
          )
        }
      }
    }

    // Parsear shipping_details
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

    // Determinar el método de envío mostrado
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

    // Combinar datos finales
    const orderWithItems = {
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
      notes: order.notes,
      coupon_code: order.coupon_code,
      shipping_method: shippingMethodDisplay,
      shipping_type: shippingType,
      shipping_details: shippingDetails,
      customer_email: order.customer_email || '',
      customer_first_name: order.customer_first_name || '',
      customer_last_name: order.customer_last_name || '',
      customer_phone: order.customer_phone || '',
      customer_rut: order.customer_rut || '55555555-5',
      is_guest: order.is_guest === 1,
      boleta_id: order.boleta_id,
      boleta_emitida: order.boleta_emitida || (boletaInfo ? 1 : 0),
      boleta_info: boletaInfo,
      created_at: order.created_at,
      updated_at: order.updated_at,
      items: itemsWithImages.map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.product_name,
        product_price: parseFloat(item.product_price) || 0,
        quantity: item.quantity,
        subtotal: parseFloat(item.subtotal) || 0,
        image_url: item.image_url,
        category: item.category
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orderId = parseInt(id)

    if (isNaN(orderId)) {
      return NextResponse.json({ error: 'ID de orden inválido' }, { status: 400 })
    }

    const body = await request.json()
    const { status } = body

    const validStatuses = ['pending', 'processing', 'confirmed', 'shipped', 'delivered', 'cancelled']
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Estado inválido. Debe ser uno de: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    await query(
      `UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [status, orderId]
    )

    console.log(`Order ${orderId} status updated to ${status}`)

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