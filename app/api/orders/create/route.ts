import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

function generateOrderNumber(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const random = Math.floor(Math.random() * 9000 + 1000)
  return `ORD-${year}${month}${day}-${random}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      items,
      customerInfo,
      shippingAddress,
      totals,
      notes,
      couponId,
      couponCode,
      guestSessionId
    } = body

    if (!items || !items.length) {
      return NextResponse.json(
        { error: 'No hay productos en la orden' },
        { status: 400 }
      )
    }

    if (!customerInfo?.email || !customerInfo?.firstName || !customerInfo?.lastName) {
      return NextResponse.json(
        { error: 'Datos del cliente incompletos' },
        { status: 400 }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(customerInfo.email)) {
      return NextResponse.json(
        { error: 'Email invalido' },
        { status: 400 }
      )
    }

    // Buscar o crear usuario
    const existingUser = await query(
      'SELECT id, is_guest FROM users WHERE email = ?',
      [customerInfo.email]
    ) as any[]
    
    let userId = null
    
    if (existingUser.length > 0) {
      userId = existingUser[0].id
    } else {
      const fakePasswordHash = 'GUEST_ACCOUNT_NO_LOGIN_' + Date.now()
      
      const insertResult = await query(
        `INSERT INTO users (email, password_hash, first_name, last_name, phone, rut, role, is_active, email_verified, is_guest)
         VALUES (?, ?, ?, ?, ?, ?, 'customer', 1, 1, 1)`,
        [
          customerInfo.email,
          fakePasswordHash,
          customerInfo.firstName,
          customerInfo.lastName,
          customerInfo.phone || null,
          customerInfo.rut || '55555555-5'
        ]
      ) as any
      
      userId = insertResult.insertId
    }

    const orderNumber = generateOrderNumber()

    // Validar dirección
    if (!shippingAddress?.street || !shippingAddress?.communeName) {
      return NextResponse.json(
        { error: 'Direccion de envio incompleta' },
        { status: 400 }
      )
    }

    // Crear dirección
    const addressResult = await query(
      `INSERT INTO user_addresses 
       (user_id, title, street, has_no_number, region_iso, region_name, commune_name, postal_code, department, delivery_instructions, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        'Dirección de envío',
        shippingAddress.street,
        shippingAddress.hasNoNumber || 0,
        shippingAddress.regionIso || 'CL-RM',
        shippingAddress.regionName || 'Región Metropolitana',
        shippingAddress.communeName,
        shippingAddress.postalCode || '0000000',
        shippingAddress.department || null,
        shippingAddress.deliveryInstructions || null,
        0 // No es predeterminada para no sobrescribir
      ]
    ) as any
    
    const shippingAddressId = addressResult.insertId
    console.log('Dirección creada')

    // Calcular impuestos
    const tax = Math.round(totals.total * 0.19)

    // Crear orden CON el shipping_address_id
    const orderResult = await query(
      `INSERT INTO orders (
        user_id, customer_rut, order_number, status, subtotal, discount, shipping, tax, total,
        coupon_id, coupon_code, shipping_address_id, payment_method, payment_status, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        userId,
        customerInfo.rut || '55555555-5',
        orderNumber,
        'pending',
        totals.subtotal,
        totals.discount,
        totals.shipping || 0,
        tax,
        totals.total,
        couponId || null,
        couponCode || null,
        shippingAddressId,
        'transbank',
        'pending',
        notes || null
      ]
    ) as any
    
    const orderId = orderResult.insertId
    console.log('Orden creada ')

    // Crear items de la orden - SIN LA COLUMNA 'category'
    for (const item of items) {
      await query(
        `INSERT INTO order_items (order_id, product_id, product_name, product_price, quantity, subtotal)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          item.id,
          item.name || 'Producto',
          item.price || 0,
          item.quantity || 1,
          (item.price || 0) * (item.quantity || 1)
        ]
      )
    }
    console.log(' Items de la orden creados:', items.length)

    // Guardar guest session si existe
    if (guestSessionId) {
      await query(
        `INSERT INTO guest_orders (user_id, guest_session_id, order_number, order_id, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [userId, guestSessionId, orderNumber, orderId]
      )
    }

    return NextResponse.json({
      success: true,
      orderId,
      orderNumber,
      userId
    })

  } catch (error: any) {
    console.error('Error creando orden:', error)
    return NextResponse.json(
      { error: 'Error al crear la orden: ' + error.message },
      { status: 500 }
    )
  }
}