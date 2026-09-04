// app/api/orders/create-guest/route.ts
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

function generateGuestRut(userId: number): string {
  const baseRut = '66666666'
  const digit = '6'
  return `${baseRut}${userId}-${digit}`
}

// Dirección de la bodega
const BODEGA_ADDRESS = {
  street: "Arcangel 1200, San Miguel",
  hasNoNumber: false,
  regionIso: 'CL-RM',
  regionName: 'Región Metropolitana',
  communeName: 'San Miguel',
  postalCode: '8900000',
  department: '',
  deliveryInstructions: 'Retiro en bodega - Horario 10:00 a 18:00 hrs'
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
      guestSessionId,
      shippingType,
      shippingDetails,
      acceptedTerms
    } = body

    // Validar términos y condiciones
    if (!acceptedTerms) {
      return NextResponse.json(
        { error: 'Debes aceptar los Términos y Condiciones' },
        { status: 400 }
      )
    }

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
        { error: 'Email inválido' },
        { status: 400 }
      )
    }

    // Buscar usuario por email
    const existingUser = await query(
      'SELECT id, is_guest FROM users WHERE email = ?',
      [customerInfo.email]
    ) as any[]
    
    let userId = null
    let isGuestUser = true
    
    if (existingUser.length > 0) {
      userId = existingUser[0].id
      isGuestUser = existingUser[0].is_guest === 1
      console.log(`Usuario existente encontrado: ${userId} (is_guest: ${isGuestUser})`)
    } else {
      // Crear nuevo usuario invitado
      const fakePasswordHash = 'GUEST_ACCOUNT_NO_LOGIN_' + Date.now()
      
      const insertResult = await query(
        `INSERT INTO users (email, password_hash, first_name, last_name, phone, role, is_active, email_verified, is_guest)
         VALUES (?, ?, ?, ?, ?, 'customer', 1, 1, 1)`,
        [
          customerInfo.email,
          fakePasswordHash,
          customerInfo.firstName,
          customerInfo.lastName,
          customerInfo.phone || null
        ]
      ) as any
      
      userId = insertResult.insertId
      isGuestUser = true
      
      const guestRut = generateGuestRut(userId)
      await query(
        'UPDATE users SET rut = ? WHERE id = ?',
        [guestRut, userId]
      )
      console.log(`Usuario invitado creado con ID: ${userId}, RUT: ${guestRut}`)
    }

    const orderNumber = generateOrderNumber()

    // Validar dirección (solo si no es retiro en bodega)
    const isBodegaPickup = shippingType === 'bodega_pickup'
    if (!isBodegaPickup && (!shippingAddress?.street || !shippingAddress?.communeName)) {
      return NextResponse.json(
        { error: 'Dirección de envío incompleta' },
        { status: 400 }
      )
    }

    let shippingAddressId = null

    // Solo guardar la dirección en user_addresses si NO es retiro en bodega
    if (!isBodegaPickup && shippingAddress) {
      if (!isGuestUser) {
        // Usuario registrado - verificar si ya tiene esta dirección
        const existingAddresses = await query(
          `SELECT id FROM user_addresses 
           WHERE user_id = ? 
           AND street = ? 
           AND commune_name = ?`,
          [userId, shippingAddress.street, shippingAddress.communeName]
        ) as any[]

        if (existingAddresses.length > 0) {
          shippingAddressId = existingAddresses[0].id
          console.log(`Usando dirección existente: ${shippingAddressId}`)
        }
      }
      
      if (!shippingAddressId) {
        const addressTitle = isGuestUser ? 'Dirección de invitado' : 'Dirección de envío'
        
        const addressResult = await query(
          `INSERT INTO user_addresses 
           (user_id, title, street, has_no_number, region_iso, region_name, commune_name, postal_code, department, delivery_instructions, is_default)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            addressTitle,
            shippingAddress.street,
            shippingAddress.hasNoNumber || 0,
            shippingAddress.regionIso || 'CL-RM',
            shippingAddress.regionName,
            shippingAddress.communeName,
            shippingAddress.postalCode || '0000000',
            shippingAddress.department || null,
            shippingAddress.deliveryInstructions || null,
            1
          ]
        ) as any
        
        shippingAddressId = addressResult.insertId
        console.log(`Nueva dirección creada: ${shippingAddressId}`)
      }
    } else {
      console.log(`Retiro en bodega - sin dirección guardada`)
    }

    const tax = Math.round(totals.total * 0.19)

    // Usar dirección de bodega si corresponde
    let finalShippingAddress = shippingAddress
    if (isBodegaPickup) {
      finalShippingAddress = BODEGA_ADDRESS
    }

    //  OBTENER DATOS DEL CLIENTE
    const customerRut = isGuestUser ? '66666666-6' : (customerInfo?.rut || '66666666-6')
    const customerEmail = customerInfo?.email || null
    const customerFirstName = customerInfo?.firstName || null
    const customerLastName = customerInfo?.lastName || null
    const customerPhone = customerInfo?.phone || null

    // Crear orden con todos los datos del cliente
    const orderResult = await query(
      `INSERT INTO orders (
        user_id, 
        customer_rut, 
        customer_email,
        customer_first_name,
        customer_last_name,
        customer_phone,
        order_number, 
        status, 
        subtotal, 
        discount, 
        shipping, 
        tax, 
        total,
        coupon_id, 
        coupon_code, 
        shipping_address_id, 
        payment_method, 
        payment_status, 
        notes,
        shipping_type, 
        shipping_details, 
        created_at,
        updated_at,
        boleta_emitida,
        boleta_intentos
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), 0, 0)`,
      [
        userId,
        customerRut,
        customerEmail,
        customerFirstName,
        customerLastName,
        customerPhone,
        orderNumber,
        'pending',
        totals.subtotal,
        totals.discount,
        totals.shipping,
        tax,
        totals.total,
        couponId || null,
        couponCode || null,
        shippingAddressId,
        'transbank',
        'pending',
        notes || null,
        shippingType || 'standard',
        shippingDetails ? JSON.stringify(shippingDetails) : null
      ]
    ) as any
    
    const orderId = orderResult.insertId
    console.log(`Orden invitado creada con ID: ${orderId}, shipping_type: ${shippingType}`)

    // Insertar items
    for (const item of items) {
      await query(
        `INSERT INTO order_items (order_id, product_id, product_name, product_price, quantity, subtotal)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          item.id,
          item.name,
          item.price,
          item.quantity,
          item.price * item.quantity
        ]
      )
    }

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
      userId,
      isGuest: isGuestUser
    })

  } catch (error: any) {
    console.error('Error creando orden de invitado:', error)
    return NextResponse.json(
      { error: 'Error al crear la orden: ' + error.message },
      { status: 500 }
    )
  }
}