// app/api/orders/emitir-boleta/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { emitirBoletaApiGateway } from '@/lib/apigateway-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { orderId } = body

    if (!orderId) {
      return NextResponse.json(
        { error: 'ID de orden requerido' },
        { status: 400 }
      )
    }

    console.log(`Emitiendo boleta para orden ${orderId}`)

    // Obtener la orden
    const orders = await query(
      `SELECT o.*, 
              u.rut as user_rut,
              u.first_name as user_first_name,
              u.last_name as user_last_name,
              u.phone as user_phone,
              u.email as user_email
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       WHERE o.id = ?`,
      [orderId]
    ) as any[]

    if (orders.length === 0) {
      return NextResponse.json(
        { error: 'Orden no encontrada' },
        { status: 404 }
      )
    }

    const order = orders[0]

    // ✅ VERIFICAR SI YA TIENE BOLETA
    const existingBoleta = await query(
      `SELECT id, folio FROM boletas WHERE order_id = ?`,
      [orderId]
    ) as any[]

    if (existingBoleta.length > 0) {
      // Actualizar la orden si es necesario
      if (order.boleta_emitida !== 1) {
        await query(
          `UPDATE orders SET boleta_id = ?, boleta_emitida = 1 WHERE id = ?`,
          [existingBoleta[0].id, orderId]
        )
      }
      
      return NextResponse.json({
        success: true,
        folio: existingBoleta[0].folio,
        already_exists: true,
        message: 'Boleta ya emitida'
      })
    }

    // Verificar que el pago esté aprobado
    if (order.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'El pago de esta orden no ha sido aprobado' },
        { status: 400 }
      )
    }

    // Obtener items de la orden
    const items = await query(
      `SELECT product_name, quantity, product_price FROM order_items WHERE order_id = ?`,
      [orderId]
    ) as any[]

    if (items.length === 0) {
      return NextResponse.json(
        { error: 'No hay productos en la orden' },
        { status: 400 }
      )
    }

    // Preparar datos del cliente
    const rutCliente = order.customer_rut || order.user_rut || '66666666-6'
    const nombreCliente = order.customer_first_name || order.user_first_name || 'Consumidor Final'
    const apellidoCliente = order.customer_last_name || order.user_last_name || ''
    const nombreCompleto = `${nombreCliente} ${apellidoCliente}`.trim()
    const direccion = 'Santiago'
    const comuna = 'Santiago'
    const ciudad = 'Santiago'
    const telefono = order.customer_phone || order.user_phone || undefined
    const email = order.customer_email || order.user_email || undefined


    // Emitir boleta
    const productos = items.map((item: any) => ({
      nombre: item.product_name,
      cantidad: item.quantity,
      precio: parseFloat(item.product_price)
    }))

    const total = parseFloat(order.total)

    const resultado = await emitirBoletaApiGateway(
      productos,
      {
        rut: rutCliente,
        nombre: nombreCompleto,
        direccion: direccion,
        comuna: comuna,
        ciudad: ciudad,
        telefono: telefono,
        email: email
      },
      total
    )

    if (!resultado || !resultado.data || !resultado.data.folio) {
      console.error(' Respuesta inválida de ApiGateway:', resultado)
      return NextResponse.json(
        { error: 'Error al emitir boleta: respuesta inválida' },
        { status: 500 }
      )
    }

    const folio = resultado.data.folio
    console.log(` Boleta emitida. Folio: ${folio}`)

    // Guardar en la tabla boletas
    const neto = Math.round(total / 1.19)
    const iva = total - neto
    const fechaEmision = new Date().toISOString().slice(0, 19).replace('T', ' ')

    const insertResult = await query(
      `INSERT INTO boletas (
        order_id, folio, tipo_dte, rut_emisor, rut_receptor, 
        razon_social_receptor, monto_total, iva, fecha_emision, ambiente, estado_sii
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        folio,
        39,
        process.env.APIGATEWAY_RUT_EMISOR || '78364115-1',
        rutCliente,
        nombreCompleto,
        total,
        iva,
        fechaEmision,
        'produccion',
        'emitida'
      ]
    ) as any

    const boletaId = insertResult.insertId

    // Actualizar la orden
    await query(
      `UPDATE orders SET 
        boleta_id = ?,
        boleta_emitida = 1,
        boleta_intentos = 0,
        boleta_error = NULL
      WHERE id = ?`,
      [boletaId, orderId]
    )

    console.log(` Boleta guardada `)

    // Intentar enviar email
    if (email) {
      try {
        const emailResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/orders/${orderId}/resend-email`, {
          method: 'POST',
        })
        if (emailResponse.ok) {
          console.log(` Email enviado a: ${email}`)
        }
      } catch (emailError) {
        console.warn(' Error enviando email:', emailError)
      }
    }

    return NextResponse.json({
      success: true,
      folio: folio,
      boleta_id: boletaId,
      estado: 'emitida',
      message: 'Boleta emitida exitosamente'
    })

  } catch (error: any) {
    console.error(' Error emitiendo boleta:', error)
    return NextResponse.json(
      { error: error.message || 'Error al emitir la boleta' },
      { status: 500 }
    )
  }
}