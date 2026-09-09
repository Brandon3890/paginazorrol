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

    await transaction.begin();

    const categories: any = await transaction.query(`
      SELECT 
        c.*,
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'id', s.id,
            'name', s.name,
            'slug', s.slug,
            'category_id', s.category_id,
            'is_active', s.is_active,
            'display_order', IFNULL(s.display_order, 0),
            'created_at', s.created_at,
            'updated_at', s.updated_at
          )
        ) as subcategories
      FROM categories c
      LEFT JOIN subcategories s ON c.id = s.category_id
      WHERE c.id = ?
      GROUP BY c.id
    `, [parseInt(id)]);

    if (categories.length === 0) {
      await transaction.commit();
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    await transaction.commit();

    const category = categories[0];
    let subcategories = [];
    
    if (category.subcategories) {
      try {
        if (typeof category.subcategories === 'string') {
          subcategories = JSON.parse(category.subcategories);
        } else if (Array.isArray(category.subcategories)) {
          subcategories = category.subcategories;
        }
        subcategories = subcategories
          .filter((sub: any) => sub.id !== null)
          .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0));
      } catch (error) {
        subcategories = [];
      }
    }

    return NextResponse.json({
      ...category,
      is_active: Boolean(category.is_active),
      subcategories: subcategories
    });
    
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

    const categoryId = parseInt(id);

    await transaction.begin();

    // Verificar si hay productos asociados
    const productsCheck = await transaction.query(
      'SELECT COUNT(*) as count FROM products WHERE category_id = ?',
      [categoryId]
    ) as any[];

    if (productsCheck[0].count > 0) {
      await transaction.rollback();
      return NextResponse.json(
        { 
          error: 'No se puede desactivar la categoría porque tiene productos asociados',
          details: `La categoría tiene ${productsCheck[0].count} productos asociados. No se puede desactivar porque hay productos que dependen de ella.`,
          hasProducts: true,
          productCount: productsCheck[0].count
        },
        { status: 409 }
      );
    }

    await transaction.query(
      'UPDATE categories SET is_active = FALSE WHERE id = ?',
      [categoryId]
    );

    await transaction.commit();

    return NextResponse.json({ message: 'Category deactivated successfully' });
    
  } catch (error) {
    await transaction.rollback();
    console.error('Error deactivating category:', error);
    return NextResponse.json(
      { error: 'Error deactivating category' },
      { status: 500 }
    );
  }
}