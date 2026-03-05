import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Missing subcategory ID' },
        { status: 400 }
      );
    }

    // Eliminar permanentemente la subcategoría
    await query(
      'DELETE FROM subcategories WHERE id = ?',
      [parseInt(id)]
    );

    return NextResponse.json({ message: 'Subcategory permanently deleted' });
  } catch (error) {
    console.error('Error deleting subcategory:', error);
    return NextResponse.json(
      { error: 'Error deleting subcategory' },
      { status: 500 }
    );
  }
}