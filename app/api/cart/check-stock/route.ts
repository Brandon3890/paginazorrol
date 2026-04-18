import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserIdFromRequest } from '@/lib/auth-utils'

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request)
    const body = await request.json()
    const { items } = body

    if (!items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: 'Items inválidos' },
        { status: 400 }
      )
    }

    // Limpiar reservas expiradas primero
    await query('DELETE FROM stock_reservations WHERE expires_at < NOW()')

    const stockInfo = []

    for (const item of items) {
      const [product] = await query(
        `SELECT 
            p.id,
            p.name,
            p.stock,
            COALESCE(SUM(CASE WHEN sr.user_id != ? THEN sr.quantity ELSE 0 END), 0) as other_users_reserved,
            COALESCE(SUM(CASE WHEN sr.user_id = ? THEN sr.quantity ELSE 0 END), 0) as my_reserved
         FROM products p
         LEFT JOIN stock_reservations sr ON p.id = sr.product_id 
            AND sr.expires_at > NOW()
         WHERE p.id = ?
         GROUP BY p.id`,
        [userId, userId, item.id]
      ) as any[]

      if (product) {
        const available = product.stock - product.other_users_reserved
        stockInfo.push({
          id: product.id,
          name: product.name,
          stock_total: product.stock,
          reservado_por_mi: product.my_reserved,
          reservado_por_otros: product.other_users_reserved,
          disponible_para_mi: available
        })
      }
    }

    return NextResponse.json({
      success: true,
      stock: stockInfo
    })

  } catch (error) {
    console.error('Error verificando stock:', error)
    return NextResponse.json(
      { error: 'Error al verificar stock' },
      { status: 500 }
    )
  }
}