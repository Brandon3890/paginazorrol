import { NextResponse } from 'next/server';
import { Transaction } from '@/lib/db-transaction';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const transaction = new Transaction();
  
  try {
    const { id } = await params;
    const { display_order } = await request.json();

    if (!id || display_order === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    await transaction.begin();

    await transaction.query(
      'UPDATE subcategories SET display_order = ?, updated_at = NOW() WHERE id = ?',
      [display_order, parseInt(id)]
    );

    await transaction.commit();

    return NextResponse.json({ message: 'Subcategory order updated successfully' });
    
  } catch (error) {
    await transaction.rollback();
    console.error('Error updating subcategory order:', error);
    return NextResponse.json(
      { error: 'Error updating subcategory order' },
      { status: 500 }
    );
  }
}