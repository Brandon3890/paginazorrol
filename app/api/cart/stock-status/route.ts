import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserIdFromRequest } from '@/lib/auth-utils'

const RESERVATION_TIME = 10 * 60 * 1000 // 10 minutos

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request)
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Usuario no autenticado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { items, action } = body

    if (!items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: 'Items inválidos' },
        { status: 400 }
      )
    }

    // Calcular fecha de expiración
    const expiresAt = new Date(Date.now() + RESERVATION_TIME)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ')

    // LIMPIAR RESERVAS EXPIRADAS (siempre al inicio)
    await query('DELETE FROM stock_reservations WHERE expires_at < NOW()')

    if (action === 'reserve') {
      // RESERVAR STOCK: Verificar y descontar
      const errors = []
      
      for (const item of items) {
        // Verificar stock disponible (excluyendo reservas del usuario actual)
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
                  AND sr.user_id != ?
              ), 0) as other_users_reserved
           FROM products p
           WHERE p.id = ?`,
          [userId, item.id]
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

        // DESCONTAR STOCK
        await query(
          `UPDATE products 
           SET stock = stock - ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND stock >= ?`,
          [item.quantity, item.id, item.quantity]
        )

        // Eliminar reserva anterior si existe
        await query(
          'DELETE FROM stock_reservations WHERE user_id = ? AND product_id = ?',
          [userId, item.id]
        )

        // Crear nueva reserva
        await query(
          `INSERT INTO stock_reservations (user_id, product_id, quantity, expires_at)
           VALUES (?, ?, ?, ?)`,
          [userId, item.id, item.quantity, expiresAt]
        )

        console.log(`✅ Reserva creada: usuario ${userId}, producto ${item.id}, ${item.quantity} unid.`)
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
      // LIBERAR STOCK: Devolver a products y eliminar reservas
      console.log('🔄 Procesando liberación de stock para usuario:', userId)
      
      // Obtener reservas del usuario
      const [reservations] = await query(
        'SELECT product_id, quantity FROM stock_reservations WHERE user_id = ?',
        [userId]
      ) as any[]

      if (reservations && reservations.length > 0) {
        console.log(`📦 Encontradas ${reservations.length} reservas para liberar:`, reservations)
        
        // Devolver stock a cada producto
        for (const res of reservations) {
          const result = await query(
            `UPDATE products 
             SET stock = stock + ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [res.quantity, res.product_id]
          ) as any
          
          console.log(`📈 Stock devuelto para producto ${res.product_id}: +${res.quantity} unidades. Filas afectadas: ${result.affectedRows}`)
        }

        // Eliminar las reservas
        await query(
          'DELETE FROM stock_reservations WHERE user_id = ?',
          [userId]
        )
        console.log(`🗑️ Reservas eliminadas para usuario ${userId}`)
      } else {
        console.log('ℹ️ No hay reservas para liberar')
      }

      return NextResponse.json({
        success: true,
        message: 'Stock liberado correctamente'
      })

    } else if (action === 'confirm') {
      // CONFIRMAR COMPRA: Solo eliminar reservas (stock ya descontado)
      await query(
        'DELETE FROM stock_reservations WHERE user_id = ?',
        [userId]
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
    console.error('❌ Error en reserva de stock:', error)
    return NextResponse.json(
      { error: 'Error interno: ' + error.message },
      { status: 500 }
    )
  }
}