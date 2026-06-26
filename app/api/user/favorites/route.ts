import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserIdFromRequest } from '@/lib/auth-utils'

// GET - Obtener productos favoritos del usuario
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request)
    
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const favorites = await query(
      `SELECT p.* 
       FROM user_favorites uf
       LEFT JOIN products p ON uf.product_id = p.id
       WHERE uf.user_id = ? AND p.is_active = true
       ORDER BY uf.created_at DESC`,
      [userId]
    ) as any[]

    return NextResponse.json({ success: true, favorites })
  } catch (error) {
    console.error('Error obteniendo favoritos:', error)
    return NextResponse.json(
      { error: 'Error al obtener favoritos' },
      { status: 500 }
    )
  }
}

// POST - Agregar/Quitar favorito
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request)
    
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { productId, action } = body

    if (!productId) {
      return NextResponse.json(
        { error: 'Producto no especificado' },
        { status: 400 }
      )
    }

    if (action === 'add') {
      // Verificar que el producto existe
      const products = await query(
        'SELECT id FROM products WHERE id = ? AND is_active = true',
        [productId]
      ) as any[]

      if (products.length === 0) {
        return NextResponse.json(
          { error: 'Producto no encontrado' },
          { status: 404 }
        )
      }

      // Agregar favorito
      await query(
        'INSERT INTO user_favorites (user_id, product_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE id = id',
        [userId, productId]
      )

      return NextResponse.json({
        success: true,
        action: 'added',
        message: 'Producto agregado a favoritos'
      })

    } else if (action === 'remove') {
      // Quitar favorito
      await query(
        'DELETE FROM user_favorites WHERE user_id = ? AND product_id = ?',
        [userId, productId]
      )

      return NextResponse.json({
        success: true,
        action: 'removed',
        message: 'Producto eliminado de favoritos'
      })

    } else {
      return NextResponse.json(
        { error: 'Acción no válida' },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('Error gestionando favorito:', error)
    return NextResponse.json(
      { error: 'Error al gestionar favorito' },
      { status: 500 }
    )
  }
}