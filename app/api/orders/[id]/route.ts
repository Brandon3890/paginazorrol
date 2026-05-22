// app/api/orders/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserIdFromRequest } from '@/lib/auth-utils'

// =========================
// PATCH - SOLO ADMIN
// =========================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(request)

    if (!userId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    // Verificar admin
    const users = await query(
      `SELECT role FROM users WHERE id = ?`,
      [userId]
    ) as any[]

    const user = users.length > 0 ? users[0] : null

    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'No tienes permisos para actualizar pedidos' },
        { status: 403 }
      )
    }

    const { id } = await params

    const orderId = parseInt(id)

    if (isNaN(orderId)) {
      return NextResponse.json(
        { error: 'ID de orden inválido' },
        { status: 400 }
      )
    }

    const body = await request.json()

    const { status } = body

    if (
      !status ||
      ![
        'pending',
        'processing',
        'shipped',
        'delivered',
        'cancelled'
      ].includes(status)
    ) {
      return NextResponse.json(
        { error: 'Estado inválido' },
        { status: 400 }
      )
    }

    await query(
      `
      UPDATE orders
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [status, orderId]
    )

    console.log(`✅ Order ${orderId} status updated to ${status}`)

    return NextResponse.json({
      success: true,
      message: 'Estado actualizado correctamente'
    })

  } catch (error) {
    console.error('❌ Error actualizando estado de orden:', error)

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// =========================
// GET - ORDER SUCCESS
// SIN AUTH TEMPORALMENTE
// =========================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {

    const { id } = await params

    const orderId = parseInt(id)

    console.log('📦 GET ORDER:', orderId)

    if (isNaN(orderId)) {
      return NextResponse.json(
        { error: 'ID de orden inválido' },
        { status: 400 }
      )
    }

    // =========================
    // OBTENER ORDEN
    // =========================

    const orders = await query(
      `SELECT * FROM orders WHERE id = ?`,
      [orderId]
    ) as any[]

    if (orders.length === 0) {
      return NextResponse.json(
        { error: 'Orden no encontrada' },
        { status: 404 }
      )
    }

    const order = orders[0]

    console.log('✅ Orden encontrada:', order.id)

    // =========================
    // USUARIO
    // =========================

    let user = null

    if (order.user_id) {
      try {

        const users = await query(
          `
          SELECT
            id,
            email,
            first_name,
            last_name,
            phone,
            rut
          FROM users
          WHERE id = ?
          `,
          [order.user_id]
        ) as any[]

        if (users.length > 0) {
          user = users[0]
        }

      } catch (userError) {
        console.error('❌ Error obteniendo usuario:', userError)
      }
    }

    // =========================
    // ITEMS
    // =========================

    const orderItems = await query(
      `SELECT * FROM order_items WHERE order_id = ?`,
      [orderId]
    ) as any[]

    console.log('📦 Items encontrados:', orderItems.length)

    // =========================
    // IMÁGENES PRODUCTOS
    // =========================

    const itemsWithImages = await Promise.all(
      orderItems.map(async (item: any) => {

        try {

          const products = await query(
            `SELECT image FROM products WHERE id = ?`,
            [item.product_id]
          ) as any[]

          return {
            ...item,
            image_url:
              products.length > 0
                ? products[0].image
                : null
          }

        } catch (error) {

          console.error(
            `❌ Error imagen producto ${item.product_id}:`,
            error
          )

          return {
            ...item,
            image_url: null
          }
        }
      })
    )

    // =========================
    // DIRECCIÓN
    // =========================

    let shippingAddress = null

    if (order.shipping_address_id) {

      try {

        const addresses = await query(
          `
          SELECT *
          FROM user_addresses
          WHERE id = ?
          `,
          [order.shipping_address_id]
        ) as any[]

        if (addresses.length > 0) {

          const address = addresses[0]

          shippingAddress = {
            street: address.street || '',
            commune_name: address.commune_name || '',
            region_name: address.region_name || '',
            postal_code: address.postal_code || '',
            department: address.department || '',
            delivery_instructions:
              address.delivery_instructions || ''
          }
        }

      } catch (addressError) {

        console.error(
          '❌ Error obteniendo dirección:',
          addressError
        )
      }
    }

    // =========================
    // BOLETA
    // =========================

    let boletaInfo = null

    if (order.boleta_id) {

      try {

        const boletas = await query(
          `
          SELECT
            folio,
            monto_total,
            fecha_emision,
            estado_sii
          FROM boletas
          WHERE id = ?
          `,
          [order.boleta_id]
        ) as any[]

        if (boletas.length > 0) {
          boletaInfo = boletas[0]
        }

      } catch (boletaError) {

        console.error(
          '❌ Error obteniendo boleta:',
          boletaError
        )
      }
    }

    // =========================
    // RESPUESTA FINAL
    // =========================

    const orderWithItems = {
      id: order.id,

      order_number: order.order_number || '',

      status: order.status || 'pending',

      payment_status: order.payment_status || 'pending',

      subtotal: parseFloat(order.subtotal || 0),

      discount: parseFloat(order.discount || 0),

      shipping: parseFloat(order.shipping || 0),

      tax: parseFloat(order.tax || 0),

      total: parseFloat(order.total || 0),

      notes: order.notes || '',

      coupon_code: order.coupon_code || null,

      shipping_method:
        order.shipping_method ||
        order.payment_method ||
        '',

      customer_email: user?.email || '',

      customer_first_name: user?.first_name || '',

      customer_last_name: user?.last_name || '',

      customer_phone: user?.phone || '',

      customer_rut:
        user?.rut || '55555555-5',

      boleta_id: order.boleta_id || null,

      boleta_emitida: order.boleta_emitida || 0,

      boleta_folio:
        boletaInfo?.folio || null,

      boleta_info: boletaInfo,

      created_at: order.created_at || null,

      updated_at: order.updated_at || null,

      items: itemsWithImages.map((item: any) => ({
        id: item.id,

        product_id: item.product_id,

        product_name: item.product_name || '',

        product_price: parseFloat(
          item.product_price || 0
        ),

        quantity: parseInt(item.quantity || 0),

        subtotal: parseFloat(
          item.subtotal || 0
        ),

        image_url: item.image_url || null
      })),

      shipping_address: shippingAddress
    }

    console.log('✅ JSON enviado correctamente')

    return NextResponse.json(orderWithItems)

  } catch (error) {

    console.error(
      '❌ Error obteniendo orden:',
      error
    )

    return NextResponse.json(
      {
        error: 'Error interno del servidor',
        details:
          error instanceof Error
            ? error.message
            : 'Unknown error'
      },
      { status: 500 }
    )
  }
}