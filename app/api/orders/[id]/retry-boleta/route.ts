import { NextRequest, NextResponse } from 'next/server'
import { query, querySimple } from '@/lib/db'
import { getUserIdFromRequest } from '@/lib/auth-utils'
import { emitirBoletaApiGateway, obtenerPDFApiGateway } from '@/lib/apigateway-service'
import { sendBoletaEmail } from '@/lib/email-service'
import { obtenerBoletaConVerificacion } from '@/lib/boleta-helper'

// ============================================================
// CONSTANTES
// ============================================================
const MAX_RETRIES = 30
const RETRY_COOLDOWN_MINUTES = 3
const LOCK_TIMEOUT_SECONDS = 60

// ============================================================
// FUNCIÓN: Obtener lock en la orden
// ============================================================
async function obtenerLockOrden(orderId: number): Promise<boolean> {
  try {
    // Intentar obtener lock con FOR UPDATE
    const lockResult = await query(
      `SELECT id, boleta_emitida, boleta_id 
       FROM orders 
       WHERE id = ? 
       FOR UPDATE`,
      [orderId]
    ) as any[]

    if (lockResult.length === 0) {
      return false
    }

    return true
  } catch (error) {
    console.error(` Error obteniendo lock para orden`, error)
    return false
  }
}

// ============================================================
// FUNCIÓN: Extraer dirección de envío
// ============================================================
function extraerShippingAddress(order: any): {
  street: string
  commune_name: string
  region_name: string
  postal_code: string
  department: string
  instructions: string
} {
  const shippingType = order.shipping_type || ''
  const shippingDetails = order.shipping_details
    ? typeof order.shipping_details === 'string'
      ? JSON.parse(order.shipping_details)
      : order.shipping_details
    : null

  if (shippingType === 'bodega_pickup' && shippingDetails?.selectedBranch) {
    const branch = shippingDetails.selectedBranch
    return {
      street: branch.address || 'Arcangel 1200, San Miguel',
      commune_name: 'San Miguel',
      region_name: 'Región Metropolitana',
      postal_code: '8900000',
      department: '',
      instructions: 'Retiro en Bodega - Horario: Lunes a Viernes 10:00 - 18:00 hrs'
    }
  }

  if (shippingType === 'branch_pickup' && shippingDetails?.selectedBranch) {
    const branch = shippingDetails.selectedBranch
    return {
      street: branch.address || 'Sucursal Chilexpress',
      commune_name: 'Santiago',
      region_name: 'Región Metropolitana',
      postal_code: '000000',
      department: '',
      instructions: `Retiro en Sucursal - ${branch.name}`
    }
  }

  if (order.shipping_street) {
    return {
      street: order.shipping_street || 'No especificada',
      commune_name: order.shipping_commune || 'No especificada',
      region_name: order.shipping_region || 'No especificada',
      postal_code: order.shipping_postal_code || '000000',
      department: order.shipping_department || '',
      instructions: order.shipping_instructions || ''
    }
  }

  return {
    street: 'No especificada',
    commune_name: 'No especificada',
    region_name: 'No especificada',
    postal_code: '000000',
    department: '',
    instructions: ''
  }
}

