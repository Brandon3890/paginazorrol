import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    
    // Validar que el id no sea undefined
    if (!id) {
      return NextResponse.json(
        { error: 'Missing subcategory ID' },
        { status: 400 }
      );
    }

    await query(
      'UPDATE subcategories SET is_active = TRUE WHERE id = ?',
      [parseInt(id)]
    );

    return NextResponse.json({ message: 'Subcategory activated successfully' });
  } catch (error) {
    console.error('Error activating subcategory:', error);
    return NextResponse.json(
      { error: 'Error activating subcategory' },
      { status: 500 }
    );
  }
}