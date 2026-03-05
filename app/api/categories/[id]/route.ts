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
        CASE 
          WHEN COUNT(s.id) = 0 THEN '[]'
          ELSE CONCAT(
            '[',
            GROUP_CONCAT(
              DISTINCT CONCAT(
                '{',
                '"id":', s.id, ',',
                '"name":"', REPLACE(REPLACE(s.name, '"', '\\\\"'), '\\\\', '\\\\\\\\'), '",',
                '"slug":"', REPLACE(REPLACE(s.slug, '"', '\\\\"'), '\\\\', '\\\\\\\\'), '",',
                '"category_id":', s.category_id, ',',
                '"is_active":', IF(s.is_active, 'true', 'false'), ',',
                '"created_at":"', s.created_at, '",',
                '"updated_at":"', s.updated_at, '"',
                '}'
              )
            ),
            ']'
          )
        END as subcategories_json
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

    // Procesar los datos JSON
    const category = categories[0];
    let subcategories = [];
    
    if (category.subcategories_json && category.subcategories_json !== '[]') {
      try {
        subcategories = JSON.parse(category.subcategories_json);
      } catch (error) {
        subcategories = [];
      }
    }

    const { subcategories_json, ...categoryData } = category;
    
    const categoryWithSubcategories = {
      ...categoryData,
      subcategories: Array.isArray(subcategories) ? subcategories : []
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

    await transaction.query(
      'UPDATE categories SET is_active = FALSE WHERE id = ?',
      [parseInt(id)]
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