// ============================================================
// FUNCIÓN: Enviar email con boleta (con reintentos)
// ============================================================
async function enviarEmailConReintentos(
  emailData: any,
  pdfBuffer: Buffer,
  folio: string,
  maxRetries: number = 3
): Promise<boolean> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Enviando email - Intento ${attempt}/${maxRetries}`)
      
      const result = await sendBoletaEmail(emailData, pdfBuffer, folio)
      
      if (result) {
        console.log(` Email enviado exitosamente`)
        return true
      }
      
      throw new Error('sendBoletaEmail returned false')
    } catch (error: any) {
      lastError = error
      console.error(` Error enviando email (intento ${attempt}):`, error.message)
      
      if (attempt < maxRetries) {
        const waitTime = Math.pow(2, attempt) * 1000
        console.log(` Esperando ${waitTime/1000}s antes de reintentar...`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }
  }

  console.error(` Falló envío de email después de ${maxRetries} intentos:`, lastError?.message)
  return false
}

// ============================================================
// MAIN: POST
// ============================================================
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let transactionStarted = false

  try {
    const { id } = await params
    const orderId = parseInt(id)

    if (isNaN(orderId)) {
      return NextResponse.json({ error: 'ID de orden inválido' }, { status: 400 })
    }

    console.log(` [${new Date().toISOString()}] Reintentando boleta para orden ${orderId}`)

    // ============================================================
    // 1. OBTENER USUARIO AUTENTICADO
    // ============================================================
    const userId = await getUserIdFromRequest(request)

    // ============================================================
    // 2. INICIAR TRANSACCIÓN Y OBTENER LOCK
    // ============================================================
    await querySimple('START TRANSACTION')
    transactionStarted = true

    //  OBTENER LOCK CON FOR UPDATE
    const lockAcquired = await obtenerLockOrden(orderId)

    if (!lockAcquired) {
      await querySimple('ROLLBACK')
      transactionStarted = false
      return NextResponse.json(
        { error: 'No se pudo obtener el bloqueo de la orden. Intenta nuevamente.' },
        { status: 409 }
      )
    }

    // ============================================================
    // 3. OBTENER LA ORDEN CON LOCK
    // ============================================================
    const orders = await query(
      `SELECT 
        o.*,
        u.email as customer_email,
        u.first_name as customer_first_name,
        u.last_name as customer_last_name,
        u.phone as customer_phone,
        u.rut as customer_rut,
        u.is_guest as is_guest,
        ua.street as shipping_street,
        ua.commune_name as shipping_commune,
        ua.region_name as shipping_region,
        ua.postal_code as shipping_postal_code,
        ua.department as shipping_department,
        ua.delivery_instructions as shipping_instructions
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN user_addresses ua ON o.shipping_address_id = ua.id
      WHERE o.id = ?
      FOR UPDATE`,
      [orderId]
    ) as any[]

    if (orders.length === 0) {
      await querySimple('ROLLBACK')
      transactionStarted = false
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
    }

    const order = orders[0]

    // ============================================================
    // 4. VALIDAR PROPIEDAD DE LA ORDEN
    // ============================================================
    if (order.is_guest !== 1) {
      if (!userId) {
        await querySimple('ROLLBACK')
        transactionStarted = false
        return NextResponse.json(
          { error: 'Debes iniciar sesión para ver esta orden' },
          { status: 401 }
        )
      }

      if (order.user_id !== userId) {
        await querySimple('ROLLBACK')
        transactionStarted = false
        console.log(` Intento de acceso no autorizado: Usuario ${userId} -> Orden ${orderId}`)
        return NextResponse.json(
          { error: 'No tienes permiso para acceder a esta orden' },
          { status: 403 }
        )
      }
    }

    // ============================================================
    // 5. VERIFICAR SI YA EXISTE BOLETA
    // ============================================================
    const existingBoleta = await query(
      `SELECT id, folio FROM boletas WHERE order_id = ?`,
      [orderId]
    ) as any[]

    if (existingBoleta.length > 0) {
      if (order.boleta_emitida !== 1) {
        await query(
          `UPDATE orders SET boleta_id = ?, boleta_emitida = 1 WHERE id = ?`,
          [existingBoleta[0].id, orderId]
        )
      }
      await querySimple('COMMIT')
      transactionStarted = false
      return NextResponse.json({
        success: true,
        folio: existingBoleta[0].folio,
        boleta_id: existingBoleta[0].id,
        already_exists: true,
        message: 'Esta orden ya tiene una boleta emitida'
      })
    }

    // ============================================================
    // 6. VERIFICAR PAGO APROBADO
    // ============================================================
    if (order.payment_status !== 'paid') {
      await querySimple('ROLLBACK')
      transactionStarted = false
      return NextResponse.json({
        error: 'Esta orden no tiene un pago aprobado',
        code: 'PAYMENT_NOT_PAID'
      }, { status: 400 })
    }

    // ============================================================
    // 7. VERIFICAR LÍMITE DE REINTENTOS
    // ============================================================
    const intentos = order.boleta_intentos || 0

    if (intentos >= MAX_RETRIES) {
      await querySimple('ROLLBACK')
      transactionStarted = false
      return NextResponse.json({
        error: `Se excedió el número máximo de reintentos (${MAX_RETRIES}). Contacta a soporte.`,
        code: 'MAX_RETRIES_EXCEEDED',
        maxIntentos: MAX_RETRIES,
        intentos: intentos
      }, { status: 400 })
    }

    // ============================================================
    // 8. VERIFICAR COOLDOWN
    // ============================================================
    if (order.boleta_ultimo_intento) {
      const ultimoIntento = new Date(order.boleta_ultimo_intento)
      const ahora = new Date()
      const diffMinutos = (ahora.getTime() - ultimoIntento.getTime()) / 60000

      if (diffMinutos < RETRY_COOLDOWN_MINUTES) {
        const minutosRestantes = Math.ceil(RETRY_COOLDOWN_MINUTES - diffMinutos)
        await querySimple('ROLLBACK')
        transactionStarted = false
        return NextResponse.json({
          error: `Debes esperar ${minutosRestantes} minuto(s) antes de reintentar`,
          code: 'COOLDOWN_ACTIVE',
          waitingMinutes: minutosRestantes,
          nextAttemptAt: new Date(ultimoIntento.getTime() + RETRY_COOLDOWN_MINUTES * 60000).toISOString()
        }, { status: 429 })
      }
    }

    // ============================================================
    // 9. OBTENER ITEMS DE LA ORDEN
    // ============================================================
    const orderItems = await query(
      `SELECT product_name, product_price, quantity, subtotal 
       FROM order_items 
       WHERE order_id = ?`,
      [orderId]
    ) as any[]

    if (orderItems.length === 0) {
      await querySimple('ROLLBACK')
      transactionStarted = false
      return NextResponse.json({
        error: 'No hay productos en esta orden',
        code: 'NO_PRODUCTS'
      }, { status: 400 })
    }

    // ============================================================
    // 10. REGISTRAR EL INTENTO
    // ============================================================
    const nuevoIntento = intentos + 1
    await query(
      `UPDATE orders SET 
        boleta_intentos = ?,
        boleta_ultimo_intento = NOW(),
        boleta_error = NULL
      WHERE id = ?`,
      [nuevoIntento, orderId]
    )

    // Commit de la transacción (liberar lock)
    await querySimple('COMMIT')
    transactionStarted = false

    // ============================================================
    // 11. PREPARAR DATOS DEL CLIENTE
    // ============================================================
    const rutCliente = order.customer_rut || '66666666-6'
    const nombreCliente = order.customer_first_name || 'Consumidor Final'
    const apellidoCliente = order.customer_last_name || ''
    const nombreCompleto = `${nombreCliente} ${apellidoCliente}`.trim()
    const emailCliente = order.customer_email || null


    // ============================================================
    // 12. PREPARAR PRODUCTOS
    // ============================================================
    const productos = orderItems.map((item: any) => ({
      nombre: item.product_name,
      cantidad: item.quantity,
      precio: parseFloat(item.product_price)
    }))

    const totalFinal = parseFloat(order.total)

    // ============================================================
    // 13. EMITIR LA BOLETA CON REINTENTOS INTELIGENTES
    // ============================================================
    let boletaEmitida = false
    let folio = null
    let ultimoError = null
    let boletaData = null

    const maxApiRetries = 3
    let apiAttempt = 0

    while (!boletaEmitida && apiAttempt < maxApiRetries) {
      apiAttempt++

      try {
        console.log(` Intento ${apiAttempt}/${maxApiRetries} de emitir boleta...`)

        const result = await emitirBoletaApiGateway(
          productos,
          {
            rut: rutCliente,
            nombre: nombreCompleto,
            direccion: 'Santiago',
            comuna: 'Santiago',
            ciudad: 'Santiago',
            telefono: order.customer_phone || undefined,
            email: emailCliente || undefined
          },
          totalFinal
        )

        if (result && result.data && result.data.folio) {
          folio = result.data.folio
          boletaData = result.data
          boletaEmitida = true
          console.log(` Boleta emitida. Folio: ${folio}`)
          break
        } else {
          throw new Error('Respuesta inválida de ApiGateway')
        }

      } catch (error: any) {
        ultimoError = error.message || 'Error desconocido'
        console.error(` Error en intento ${apiAttempt}:`, ultimoError)

        // Si es error 400, 404, 500, esperar y reintentar
        if (apiAttempt < maxApiRetries) {
          const waitTime = Math.pow(2, apiAttempt) * 1000
          console.log(` Esperando ${waitTime/1000}s antes de reintentar...`)
          await new Promise(resolve => setTimeout(resolve, waitTime))
        }
      }
    }

    // ============================================================
    // 14. MANEJAR RESULTADO DE EMISIÓN
    // ============================================================
    if (!boletaEmitida || !folio) {
      // Guardar error en BD
      await query(
        `UPDATE orders SET 
          boleta_error = ?,
          boleta_ultimo_intento = NOW()
        WHERE id = ?`,
        [ultimoError || 'Error al emitir boleta', orderId]
      )

      return NextResponse.json({
        error: `Error al emitir boleta después de ${maxApiRetries} intentos: ${ultimoError}`,
        code: 'BOLETA_EMISSION_FAILED',
        intentos: nuevoIntento,
        maxIntentos: MAX_RETRIES,
        canRetry: nuevoIntento < MAX_RETRIES,
        nextRetryAfter: RETRY_COOLDOWN_MINUTES
      }, { status: 500 })
    }

    // ============================================================
    // 15. GUARDAR EN BASE DE DATOS (con nueva transacción)
    // ============================================================
    await querySimple('START TRANSACTION')
    transactionStarted = true

    const iva = Math.round(totalFinal / 1.19 * 0.19)
    const fechaEmision = new Date().toISOString().slice(0, 19).replace('T', ' ')

    const insertResult = await query(
      `INSERT INTO boletas (
        order_id, folio, tipo_dte, rut_emisor, rut_receptor, 
        razon_social_receptor, monto_total, iva, fecha_emision, 
        ambiente, estado_sii, fecha_creacion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        orderId,
        folio,
        39,
        process.env.APIGATEWAY_RUT_EMISOR || '78364115-1',
        rutCliente,
        nombreCompleto || 'Consumidor Final',
        totalFinal,
        iva,
        fechaEmision,
        'produccion',
        'emitida'
      ]
    ) as any

    const boletaId = insertResult.insertId

    await query(
      `UPDATE orders SET 
        boleta_id = ?,
        boleta_emitida = 1,
        boleta_intentos = 0,
        boleta_error = NULL,
        boleta_ultimo_intento = NOW()
      WHERE id = ?`,
      [boletaId, orderId]
    )

    await querySimple('COMMIT')
    transactionStarted = false

    console.log(` Boleta guardada exitosamente`)

    // ============================================================
    // 16. ENVIAR EMAIL CON BOLETA (asíncrono, no bloqueante)
    // ============================================================
    try {
      // Obtener PDF
      const resultadoBoletaVerificada = await obtenerBoletaConVerificacion(
        folio,
        fechaEmision
      )

      if (resultadoBoletaVerificada.success && resultadoBoletaVerificada.pdfBuffer) {
        const pdfBuffer = resultadoBoletaVerificada.pdfBuffer
        const shippingAddress = extraerShippingAddress(order)

        const emailData = {
          orderNumber: order.order_number,
          customerName: nombreCompleto || 'Cliente',
          customerEmail: order.customer_email,
          customerPhone: order.customer_phone || 'No especificado',
          orderDate: new Date(order.created_at).toLocaleDateString('es-CL'),
          paymentMethod: 'Transbank Webpay',
          items: orderItems.map((item: any) => ({
            product_name: item.product_name,
            product_price: parseFloat(item.product_price),
            quantity: item.quantity,
            subtotal: parseFloat(item.subtotal)
          })),
          subtotal: parseFloat(order.subtotal),
          discount: parseFloat(order.discount || 0),
          shipping: parseFloat(order.shipping || 0),
          tax: 0,
          total: parseFloat(order.total || 0),
          shippingAddress: shippingAddress,
          storeInfo: {
            name: process.env.APIGATEWAY_RAZON_SOCIAL || 'Zorro Lúdico',
            rut: process.env.APIGATEWAY_RUT_EMISOR || '78364115-1',
            giro: process.env.APIGATEWAY_GIRO || 'Venta de juegos',
            direccion: process.env.APIGATEWAY_DIRECCION || 'Marchant Pereira 150 Oficina 901',
            comuna: process.env.APIGATEWAY_COMUNA || 'San Miguel',
            ciudad: process.env.APIGATEWAY_CIUDAD || 'Santiago'
          }
        }

        // Enviar email con reintentos
        await enviarEmailConReintentos(emailData, pdfBuffer, String(folio))
      } else {
        console.warn(` No se pudo obtener PDF para el email de la orden ${orderId}`)
      }
    } catch (emailError) {
      console.error(` Error en envío de email para orden`, emailError)
      // No fallamos la respuesta si el email falla
    }

    // ============================================================
    // 17. RESPUESTA EXITOSA
    // ============================================================
    return NextResponse.json({
      success: true,
      folio: folio,
      boleta_id: boletaId,
      message: `Boleta emitida exitosamente. Folio: ${folio}`
    })

  } catch (error: any) {
    // Si hay una transacción activa, hacer rollback
    if (transactionStarted) {
      try {
        await querySimple('ROLLBACK')
      } catch (rollbackError) {
        console.error(' Error al hacer rollback:', rollbackError)
      }
    }

    console.error(' Error en retry-boleta:', error)
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    )
  }
}