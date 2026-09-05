import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserIdFromRequest, getIdentifierFromRequest, createGuestIdentifier } from '@/lib/auth-utils'

const RESERVATION_TIME = 10 * 60 * 1000

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
    let identifier = getIdentifierFromRequest(request)
    
    // Si no hay identifier válido, crear uno temporal
    if (!identifier || identifier === 'unknown') {
      identifier = createGuestIdentifier(request)
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


    // Limpiar reservas expiradas
    await query('DELETE FROM stock_reservations WHERE expires_at < NOW()')

    if (action === 'reserve') {
      console.log('RESERVANDO STOCK')
      
      const errors = []
      
      for (const item of items) {
        const productRows = await query(
          `SELECT p.id, p.name, p.stock FROM products p WHERE p.id = ?`,
          [item.id]
        ) as any[]

        const product = productRows[0]

        if (!product) {
          errors.push({ id: item.id, error: 'Producto no encontrado' })
          continue
        }


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

        await query(
          `UPDATE products 
           SET stock = stock - ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND stock >= ?`,
          [item.quantity, item.id, item.quantity]
        )

        // Eliminar reserva anterior si existe
        await query(
          'DELETE FROM stock_reservations WHERE identifier = ? AND product_id = ?',
          [identifier, item.id]
        )

        // Insertar nueva reserva - user_id puede ser NULL
        await query(
          `INSERT INTO stock_reservations (identifier, product_id, quantity, expires_at, user_id)
           VALUES (?, ?, ?, ?, ?)`,
          [identifier, item.id, item.quantity, expiresAtFormatted, userId || null]
        )

        console.log(' Stock DESCONTADO y reserva creada')
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
        expiresAt: expiresAtFormatted,
        identifier: identifier
      })
    }

    if (action === 'update') {
      console.log('ACTUALIZANDO reserva ')
      
      const currentReservations = await query(
        `SELECT product_id, quantity FROM stock_reservations WHERE identifier = ? AND expires_at > NOW()`,
        [identifier]
      ) as any[]
      
      
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
          
          const productRows = await query(
            `SELECT id, name, stock FROM products WHERE id = ?`,
            [item.id]
          ) as any[]
          
          const product = productRows[0]
          
          if (!product) continue
          
          if (product.stock < difference) {
            return NextResponse.json({
              success: false,
              error: 'Stock insuficiente para ' + product.name,
              errors: [{
                id: item.id,
                name: product.name,
                disponible: product.stock,
                solicitado: difference
              }]
            }, { status: 400 })
          }
          
          await query(
            `UPDATE products 
             SET stock = stock - ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND stock >= ?`,
            [difference, item.id, difference]
          )
          
          if (currentQuantity > 0) {
            await query(
              `UPDATE stock_reservations 
               SET quantity = ?, expires_at = ?
               WHERE identifier = ? AND product_id = ?`,
              [newQuantity, expiresAtFormatted, identifier, item.id]
            )
          } else {
            await query(
              `INSERT INTO stock_reservations (identifier, product_id, quantity, expires_at, user_id)
               VALUES (?, ?, ?, ?, ?)`,
              [identifier, item.id, newQuantity, expiresAtFormatted, userId || null]
            )
          }
          
          console.log('Aumentado stock para producto', item.id, '+', difference, 'unidades descontadas')
        } else if (newQuantity < currentQuantity) {
          const difference = currentQuantity - newQuantity
          
          await query(
            `UPDATE products 
             SET stock = stock + ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [difference, item.id]
          )
          
          if (newQuantity > 0) {
            await query(
              `UPDATE stock_reservations 
               SET quantity = ?, expires_at = ?
               WHERE identifier = ? AND product_id = ?`,
              [newQuantity, expiresAtFormatted, identifier, item.id]
            )
          } else {
            await query(
              `DELETE FROM stock_reservations 
               WHERE identifier = ? AND product_id = ?`,
              [identifier, item.id]
            )
          }
          
          console.log('Disminuido stock para producto', item.id, '+', difference, 'unidades devueltas')
        } else {
          if (currentQuantity > 0) {
            await query(
              `UPDATE stock_reservations 
               SET expires_at = ?
               WHERE identifier = ? AND product_id = ?`,
              [expiresAtFormatted, identifier, item.id]
            )
          }
        }
      }
      
      for (const [productId, quantity] of currentReservationsMap) {
        if (!newCartMap.has(productId)) {
          await query(
            `UPDATE products 
             SET stock = stock + ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [quantity, productId]
          )
          
          await query(
            `DELETE FROM stock_reservations 
             WHERE identifier = ? AND product_id = ?`,
            [identifier, productId]
          )
          
          console.log('Producto', productId, 'eliminado del carrito, stock devuelto: +' + quantity)
        }
      }
      
      return NextResponse.json({
        success: true,
        message: 'Reserva actualizada correctamente',
        expiresAt: expiresAtFormatted
      })
    }

    if (action === 'confirm') {
      console.log('CONFIRMANDO compra')
      
      await query(
        'DELETE FROM stock_reservations WHERE identifier = ?',
        [identifier]
      )
      
      console.log('Reservas eliminadas')

      return NextResponse.json({
        success: true,
        message: 'Compra confirmada, stock ya descontado'
      })
    }

    if (action === 'release') {
      console.log('LIBERANDO reserva y devolviendo stock ',)
      
      const reservations = await query(
        `SELECT product_id, quantity 
         FROM stock_reservations 
         WHERE identifier = ? AND expires_at > NOW()`,
        [identifier]
      ) as any[]

      if (reservations && reservations.length > 0) {
        console.log('Reservas a liberar (devolviendo stock)',)
        
        for (const res of reservations) {
          const [product] = await query(
            `SELECT stock FROM products WHERE id = ?`,
            [res.product_id]
          ) as any[]
          
          if (product) {
            await query(
              `UPDATE products 
               SET stock = stock + ?,
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = ?`,
              [res.quantity, res.product_id]
            )
            console.log('Stock devuelto para producto', res.product_id, '+', res.quantity, 'unidades')
          } else {
            console.warn('Producto no encontrado, no se puede devolver stock')
          }
        }
        
        await query(
          'DELETE FROM stock_reservations WHERE identifier = ?',
          [identifier]
        )
        console.log('Reservas eliminadas')
      } else {
        console.log('No hay reservas activas para liberar')
      }

      return NextResponse.json({
        success: true,
        message: 'Stock liberado y devuelto'
      })
    }

    if (action === 'release_single') {
      console.log('Liberando stock de producto individual',)
      
      for (const item of items) {
        const reservations = await query(
          `SELECT product_id, quantity 
           FROM stock_reservations 
           WHERE identifier = ? AND product_id = ? AND expires_at > NOW()`,
          [identifier, item.id]
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
          console.log('Stock devuelto para producto', item.id, '+', reservation.quantity, 'unidades')
          
          await query(
            'DELETE FROM stock_reservations WHERE identifier = ? AND product_id = ?',
            [identifier, item.id]
          )
          console.log('Reserva eliminada para producto')
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