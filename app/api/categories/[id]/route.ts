import { NextResponse } from 'next/server';
import { Transaction } from '@/lib/db-transaction';

export async function GET(
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

    // Obtener la categoría
    const categories = await transaction.query(
      'SELECT * FROM categories WHERE id = ?',
      [categoryId]
    ) as any[];

    if (categories.length === 0) {
      await transaction.commit();
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // Obtener TODAS las subcategorías (activas e inactivas)
    const subcategories = await transaction.query(
      `SELECT 
        s.id,
        s.name,
        s.slug,
        s.category_id,
        s.is_active,
        s.display_order,
        s.created_at,
        s.updated_at
      FROM subcategories s
      WHERE s.category_id = ?
      ORDER BY s.display_order ASC, s.id ASC`,
      [categoryId]
    ) as any[];

    console.log(`📊 Categoría ${categories[0].name} (ID: ${categoryId}): ${subcategories.length} subcategorías encontradas`);

    await transaction.commit();

    const category = categories[0];
    
    const categoryWithSubcategories = {
      ...category,
      subcategories: subcategories || []
    };

    return NextResponse.json(categoryWithSubcategories);
    
  } catch (error) {
    await transaction.rollback();
    console.error('Error fetching category:', error);
    return NextResponse.json(
      { error: 'Error fetching category' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const transaction = new Transaction();
  
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, slug, description, is_active } = body;

    if (!id || name === undefined || slug === undefined || is_active === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    await transaction.begin();

    await transaction.query(
      'UPDATE categories SET name = ?, slug = ?, description = ?, is_active = ? WHERE id = ?',
      [name, slug, description, is_active, parseInt(id)]
    );

    await transaction.commit();

    return NextResponse.json({ message: 'Category updated successfully' });
    
  } catch (error) {
    await transaction.rollback();
    console.error('Error updating category:', error);
    return NextResponse.json(
      { error: 'Error updating category' },
      { status: 500 }
    );
  }
}

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

    await transaction.begin();

    // Verificar si tiene productos
    const productsCheck = await transaction.query(
      'SELECT COUNT(*) as count FROM products WHERE category_id = ?',
      [parseInt(id)]
    ) as any[];

    if (productsCheck[0].count > 0) {
      await transaction.rollback();
      return NextResponse.json(
        { 
          error: 'No se puede desactivar la categoría porque tiene productos asociados',
          hasProducts: true,
          productCount: productsCheck[0].count
        },
        { status: 409 }
      );
    }

    await transaction.query(
      'UPDATE categories SET is_active = FALSE WHERE id = ?',
      [parseInt(id)]
    );

    // Desactivar también sus subcategorías
    await transaction.query(
      'UPDATE subcategories SET is_active = FALSE WHERE category_id = ?',
      [parseInt(id)]
    );

    await transaction.commit();

    return NextResponse.json({ 
      message: 'Category deactivated successfully',
      categoryId: parseInt(id)
    });
    
  } catch (error) {
    await transaction.rollback();
    console.error('Error deactivating category:', error);
    return NextResponse.json(
      { error: 'Error deactivating category' },
      { status: 500 }
    );
  }
}