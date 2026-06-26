import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserIdFromRequest } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request)
    
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')

    if (!productId) {
      return NextResponse.json(
        { error: 'Producto no especificado' },
        { status: 400 }
      )
    }

    const favorites = await query(
      'SELECT id FROM user_favorites WHERE user_id = ? AND product_id = ?',
      [userId, productId]
    ) as any[]

    return NextResponse.json({
      isFavorite: favorites.length > 0
    })

  } catch (error) {
    console.error('Error checking favorite:', error)
    return NextResponse.json(
      { error: 'Error al verificar favorito' },
      { status: 500 }
    )
  }
}