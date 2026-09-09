import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

interface OrderItem {
  id: number
  name: string
  price: number
  quantity: number
  image?: string
  category?: string
}

interface CustomerInfo {
  email: string
  firstName: string
  lastName: string
  phone: string
  rut: string
}

interface ShippingAddress {
  street: string
  hasNoNumber?: boolean
  regionIso?: string
  regionName?: string
  communeName?: string
  postalCode?: string
  department?: string
  deliveryInstructions?: string
}

interface Totals {
  subtotal: number
  discount: number
  shipping: number
  tax: number
  total: number
}

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
      shippingMethod,
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

    // Validar datos mínimos
    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'No hay productos en el pedido' },
        { status: 400 }
      )
    }

    // =====================================================
    // 1. OBTENER USUARIO DESDE LA BASE DE DATOS
    // =====================================================
    let userId = null
    let userRut: string | null = null
    let userEmail: string | null = null
    let userFirstName: string | null = null
    let userLastName: string | null = null
    let userPhone: string | null = null
    
    const authHeader = request.headers.get('authorization')
    let token = null
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7)
    } else {
      const cookie = request.cookies.get('auth_token')
      if (cookie) {
        token = cookie.value
      }
    }
    
    if (token) {
      try {
        const { jwtVerify } = await import('jose')
        const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)
        const { payload } = await jwtVerify(token, JWT_SECRET)
        userId = payload.userId as string
        
        if (userId) {
          const userResult = await query(
            `SELECT id, rut, email, first_name, last_name, phone FROM users WHERE id = ?`,
            [userId]
          ) as any[]
          
          if (userResult.length > 0) {
            const user = userResult[0]
            userRut = user.rut
            userEmail = user.email
            userFirstName = user.first_name
            userLastName = user.last_name
            userPhone = user.phone
          }
        }
      } catch (error) {
        console.log(' Error verificando token:', error)
      }
    }

    // =====================================================
    // 2. VERIFICAR QUE EL USUARIO ESTÁ AUTENTICADO
    // =====================================================
    if (!userId) {
      console.log(' Usuario no autenticado')
      return NextResponse.json(
        { error: 'Usuario no autenticado' },
        { status: 401 }
      )
    }

    // =====================================================
    // 3. DATOS DEL CLIENTE - RUT OPCIONAL PARA USUARIOS REGISTRADOS
    // =====================================================
    // Si se proporcionó un RUT en customerInfo, usarlo
    // Si no, usar el RUT de la cuenta del usuario
    // Si el usuario no tiene RUT, usar consumidor final
    let customerRut = customerInfo?.rut || userRut || null
    
    // Si es '66666666-6' o null/undefined, usar consumidor final
    if (!customerRut || customerRut === '66666666-6') {
      customerRut = '66666666-6'
    }
    
    const customerEmail = customerInfo?.email || userEmail || null
    const customerFirstName = customerInfo?.firstName || userFirstName || null
    const customerLastName = customerInfo?.lastName || userLastName || null
    const customerPhone = customerInfo?.phone || userPhone || null


    // =====================================================
    // 4. CALCULAR TOTALES
    // =====================================================
    const subtotal = totals?.subtotal || 0
    const discount = totals?.discount || 0
    const shipping = totals?.shipping || 0
    const tax = totals?.tax || 0
    const total = totals?.total || 0

    // =====================================================
    // 5. GENERAR NÚMERO DE ORDEN
    // =====================================================
    const orderNumber = generateOrderNumber()

    // =====================================================
    // 6. INSERTAR DIRECCIÓN (si se proporcionó)
    // =====================================================
    let shippingAddressId = null
    
    // Solo insertar dirección si hay un userId válido
    if (shippingAddress && userId) {
      // Verificar si la dirección ya existe
      const existingAddresses = await query(
        `SELECT id FROM user_addresses 
         WHERE user_id = ? 
         AND street = ? 
         AND commune_name = ?`,
        [userId, shippingAddress.street, shippingAddress.communeName]
      ) as any[]

      if (existingAddresses.length > 0) {
        shippingAddressId = existingAddresses[0].id
        console.log(`Usando dirección existente`)
      } else {
        const addressResult = await query(
          `INSERT INTO user_addresses (
            user_id, title, street, has_no_number, region_iso, region_name, 
            commune_name, postal_code, department, delivery_instructions, is_default
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            'Dirección de envío',
            shippingAddress.street || 'No especificada',
            shippingAddress.hasNoNumber || 0,
            shippingAddress.regionIso || 'CL-RM',
            shippingAddress.regionName || 'Región Metropolitana',
            shippingAddress.communeName || 'Santiago',
            shippingAddress.postalCode || '000000',
            shippingAddress.department || '',
            shippingAddress.deliveryInstructions || '',
            0
          ]
        ) as any
        shippingAddressId = addressResult.insertId
        console.log(`Nueva dirección creada`)
      }
    } else if (shippingAddress && !userId) {
      console.log(' No se puede guardar dirección sin el usuario')
    }

    // =====================================================
    // 7. INSERTAR LA ORDEN
    // =====================================================

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
        shipping_type,
        shipping_details,
        tax,
        total,
        coupon_id,
        coupon_code,
        shipping_address_id,
        payment_status,
        notes,
        created_at,
        updated_at,
        boleta_emitida,
        boleta_intentos
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), 0, 0)`,
      [
        userId,
        customerRut,
        customerEmail,
        customerFirstName,
        customerLastName,
        customerPhone,
        orderNumber,
        'pending',
        subtotal,
        discount,
        shipping,
        shippingType || 'standard',
        shippingDetails ? JSON.stringify(shippingDetails) : null,
        tax,
        total,
        couponId || null,
        couponCode || null,
        shippingAddressId,
        'pending',
        notes || null
      ]
    ) as any

    const orderId = orderResult.insertId

    console.log('Orden creada ')

    // =====================================================
    // 8. INSERTAR ITEMS DE LA ORDEN
    // =====================================================
    for (const item of items) {
      await query(
        `INSERT INTO order_items (
          order_id, product_id, product_name, product_price, quantity, subtotal
        ) VALUES (?, ?, ?, ?, ?, ?)`,
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

    console.log(`productos agregados a la orden`)

    // =====================================================
    // 9. CONFIRMAR RESERVA DE STOCK
    // =====================================================
    if (userId) {
      try {
        await fetch(new URL('/api/cart/reserve-stock', request.url), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: items.map((item: OrderItem) => ({
              id: item.id,
              quantity: item.quantity
            })),
            action: 'confirm'
          })
        })
        console.log(' Stock confirmado para la orden')
      } catch (stockError) {
        console.warn(' Error al confirmar stock:', stockError)
      }
    }

    // =====================================================
    // 10. DEVOLVER RESPUESTA
    // =====================================================
    return NextResponse.json({
      success: true,
      orderId: orderId,
      orderNumber: orderNumber,
      userId: userId,
      customerRut: customerRut,
      customerEmail: customerEmail,
      message: 'Orden creada exitosamente'
    })

  } catch (error: any) {
    console.error(' Error al crear la orden:', error)
    return NextResponse.json(
      { error: error.message || 'Error al crear la orden' },
      { status: 500 }
    )
  }
}