import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserIdFromRequest } from '@/lib/auth-utils'

const RESERVATION_TIME = 10 * 60 * 1000 // 10 minutos en milisegundos

// Función para obtener fecha en formato MySQL datetime
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
        { error: 'Items inválidos' },
        { status: 400 }
      )
    }

    // Calcular fecha de expiración
    const now = new Date()
    const expiresAt = new Date(now.getTime() + RESERVATION_TIME)
    const expiresAtFormatted = getMySQLDateTime(expiresAt)

    console.log('⏰ Fechas:', {
      ahora: getMySQLDateTime(now),
      expira: expiresAtFormatted,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    })

    // LIMPIAR RESERVAS EXPIRADAS Y DEVOLVER STOCK
    const expiredReservations = await query(
      `SELECT product_id, quantity FROM stock_reservations WHERE expires_at < NOW()`
    ) as any[]

    if (expiredReservations && expiredReservations.length > 0) {
      console.log(`🔄 Devolviendo stock de ${expiredReservations.length} reservas expiradas...`)
      
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
      console.log(`🧹 Reservas expiradas eliminadas y stock devuelto`)
    }

    if (action === 'reserve') {
      // ✅ RESERVAR STOCK - DESCONTAR INMEDIATAMENTE
      const errors = []
      
      for (const item of items) {
        // Verificar stock disponible
        const productRows = await query(
          `SELECT 
              p.id,
              p.name,
              p.stock
           FROM products p
           WHERE p.id = ?`,
          [item.id]
        ) as any[]

        const product = productRows[0]

        if (!product) {
          errors.push({ id: item.id, error: 'Producto no encontrado' })
          continue
        }

        console.log(`📦 Producto ${product.name}:`, {
          stock_actual: product.stock,
          solicitado: item.quantity
        })

        if (product.stock < item.quantity) {
          errors.push({ 
            id: item.id, 
            name: product.name,
            error: 'Stock insuficiente', 
            disponible: product.stock, 
            solicitado: item.quantity 
          })
          continue
        }

        // ✅ DESCONTAR STOCK INMEDIATAMENTE
        await query(
          `UPDATE products 
           SET stock = stock - ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND stock >= ?`,
          [item.quantity, item.id, item.quantity]
        )

        // Eliminar reserva anterior de este usuario si existe
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

        console.log(`✅ Stock DESCONTADO y reserva creada: usuario ${userId}, producto ${item.id}, -${item.quantity} unidades hasta ${expiresAtFormatted}`)
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
        message: 'Stock reservado y descontado',
        expiresAt: expiresAtFormatted
      })

    } else if (action === 'update') {
      // ✅ ACTUALIZAR RESERVA - AJUSTAR STOCK SEGÚN NUEVO CARRITO
      console.log('🔄 Actualizando reserva para usuario:', userId)
      
      // Obtener reservas actuales del usuario
      const currentReservations = await query(
        `SELECT product_id, quantity FROM stock_reservations WHERE user_id = ? AND expires_at > NOW()`,
        [userId]
      ) as any[]
      
      console.log('📦 Reservas actuales:', currentReservations)
      
      // Crear un mapa de las cantidades actuales en el carrito
      const newCartMap = new Map()
      for (const item of items) {
        newCartMap.set(item.id, item.quantity)
      }
      
      // Crear un mapa de las reservas actuales
      const currentReservationsMap = new Map()
      for (const res of currentReservations) {
        currentReservationsMap.set(res.product_id, res.quantity)
      }
      
      // 1. Para productos que aumentaron su cantidad o son nuevos
      for (const item of items) {
        const currentQuantity = currentReservationsMap.get(item.id) || 0
        const newQuantity = item.quantity
        
        if (newQuantity > currentQuantity) {
          const difference = newQuantity - currentQuantity
          
          // Verificar stock disponible
          const productRows = await query(
            `SELECT id, name, stock FROM products WHERE id = ?`,
            [item.id]
          ) as any[]
          
          const product = productRows[0]
          
          if (!product) {
            console.error(`Producto ${item.id} no encontrado`)
            continue
          }
          
          if (product.stock < difference) {
            console.error(`Stock insuficiente para ${product.name}: necesita ${difference}, tiene ${product.stock}`)
            return NextResponse.json({
              success: false,
              error: `Stock insuficiente para ${product.name}`,
              errors: [{
                id: item.id,
                name: product.name,
                disponible: product.stock,
                solicitado: difference
              }]
            }, { status: 400 })
          }
          
          // Descontar la diferencia
          await query(
            `UPDATE products 
             SET stock = stock - ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND stock >= ?`,
            [difference, item.id, difference]
          )
          
          // Actualizar o insertar reserva
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
          
          console.log(`📈 Aumentado stock para producto ${item.id}: +${difference} unidades descontadas`)
        } else if (newQuantity < currentQuantity) {
          // 2. Para productos que disminuyeron su cantidad
          const difference = currentQuantity - newQuantity
          
          // Devolver stock
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
            // Eliminar reserva si la cantidad es 0
            await query(
              `DELETE FROM stock_reservations 
               WHERE user_id = ? AND product_id = ?`,
              [userId, item.id]
            )
          }
          
          console.log(`📉 Disminuido stock para producto ${item.id}: +${difference} unidades devueltas`)
        } else {
          // 3. Productos que no cambiaron - solo actualizar expiración
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
      
      // 4. Eliminar reservas de productos que ya no están en el carrito
      for (const [productId, quantity] of currentReservationsMap) {
        if (!newCartMap.has(productId)) {
          // Devolver stock
          await query(
            `UPDATE products 
             SET stock = stock + ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [quantity, productId]
          )
          
          // Eliminar reserva
          await query(
            `DELETE FROM stock_reservations 
             WHERE user_id = ? AND product_id = ?`,
            [userId, productId]
          )
          
          console.log(`🗑️ Producto ${productId} eliminado del carrito, stock devuelto: +${quantity}`)
        }
      }
      
      return NextResponse.json({
        success: true,
        message: 'Reserva actualizada correctamente',
        expiresAt: expiresAtFormatted
      })

    } else if (action === 'confirm') {
      // ✅ CONFIRMAR COMPRA - SOLO ELIMINAR RESERVA (el stock ya está descontado)
      console.log('💰 Confirmando compra para usuario:', userId)
      
      const reservations = await query(
        `SELECT product_id, quantity 
         FROM stock_reservations 
         WHERE user_id = ? AND expires_at > NOW()`,
        [userId]
      ) as any[]

      console.log('📦 Reservas a confirmar (stock ya descontado):', reservations)

      const deleteResult = await query(
        'DELETE FROM stock_reservations WHERE user_id = ?',
        [userId]
      ) as any
      
      console.log(`🗑️ Reservas eliminadas para usuario ${userId}: ${deleteResult?.affectedRows || 0} filas`)

      return NextResponse.json({
        success: true,
        message: 'Compra confirmada, stock ya descontado'
      })

    } else if (action === 'release') {
      // ✅ LIBERAR RESERVA - DEVOLVER STOCK Y ELIMINAR RESERVA
      console.log('🔄 Liberando reserva y devolviendo stock para usuario:', userId)
      
      const reservations = await query(
        `SELECT product_id, quantity 
         FROM stock_reservations 
         WHERE user_id = ? AND expires_at > NOW()`,
        [userId]
      ) as any[]

      if (reservations && reservations.length > 0) {
        console.log('📦 Reservas a liberar (devolviendo stock):', reservations)
        
        for (const res of reservations) {
          await query(
            `UPDATE products 
             SET stock = stock + ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [res.quantity, res.product_id]
          )
          console.log(`📈 Stock devuelto para producto ${res.product_id}: +${res.quantity} unidades`)
        }
      }

      const deleteResult = await query(
        'DELETE FROM stock_reservations WHERE user_id = ?',
        [userId]
      ) as any
      
      console.log(`🗑️ Reservas eliminadas para usuario ${userId}: ${deleteResult?.affectedRows || 0} filas`)

      return NextResponse.json({
        success: true,
        message: 'Stock liberado y devuelto'
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