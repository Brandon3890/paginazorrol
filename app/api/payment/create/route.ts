// app/api/payment/create/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { transbankService } from '@/lib/transbank-service'
import { query } from '@/lib/db'

function generateSimpleOrderNumber(): string {
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
    console.log('Payment create request body:', body)
    
    const { orderId, amount, isGuest, guestEmail } = body

    if (!orderId || !amount) {
      console.log(' Missing required fields:', { orderId, amount })
      return NextResponse.json(
        { error: 'Faltan datos requeridos: orderId y amount' },
        { status: 400 }
      )
    }

    let userId = null
    let userRut = null

    // Buscar el usuario (logueado o invitado)
    if (isGuest && guestEmail) {
      const guestUser = await query(
        'SELECT id, rut FROM users WHERE email = ? AND is_guest = 1',
        [guestEmail]
      ) as any[]
      
      if (guestUser.length > 0) {
        userId = guestUser[0].id
        userRut = guestUser[0].rut
      } else {
        return NextResponse.json(
          { error: 'Usuario invitado no encontrado' },
          { status: 404 }
        )
      }
    } else {
      // Intentar obtener el userId de la cookie o header
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
          userRut = payload.rut as string || null
          console.log('Usuario autenticado encontrado')
        } catch (error) {
          console.log('Error verificando token:', error)
        }
      }
      
      if (!userId) {
        console.log(' No se encontró usuario autenticado')
        return NextResponse.json(
          { error: 'No autorizado' },
          { status: 401 }
        )
      }
    }

    // Verificar que la orden existe y pertenece al usuario
    const orders = await query(
      `SELECT * FROM orders WHERE id = ? AND user_id = ?`,
      [orderId, userId]
    ) as any[]

    if (orders.length === 0) {
      console.log(' Orden no encontrada:', { orderId, userId })
      return NextResponse.json(
        { error: 'Orden no encontrada' },
        { status: 404 }
      )
    }

    const order = orders[0]

    //  GENERAR NUEVO NÚMERO DE ORDEN
    const newOrderNumber = generateSimpleOrderNumber()
    const transbankBuyOrder = `TBK${Date.now()}${Math.floor(Math.random() * 10000)}`
    const sessionId = `SES${Date.now()}${Math.random().toString(36).substring(2, 15)}`
    const returnUrl = `${process.env.NEXTAUTH_URL}/api/payment/response`

    //  ACTUALIZAR LA ORDEN (SOLO DATOS DE PAGO, NO VALIDAR TÉRMINOS)
    await query(
      `UPDATE orders SET 
        order_number = ?,
        transbank_buy_order = ?,
        transbank_session_id = ?,
        transbank_amount = ?,
        transbank_return_url = ?,
        payment_status = 'pending',
        customer_rut = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [newOrderNumber, transbankBuyOrder, sessionId, amount, returnUrl, userRut, orderId]
    )

    console.log(' Orden actualizada, creando transacción')

    // Crear transacción en Transbank
    const transaction = await transbankService.createTransaction({
      buy_order: transbankBuyOrder,
      session_id: sessionId,
      amount: amount,
      return_url: returnUrl
    })

    console.log(' Transacción creada exitosamente')

    return NextResponse.json({
      success: true,
      token: transaction.token,
      url: transaction.url,
      orderNumber: newOrderNumber,
      transbankBuyOrder: transbankBuyOrder,
      sessionId: sessionId,
      orderId: orderId
    })

  } catch (error: any) {
    console.error(' Error creando transacción :', error)
    return NextResponse.json(
      { 
        error: 'Error interno del servidor al crear transacción',
        details: error.message 
      },
      { status: 500 }
    )
  }
}