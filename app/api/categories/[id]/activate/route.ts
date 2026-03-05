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
        { error: 'Missing category ID' },
        { status: 400 }
      );
    }

    await transaction.begin();

    await transaction.query(
      'UPDATE categories SET is_active = TRUE WHERE id = ?',
      [parseInt(id)]
    );

    await transaction.commit();

    return NextResponse.json({ message: 'Category activated successfully' });
    
  } catch (error) {
    await transaction.rollback();
    console.error('Error activating category:', error);
    return NextResponse.json(
      { error: 'Error activating category' },
      { status: 500 }
    );
  }
}