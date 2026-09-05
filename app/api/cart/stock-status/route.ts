// app/api/cart/stock-status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserIdFromRequest, getIdentifierFromRequest, createGuestIdentifier } from '@/lib/auth-utils'

const RESERVATION_TIME = 10 * 60 * 1000

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request)
    let identifier = getIdentifierFromRequest(request)
    
    if (!identifier || identifier === 'unknown') {
      identifier = createGuestIdentifier(request)
    }

    const body = await request.json()
    const { items, action } = body

    if (!items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: 'Items inválidos' },
        { status: 400 }
      )
    }

    const expiresAt = new Date(Date.now() + RESERVATION_TIME)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ')

    await query('DELETE FROM stock_reservations WHERE expires_at < NOW()')

    if (action === 'reserve') {
      const errors = []
      
      for (const item of items) {
        const [product] = await query(
          `SELECT 
              p.id,
              p.name,
              p.stock,
              COALESCE((
                SELECT SUM(sr.quantity) 
                FROM stock_reservations sr 
                WHERE sr.product_id = p.id 
                  AND sr.expires_at > NOW()
                  AND sr.identifier != ?
              ), 0) as other_users_reserved
           FROM products p
           WHERE p.id = ?`,
          [identifier, item.id]
        ) as any[]

        if (!product) {
          errors.push({ id: item.id, error: 'Producto no encontrado' })
          continue
        }

        const availableStock = product.stock - product.other_users_reserved

        if (availableStock < item.quantity) {
          errors.push({ 
            id: item.id, 
            name: product.name,
            error: 'Stock insuficiente', 
            disponible: availableStock, 
            solicitado: item.quantity 
          })
          continue
        }

        await query(
          `UPDATE products 
           SET stock = stock - ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND stock >= ?`,
          [item.quantity, item.id, item.quantity]
        )

        await query(
          'DELETE FROM stock_reservations WHERE identifier = ? AND product_id = ?',
          [identifier, item.id]
        )

        await query(
          `INSERT INTO stock_reservations (identifier, product_id, quantity, expires_at, user_id)
           VALUES (?, ?, ?, ?, ?)`,
          [identifier, item.id, item.quantity, expiresAt, userId || null]
        )

        console.log(` Reserva creada`)
      }

      if (errors.length > 0) {
        return NextResponse.json({
          success: false,
          error: 'Stock insuficiente',
          errors
        }, { status: 400 })
      }

      return NextResponse.json({
        success: true,
        message: 'Stock reservado',
        expiresAt
      })

    } else if (action === 'release') {
      console.log('Procesando liberación de stock')
      
      const [reservations] = await query(
        'SELECT product_id, quantity FROM stock_reservations WHERE identifier = ?',
        [identifier]
      ) as any[]

      if (reservations && reservations.length > 0) {
        console.log(`Encontradas ${reservations.length} reservas para liberar`)
        
        for (const res of reservations) {
          await query(
            `UPDATE products 
             SET stock = stock + ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [res.quantity, res.product_id]
          )
          console.log(`Stock devuelto al producto `)
        }

        await query(
          'DELETE FROM stock_reservations WHERE identifier = ?',
          [identifier]
        )
        console.log(`Reservas eliminadas`)
      } else {
        console.log('No hay reservas para liberar')
      }

      return NextResponse.json({
        success: true,
        message: 'Stock liberado correctamente'
      })

    } else if (action === 'confirm') {
      await query(
        'DELETE FROM stock_reservations WHERE identifier = ?',
        [identifier]
      )

      return NextResponse.json({
        success: true,
        message: 'Compra confirmada'
      })
    }

    return NextResponse.json(
      { error: 'Acción no válida' },
      { status: 400 }
    )

  } catch (error: any) {
    console.error('Error en reserva de stock:', error)
    return NextResponse.json(
      { error: 'Error interno: ' + error.message },
      { status: 500 }
    )
  }
}