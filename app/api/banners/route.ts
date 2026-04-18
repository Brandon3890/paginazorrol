// app/api/banners/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic'; // Forzar actualización en cada request
export const revalidate = 0; // Deshabilitar cache

export async function GET(request: NextRequest) {
  try {
    const banners = await query(
      `SELECT * FROM banners 
       WHERE is_active = 1 
       ORDER BY \`order\` ASC`,
      []
    ) as any[];

    // Headers para evitar cache
    return NextResponse.json({ success: true, banners }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error) {
    console.error('Error obteniendo banners:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener banners' },
      { status: 500 }
    );
  }
}