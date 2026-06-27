import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth-utils';

// POST - Registrar notificación de oferta
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const users = await query(
      'SELECT role FROM users WHERE id = ?',
      [userId]
    ) as any[];

    if (users.length === 0 || users[0].role !== 'admin') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const body = await request.json();
    const { productId, oldPrice, newPrice, usersNotified, notifiedAt } = body;

    if (!productId) {
      return NextResponse.json({ error: 'Producto no especificado' }, { status: 400 });
    }

    await query(
      `INSERT INTO price_drop_notifications 
       (product_id, old_price, new_price, users_notified, notified_at, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [productId, oldPrice, newPrice, usersNotified, notifiedAt || new Date().toISOString()]
    );

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error registrando notificación:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// GET - Obtener historial de notificaciones
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const users = await query(
      'SELECT role FROM users WHERE id = ?',
      [userId]
    ) as any[];

    if (users.length === 0 || users[0].role !== 'admin') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const notifications = await query(`
      SELECT 
        n.*,
        p.name as product_name,
        p.image as product_image
      FROM price_drop_notifications n
      LEFT JOIN products p ON n.product_id = p.id
      ORDER BY n.created_at DESC
      LIMIT 50
    `) as any[];

    const formatted = notifications.map((n: any) => ({
      id: n.id,
      productId: n.product_id,
      productName: n.product_name,
      productImage: n.product_image,
      oldPrice: parseFloat(n.old_price),
      newPrice: parseFloat(n.new_price),
      usersNotified: n.users_notified,
      notifiedAt: n.notified_at,
      createdAt: n.created_at
    }));

    return NextResponse.json({ success: true, notifications: formatted });

  } catch (error) {
    console.error('Error obteniendo notificaciones:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}