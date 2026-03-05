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
        { error: 'Missing category ID' },
        { status: 400 }
      );
    }

    const categoryId = parseInt(id);

    await transaction.begin();

    // Verificar si hay productos usando esta categoría
    const productsCheck = await transaction.query(
      'SELECT COUNT(*) as count FROM products WHERE category_id = ?',
      [categoryId]
    ) as any[];

    if (productsCheck[0].count > 0) {
      await transaction.rollback();
      return NextResponse.json(
        { 
          error: 'No se puede eliminar la categoría permanentemente',
          details: `La categoría tiene ${productsCheck[0].count} productos asociados. En lugar de eliminarla, desactívala.`,
          hasProducts: true,
          productCount: productsCheck[0].count
        },
        { status: 409 }
      );
    }

    // Verificar si hay subcategorías
    const subcategoriesCheck = await transaction.query(
      'SELECT COUNT(*) as count FROM subcategories WHERE category_id = ?',
      [categoryId]
    ) as any[];

    // Eliminar subcategorías primero (si las hay)
    if (subcategoriesCheck[0].count > 0) {
      await transaction.query(
        'DELETE FROM subcategories WHERE category_id = ?',
        [categoryId]
      );
    }

    // Finalmente eliminar la categoría
    await transaction.query(
      'DELETE FROM categories WHERE id = ?',
      [categoryId]
    );

    await transaction.commit();

    return NextResponse.json({ 
      message: 'Category permanently deleted',
      categoryId: categoryId
    });
    
  } catch (error) {
    await transaction.rollback();
    console.error('Error permanently deleting category:', error);
    return NextResponse.json(
      { error: 'Error deleting category' },
      { status: 500 }
    );
  }
}