import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId } = body;

    if (!productId) {
      return NextResponse.json(
        { error: 'Producto no especificado' },
        { status: 400 }
      );
    }

    // Obtener usuarios que tienen este producto en favoritos
    const users = await query(`
      SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name
      FROM user_favorites uf
      LEFT JOIN users u ON uf.user_id = u.id
      WHERE uf.product_id = ? AND u.is_active = 1
    `, [productId]) as any[];

    return NextResponse.json({ 
      success: true, 
      users: users.map((u: any) => ({
        id: u.id,
        email: u.email,
        firstName: u.first_name,
        lastName: u.last_name
      }))
    });

  } catch (error) {
    console.error('Error obteniendo usuarios favoritos:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}