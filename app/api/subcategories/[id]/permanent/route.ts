import { NextResponse } from 'next/server';
import { Transaction } from '@/lib/db-transaction';

export async function DELETE(
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

    // Verificar si hay productos usando esta subcategoría
    const productsUsingSubcategory: any = await transaction.query(
      'SELECT COUNT(*) as count FROM product_subcategories WHERE subcategory_id = ?',
      [parseInt(id)]
    );

    if (productsUsingSubcategory[0]?.count > 0) {
      await transaction.rollback();
      return NextResponse.json(
        { error: 'Cannot delete subcategory because it is being used by products' },
        { status: 400 }
      );
    }

    // Eliminar permanentemente la subcategoría
    await transaction.query(
      'DELETE FROM subcategories WHERE id = ?',
      [parseInt(id)]
    );

    await transaction.commit();

    return NextResponse.json({ message: 'Subcategory permanently deleted' });
    
  } catch (error) {
    await transaction.rollback();
    console.error('Error permanently deleting subcategory:', error);
    return NextResponse.json(
      { error: 'Error permanently deleting subcategory' },
      { status: 500 }
    );
  }
}