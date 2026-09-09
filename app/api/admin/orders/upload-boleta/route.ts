// app/api/admin/orders/upload-boleta/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserIdFromRequest } from '@/lib/auth-utils'
import fs from 'fs'
import path from 'path'

// Función para generar el próximo folio de admin
async function generarProximoFolioAdmin(): Promise<string> {
  // Obtener el último folio de admin
  const result = await query(
    `SELECT folio FROM admin_boleta_folios ORDER BY id DESC LIMIT 1`
  ) as any[]

  let nextNumber = 1
  if (result.length > 0) {
    const lastFolio = result[0].folio
    const match = lastFolio.match(/^ADMIN-(\d+)$/)
    if (match) {
      nextNumber = parseInt(match[1]) + 1
    }
  }

  return `ADMIN-${String(nextNumber).padStart(5, '0')}`
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request)
    
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
      return NextResponse.json({ error: 'No tienes permisos para realizar esta acción' }, { status: 403 })
    }

    const formData = await request.formData()
    const pdfFile = formData.get('pdf') as File
    const orderId = formData.get('orderId') as string

    if (!pdfFile || !orderId) {
      return NextResponse.json(
        { error: 'Faltan datos: PDF y orderId son requeridos' },
        { status: 400 }
      )
    }

    if (pdfFile.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'El archivo debe ser un PDF' },
        { status: 400 }
      )
    }

    // Verificar que la orden existe
    const orders = await query(
      `SELECT id, order_number FROM orders WHERE id = ?`,
      [orderId]
    ) as any[]

    if (orders.length === 0) {
      return NextResponse.json(
        { error: 'Orden no encontrada' },
        { status: 404 }
      )
    }

    // Crear directorio si no existe
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'boletas')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }

    // Generar nombre de archivo único
    const timestamp = Date.now()
    const filename = `boleta_${orderId}_${timestamp}.pdf`
    const filePath = path.join(uploadDir, filename)
    const publicPath = `/uploads/boletas/${filename}`

    // Guardar el archivo
    const buffer = Buffer.from(await pdfFile.arrayBuffer())
    fs.writeFileSync(filePath, buffer)

    //  Generar folio autoincrementable para admin
    const folioAdmin = await generarProximoFolioAdmin()

    //  Guardar el folio en la tabla admin_boleta_folios
    await query(
      `INSERT INTO admin_boleta_folios (order_id, folio) VALUES (?, ?)`,
      [orderId, folioAdmin]
    )

    //  SOLO actualizar la orden con la ruta del PDF y el folio admin
    //  NO modificar la tabla boletas
    await query(
      `UPDATE orders SET 
        boleta_pdf_path = ?,
        boleta_pdf_folio = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [publicPath, folioAdmin, orderId]
    )

    console.log(` PDF subido para orden ${orderId}: ${publicPath}`)
    console.log(` Folio admin generado: ${folioAdmin}`)

    return NextResponse.json({
      success: true,
      message: 'PDF subido exitosamente',
      path: publicPath,
      filename: filename,
      folio: folioAdmin
    })

  } catch (error: any) {
    console.error(' Error subiendo PDF:', error)
    return NextResponse.json(
      { error: error.message || 'Error al subir el PDF' },
      { status: 500 }
    )
  }
}