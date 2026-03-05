import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserIdFromRequest } from '@/lib/auth-utils'

// Definir el tipo directamente en el archivo
interface DashboardStats {
  products: {
    total: number
    active: number
    inactive: number
  }
  categories: {
    total: number
    active: number
    totalSubcategories: number
    activeSubcategories: number
  }
  coupons: {
    total: number
    active: number
    expired: number
  }
  orders: {
    total: number
    pending: number
    processing: number
    shipped: number
    delivered: number
    cancelled: number
  }
}

export async function GET(request: NextRequest) {
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
      return NextResponse.json({ error: 'No tienes permisos para acceder al dashboard' }, { status: 403 })
    }

    // Obtener estadísticas de productos
    const productsStats = await query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive
      FROM products
    `) as any[]

    // Obtener estadísticas de categorías
    const categoriesStats = await query(`
      SELECT 
        COUNT(*) as total_categories,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_categories
      FROM categories
    `) as any[]

    // Obtener estadísticas de subcategorías
    const subcategoriesStats = await query(`
      SELECT 
        COUNT(*) as total_subcategories,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_subcategories
      FROM subcategories
    `) as any[]

    // Obtener estadísticas de cupones
    const couponsStats = await query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_active = 1 AND expiration_date > NOW() AND current_uses < max_uses THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN expiration_date <= NOW() OR current_uses >= max_uses THEN 1 ELSE 0 END) as expired
      FROM coupons
    `) as any[]

    // Obtener estadísticas de órdenes
    const ordersStats = await query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN status = 'shipped' THEN 1 ELSE 0 END) as shipped,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
      FROM orders
    `) as any[]

    const stats: DashboardStats = {
      products: {
        total: productsStats[0]?.total || 0,
        active: productsStats[0]?.active || 0,
        inactive: productsStats[0]?.inactive || 0
      },
      categories: {
        total: categoriesStats[0]?.total_categories || 0,
        active: categoriesStats[0]?.active_categories || 0,
        totalSubcategories: subcategoriesStats[0]?.total_subcategories || 0,
        activeSubcategories: subcategoriesStats[0]?.active_subcategories || 0
      },
      coupons: {
        total: couponsStats[0]?.total || 0,
        active: couponsStats[0]?.active || 0,
        expired: couponsStats[0]?.expired || 0
      },
      orders: {
        total: ordersStats[0]?.total || 0,
        pending: ordersStats[0]?.pending || 0,
        processing: ordersStats[0]?.processing || 0,
        shipped: ordersStats[0]?.shipped || 0,
        delivered: ordersStats[0]?.delivered || 0,
        cancelled: ordersStats[0]?.cancelled || 0
      }
    }

    return NextResponse.json(stats)

  } catch (error) {
    console.error('Error obteniendo estadísticas del dashboard:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}