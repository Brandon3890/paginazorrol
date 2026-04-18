import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth-utils';

// GET - Obtener todos los banners
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const user = await query(
      'SELECT role FROM users WHERE id = ?',
      [userId]
    ) as any[];

    if (!user.length || user[0].role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const banners = await query(
      `SELECT * FROM banners ORDER BY \`order\` ASC`,
      []
    ) as any[];

    return NextResponse.json({ success: true, banners });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener banners' },
      { status: 500 }
    );
  }
}

// POST - Crear nuevo banner
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const user = await query(
      'SELECT role FROM users WHERE id = ?',
      [userId]
    ) as any[];

    if (!user.length || user[0].role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const {
      title, subtitle, text, image, link, isActive,
      showText, overlayColor, textColor, overlayOpacity,
      textPosition, textSize
    } = body;

    const maxOrder = await query(
      'SELECT MAX(`order`) as max_order FROM banners',
      []
    ) as any[];
    const newOrder = (maxOrder[0]?.max_order ?? -1) + 1;

    await query(
      `INSERT INTO banners (
        title, subtitle, text, image, link, is_active, \`order\`, 
        show_text, overlay_color, text_color, overlay_opacity, 
        text_position, text_size
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title || null, subtitle || null, text || null, image,
        link || null, isActive ? 1 : 0, newOrder,
        showText ? 1 : 0, overlayColor || '#ffffff',
        textColor || '#1f2937', overlayOpacity || 70,
        textPosition || 'left', textSize || 'medium'
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { success: false, error: 'Error al crear banner' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar banner
export async function PUT(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const user = await query(
      'SELECT role FROM users WHERE id = ?',
      [userId]
    ) as any[];

    if (!user.length || user[0].role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const {
      id, title, subtitle, text, image, link, isActive,
      showText, overlayColor, textColor, overlayOpacity,
      textPosition, textSize
    } = body;

    await query(
      `UPDATE banners SET 
        title = ?, subtitle = ?, text = ?, image = ?, link = ?,
        is_active = ?, show_text = ?, overlay_color = ?,
        text_color = ?, overlay_opacity = ?, text_position = ?,
        text_size = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [
        title || null, subtitle || null, text || null, image,
        link || null, isActive ? 1 : 0, showText ? 1 : 0,
        overlayColor || '#ffffff', textColor || '#1f2937',
        overlayOpacity || 70, textPosition || 'left',
        textSize || 'medium', id
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar banner' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar banner
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const user = await query(
      'SELECT role FROM users WHERE id = ?',
      [userId]
    ) as any[];

    if (!user.length || user[0].role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    await query('DELETE FROM banners WHERE id = ?', [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { success: false, error: 'Error al eliminar banner' },
      { status: 500 }
    );
  }
}

// PATCH - Reordenar banners
export async function PATCH(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const user = await query(
      'SELECT role FROM users WHERE id = ?',
      [userId]
    ) as any[];

    if (!user.length || user[0].role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { banners } = await request.json();

    for (const banner of banners) {
      await query(
        'UPDATE banners SET `order` = ? WHERE id = ?',
        [banner.order, banner.id]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { success: false, error: 'Error al reordenar banners' },
      { status: 500 }
    );
  }
}