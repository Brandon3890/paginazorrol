import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const banners = await query(
      `SELECT * FROM banners 
       WHERE is_active = 1 
       ORDER BY \`order\` ASC`,
      []
    ) as any[];

    return NextResponse.json({ success: true, banners });
  } catch (error) {
    console.error('Error obteniendo banners:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener banners' },
      { status: 500 }
    );
  }
}