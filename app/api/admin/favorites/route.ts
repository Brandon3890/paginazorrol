import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserIdFromRequest } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request)
    
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Verificar que es admin
    const users = await query(
      'SELECT role FROM users WHERE id = ?',
      [userId]
    ) as any[]

    if (users.length === 0 || users[0].role !== 'admin') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    // Obtener todos los favoritos con información de usuario y producto
    const favorites = await query(`
      SELECT 
        uf.id,
        uf.user_id,
        uf.product_id,
        uf.created_at,
        u.email,
        u.first_name,
        u.last_name,
        u.phone,
        p.name as product_name,
        p.price as product_price,
        p.image as product_image,
        p.stock as product_stock,
        p.in_stock as product_in_stock,
        p.is_active as product_is_active,
        c.name as category_name
      FROM user_favorites uf
      LEFT JOIN users u ON uf.user_id = u.id
      LEFT JOIN products p ON uf.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      ORDER BY uf.created_at DESC
    `) as any[]

    // Contar total de favoritos únicos por producto
    const favoritesCount = await query(`
      SELECT COUNT(*) as total FROM user_favorites
    `) as any[]

    const formattedFavorites = favorites.map((fav: any) => ({
      id: fav.id,
      user_id: fav.user_id,
      product_id: fav.product_id,
      created_at: fav.created_at,
      user: {
        id: fav.user_id,
        email: fav.email || '',
        first_name: fav.first_name || '',
        last_name: fav.last_name || '',
        phone: fav.phone || ''
      },
      product: {
        id: fav.product_id,
        name: fav.product_name || '',
        price: parseFloat(fav.product_price) || 0,
        image: fav.product_image || '',
        stock: parseInt(fav.product_stock) || 0,
        in_stock: fav.product_in_stock === 1,
        is_active: fav.product_is_active === 1,
        category: fav.category_name || ''
      }
    }))

    return NextResponse.json({ 
      success: true, 
      favorites: formattedFavorites,
      totalFavorites: favoritesCount[0]?.total || 0
    })

  } catch (error) {
    console.error('Error obteniendo favoritos:', error)
    return NextResponse.json(
      { error: 'Error al obtener favoritos' },
      { status: 500 }
    )
  }
}