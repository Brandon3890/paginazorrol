import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getUserIdFromRequest } from '@/lib/auth-utils';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

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

    // Revalidar rutas
    revalidatePath('/');
    revalidatePath('/api/banners');
    
    return NextResponse.json({ success: true, message: 'Caché limpiada' });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Error al limpiar caché' },
      { status: 500 }
    );
  }
}