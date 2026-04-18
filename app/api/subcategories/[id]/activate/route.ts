import { NextResponse } from 'next/server';
import { Transaction } from '@/lib/db-transaction';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const transaction = new Transaction();
  
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Missing subcategory ID' },
        { status: 400 }
      );
    }

    await transaction.begin();

    await transaction.query(
      'UPDATE subcategories SET is_active = TRUE, updated_at = NOW() WHERE id = ?',
      [parseInt(id)]
    );

    await transaction.commit();

    return NextResponse.json({ message: 'Subcategory activated successfully' });
    
  } catch (error) {
    await transaction.rollback();
    console.error('Error activating subcategory:', error);
    return NextResponse.json(
      { error: 'Error activating subcategory' },
      { status: 500 }
    );
  }
}