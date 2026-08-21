// app/api/orders/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserIdFromRequest } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request)
    
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // INCLUIR shipping_type y shipping_details en la consulta
    const orders = await query(
      `SELECT 
        o.*,
        o.shipping_type,
        o.shipping_details
      FROM orders o 
      WHERE o.user_id = ? 
      ORDER BY o.created_at DESC`,
      [userId]
    ) as any[]

    console.log(`Found ${orders.length} orders`)

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

        // OBTENER DIRECCIÓN DE ENVÍO - MANEJAR CASO DE BODEGA
        let shippingAddress = undefined
        const isBodegaPickup = order.shipping_type === 'bodega_pickup'
        
        if (isBodegaPickup) {
          // SI ES RETIRO EN BODEGA, USAR DIRECCIÓN DE BODEGA
          shippingAddress = {
            street: 'Arcangel 1200, San Miguel',
            commune_name: 'San Miguel',
            region_name: 'Región Metropolitana',
            postal_code: '8900000',
            department: '',
            isBodega: true
          }
        } else if (order.shipping_address_id) {
          // SI TIENE DIRECCIÓN NORMAL
          const addresses = await query(
            `SELECT street, commune_name, region_name, postal_code, department 
             FROM user_addresses WHERE id = ? AND user_id = ?`,
            [order.shipping_address_id, userId]
          ) as any[]
          
          if (addresses.length > 0) {
            shippingAddress = {
              ...addresses[0],
              isBodega: false
            }
          }
        }

        // PARSEAR SHIPPING_DETAILS
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

        // DETERMINAR MÉTODO DE ENVÍO MOSTRADO
        let shippingMethodDisplay = 'Método no especificado'
        const shippingType = order.shipping_type || ''
        
        switch (shippingType) {
          case 'bodega_pickup':
            shippingMethodDisplay = 'Retiro en Bodega'
            break
          case 'branch_pickup':
            shippingMethodDisplay = 'Retiro en Sucursal'
            break
          case 'home_delivery':
            shippingMethodDisplay = 'Envío a Domicilio'
            break
          case 'cash_on_delivery':
            shippingMethodDisplay = 'Envío por Pagar'
            break
          case 'express':
            shippingMethodDisplay = 'Envío Express'
            break
          case 'standard':
            shippingMethodDisplay = 'Envío Estándar'
            break
          default:
            shippingMethodDisplay = order.payment_method || 'Método no especificado'
        }

        return {
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          payment_status: order.payment_status,
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
          created_at: order.created_at,
          updated_at: order.updated_at,
          items: itemsWithImages.map((item: any) => ({
            id: item.id,
            product_id: item.product_id,
            product_name: item.product_name,
            product_price: parseFloat(item.product_price) || 0,
            quantity: item.quantity || 0,
            subtotal: parseFloat(item.subtotal) || 0,
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