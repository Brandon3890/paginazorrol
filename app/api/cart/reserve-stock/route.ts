import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserIdFromRequest } from '@/lib/auth-utils'

const RESERVATION_TIME = 10 * 60 * 1000 // 10 minutos

function getMySQLDateTime(date: Date = new Date()): string {
  return date.getFullYear() + '-' +
    String(date.getMonth() + 1).padStart(2, '0') + '-' +
    String(date.getDate()).padStart(2, '0') + ' ' +
    String(date.getHours()).padStart(2, '0') + ':' +
    String(date.getMinutes()).padStart(2, '0') + ':' +
    String(date.getSeconds()).padStart(2, '0')
}

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
        { error: 'Items invalidos' },
        { status: 400 }
      )
    }

    const now = new Date()
    const expiresAt = new Date(now.getTime() + RESERVATION_TIME)
    const expiresAtFormatted = getMySQLDateTime(expiresAt)


    // Limpiar reservas expiradas (devolver stock)
    const expiredReservations = await query(
      `SELECT product_id, quantity FROM stock_reservations WHERE expires_at < NOW()`
    ) as any[]

    if (expiredReservations && expiredReservations.length > 0) {
      console.log('Devolviendo stock de', expiredReservations.length, 'reservas expiradas...')
      
      for (const res of expiredReservations) {
        await query(
          `UPDATE products 
           SET stock = stock + ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [res.quantity, res.product_id]
        )
      }
      
      await query('DELETE FROM stock_reservations WHERE expires_at < NOW()')
      console.log('Reservas expiradas eliminadas y stock devuelto')
    }

    if (action === 'reserve') {
      console.log('RESERVANDO STOCK ')
      
      const errors = []
      
      for (const item of items) {
        // Verificar disponibilidad REAL (stock actual - reservas de otros usuarios)
        const [stockInfo] = await query(
          `SELECT 
            p.id,
            p.name,
            p.stock,
            COALESCE((
              SELECT SUM(sr.quantity) 
              FROM stock_reservations sr 
              WHERE sr.product_id = p.id 
                AND sr.user_id != ?
                AND sr.expires_at > NOW()
            ), 0) as reserved_by_others
          FROM products p
          WHERE p.id = ?`,
          [userId, item.id]
        ) as any[]

        if (!stockInfo) {
          errors.push({ id: item.id, error: 'Producto no encontrado' })
          continue
        }

        const availableStock = stockInfo.stock - stockInfo.reserved_by_others

        console.log(` Producto ${stockInfo.name}:`, {
          stock_actual: stockInfo.stock,
          reservado_por_otros: stockInfo.reserved_by_others,
          disponible_real: availableStock,
          solicitado: item.quantity
        })

        if (availableStock < item.quantity) {
          errors.push({ 
            id: item.id, 
            name: stockInfo.name,
            error: 'Stock insuficiente', 
            disponible: availableStock, 
            solicitado: item.quantity 
          })
          continue
        }

        // 🔥 DESCONTAR STOCK (1era vez - RESERVA)
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
          [userId, item.id, item.quantity, expiresAtFormatted]
        )

        console.log(`Stock DESCONTADO y reserva CREADA`)
      }

      if (errors.length > 0) {
        // Si hay errores, devolver el stock de los productos que sí se descontaron
        console.log('Errores en reserva, devolviendo stock...')
        for (const item of items) {
          if (!errors.find(e => e.id === item.id)) {
            // Este producto se descontó, hay que devolverlo
            await query(
              `UPDATE products 
               SET stock = stock + ?
               WHERE id = ?`,
              [item.quantity, item.id]
            )
            await query(
              'DELETE FROM stock_reservations WHERE user_id = ? AND product_id = ?',
              [userId, item.id]
            )
            console.log(`Stock devuelto para producto ${item.id}`)
          }
        }
        
        return NextResponse.json({
          success: false,
          error: 'Stock insuficiente',
          errors
        }, { status: 400 })
      }

      return NextResponse.json({
        success: true,
        message: 'Stock reservado y descontado',
        expiresAt: expiresAtFormatted
      })
    }

    if (action === 'update') {
      console.log('ACTUALIZANDO reserva')
      
      const currentReservations = await query(
        `SELECT product_id, quantity FROM stock_reservations WHERE user_id = ? AND expires_at > NOW()`,
        [userId]
      ) as any[]
      
      console.log('Reservas actuales:', currentReservations)
      
      const newCartMap = new Map()
      for (const item of items) {
        newCartMap.set(item.id, item.quantity)
      }
      
      const currentReservationsMap = new Map()
      for (const res of currentReservations) {
        currentReservationsMap.set(res.product_id, res.quantity)
      }
      
      for (const item of items) {
        const currentQuantity = currentReservationsMap.get(item.id) || 0
        const newQuantity = item.quantity
        
        if (newQuantity > currentQuantity) {
          const difference = newQuantity - currentQuantity
          
          // Verificar disponibilidad de stock
          const [stockInfo] = await query(
            `SELECT 
              p.id,
              p.name,
              p.stock,
              COALESCE((
                SELECT SUM(sr.quantity) 
                FROM stock_reservations sr 
                WHERE sr.product_id = p.id 
                  AND sr.user_id != ?
                  AND sr.expires_at > NOW()
              ), 0) as reserved_by_others
            FROM products p
            WHERE p.id = ?`,
            [userId, item.id]
          ) as any[]
          
          if (!stockInfo) continue
          
          const availableStock = stockInfo.stock - stockInfo.reserved_by_others
          
          if (availableStock < difference) {
            return NextResponse.json({
              success: false,
              error: 'Stock insuficiente para ' + stockInfo.name,
              errors: [{
                id: item.id,
                name: stockInfo.name,
                disponible: availableStock,
                solicitado: difference
              }]
            }, { status: 400 })
          }
          
          // Descontar el stock adicional
          await query(
            `UPDATE products 
             SET stock = stock - ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND stock >= ?`,
            [difference, item.id, difference]
          )
          
          // Actualizar reserva
          if (currentQuantity > 0) {
            await query(
              `UPDATE stock_reservations 
               SET quantity = ?, expires_at = ?
               WHERE user_id = ? AND product_id = ?`,
              [newQuantity, expiresAtFormatted, userId, item.id]
            )
          } else {
            await query(
              `INSERT INTO stock_reservations (user_id, product_id, quantity, expires_at)
               VALUES (?, ?, ?, ?)`,
              [userId, item.id, newQuantity, expiresAtFormatted]
            )
          }
          
          console.log(` Producto + unidades descontadas (total: ${newQuantity})`)
        } else if (newQuantity < currentQuantity) {
          const difference = currentQuantity - newQuantity
          
          // Devolver el stock que ya no se necesita
          await query(
            `UPDATE products 
             SET stock = stock + ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [difference, item.id]
          )
          
          // Actualizar reserva
          if (newQuantity > 0) {
            await query(
              `UPDATE stock_reservations 
               SET quantity = ?, expires_at = ?
               WHERE user_id = ? AND product_id = ?`,
              [newQuantity, expiresAtFormatted, userId, item.id]
            )
          } else {
            await query(
              `DELETE FROM stock_reservations 
               WHERE user_id = ? AND product_id = ?`,
              [userId, item.id]
            )
          }
          
          console.log(`Producto+ unidades devueltas (total: ${newQuantity})`)
        } else {
          // Misma cantidad, solo actualizar expiración
          if (currentQuantity > 0) {
            await query(
              `UPDATE stock_reservations 
               SET expires_at = ?
               WHERE user_id = ? AND product_id = ?`,
              [expiresAtFormatted, userId, item.id]
            )
          }
        }
      }
      
      // Eliminar reservas para productos ya no en el carrito
      for (const [productId, quantity] of currentReservationsMap) {
        if (!newCartMap.has(productId)) {
          // Devolver el stock
          await query(
            `UPDATE products 
             SET stock = stock + ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [quantity, productId]
          )
          
          await query(
            `DELETE FROM stock_reservations 
             WHERE user_id = ? AND product_id = ?`,
            [userId, productId]
          )
          
          console.log(`Producto eliminado del carrito, stock devuelto: +${quantity}`)
        }
      }
      
      return NextResponse.json({
        success: true,
        message: 'Reserva actualizada correctamente',
        expiresAt: expiresAtFormatted
      })
    }

    if (action === 'confirm') {
      
      // Solo se eliminan las reservas (el stock ya se maneja en payment/response)
      const reservations = await query(
        `SELECT product_id, quantity 
         FROM stock_reservations 
         WHERE user_id = ? AND expires_at > NOW()`,
        [userId]
      ) as any[]

      console.log('Reservas a eliminar (stock ya descontado en reserva):', reservations)

      const deleteResult = await query(
        'DELETE FROM stock_reservations WHERE user_id = ?',
        [userId]
      ) as any
      
      console.log(`Reservas eliminadas para usuario`)

      return NextResponse.json({
        success: true,
        message: 'Compra confirmada, reservas eliminadas'
      })
    }

    if (action === 'release') {
      console.log('LIBERANDO reserva y devolviendo stock ')
      
      const reservations = await query(
        `SELECT product_id, quantity 
         FROM stock_reservations 
         WHERE user_id = ? AND expires_at > NOW()`,
        [userId]
      ) as any[]

      if (reservations && reservations.length > 0) {
        console.log('Reservas a liberar (devolviendo stock):', reservations)
        
        for (const res of reservations) {
          await query(
            `UPDATE products 
             SET stock = stock + ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [res.quantity, res.product_id]
          )
          console.log(`Producto + unidades devueltas`)
        }
        
        const deleteResult = await query(
          'DELETE FROM stock_reservations WHERE user_id = ?',
          [userId]
        ) as any
        console.log(`Reservas eliminadas para usuario`)
      } else {
        console.log('No hay reservas activas para liberar')
      }

      return NextResponse.json({
        success: true,
        message: 'Stock liberado y devuelto'
      })
    }

    if (action === 'release_single') {
      console.log('Liberando stock de producto individual para usuario:', userId)
      
      for (const item of items) {
        const reservations = await query(
          `SELECT product_id, quantity 
           FROM stock_reservations 
           WHERE user_id = ? AND product_id = ? AND expires_at > NOW()`,
          [userId, item.id]
        ) as any[]

        if (reservations && reservations.length > 0) {
          const reservation = reservations[0]
          
          await query(
            `UPDATE products 
             SET stock = stock + ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [reservation.quantity, item.id]
          )
          console.log(`Producto y unidades devueltas`)
          
          await query(
            'DELETE FROM stock_reservations WHERE user_id = ? AND product_id = ?',
            [userId, item.id]
          )
          console.log(`Reserva eliminada para producto`)
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Stock liberado correctamente'
      })
    }

    return NextResponse.json(
      { error: 'Accion no valida' },
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