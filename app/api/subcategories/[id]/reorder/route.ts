import { NextResponse } from 'next/server';
import { Transaction } from '@/lib/db-transaction';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const transaction = new Transaction();
  
  try {
    const { id } = await params;
    const { ordered_ids } = await request.json();

    if (!id || !ordered_ids || !Array.isArray(ordered_ids)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    await transaction.begin();

    // Actualizar el orden de cada subcategoría
    for (let i = 0; i < ordered_ids.length; i++) {
      await transaction.query(
        'UPDATE subcategories SET display_order = ?, updated_at = NOW() WHERE id = ? AND category_id = ?',
        [i, ordered_ids[i], parseInt(id)]
      );
    }

    await transaction.commit();

    return NextResponse.json({ message: 'Subcategories reordered successfully' });
    
  } catch (error) {
    await transaction.rollback();
    console.error('Error reordering subcategories:', error);
    return NextResponse.json(
      { error: 'Error reordering subcategories' },
      { status: 500 }
    );
  }
}