import { NextResponse } from 'next/server';
import { Transaction } from '@/lib/db-transaction';

export async function GET() {
  const transaction = new Transaction();
  
  try {
    await transaction.begin();
    
    // Primero obtener todas las categorías
    const categories = await transaction.query(`
      SELECT 
        id,
        name,
        slug,
        description,
        is_active,
        created_at,
        updated_at
      FROM categories
      ORDER BY name ASC
    `) as any[];

    // Para cada categoría, obtener sus subcategorías
    const categoriesWithSubs = await Promise.all(
      categories.map(async (category) => {
        const subcategories = await transaction.query(`
          SELECT 
            id,
            name,
            slug,
            category_id,
            is_active,
            display_order,
            created_at,
            updated_at
          FROM subcategories
          WHERE category_id = ?
          ORDER BY display_order ASC, name ASC
        `, [category.id]) as any[];

        return {
          ...category,
          is_active: Boolean(category.is_active),
          subcategories: subcategories.map((sub: any) => ({
            ...sub,
            is_active: Boolean(sub.is_active),
            display_order: sub.display_order || 0
          }))
        };
      })
    );

    await transaction.commit();

    console.log(`✅ ${categoriesWithSubs.length} categorías cargadas`);
    return NextResponse.json(categoriesWithSubs);
    
  } catch (error) {
    await transaction.rollback();
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'Error fetching categories' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const transaction = new Transaction();
  
  try {
    const { name, slug, description, is_active = true } = await request.json();

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      );
    }

    await transaction.begin();

    const result: any = await transaction.query(
      'INSERT INTO categories (name, slug, description, is_active) VALUES (?, ?, ?, ?)',
      [name, slug, description, is_active]
    );

    await transaction.commit();

    return NextResponse.json({ 
      id: result.insertId,
      message: 'Category created successfully' 
    });
    
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating category:', error);
    return NextResponse.json(
      { error: 'Error creating category' },
      { status: 500 }
    );
  }
}