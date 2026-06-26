import { NextResponse } from 'next/server';
import { Transaction } from '@/lib/db-transaction';

export async function GET() {
  const transaction = new Transaction();
  
  try {
    await transaction.begin();
    
    // Primero obtener todas las categorías
    const categories = await transaction.query(`
      SELECT 
        c.*
      FROM categories c
      ORDER BY c.is_active DESC, c.name
    `) as any[];

    // Para cada categoría, obtener sus subcategorías por separado
    const categoriesWithSubcategories = await Promise.all(
      categories.map(async (category) => {
        const subcategories = await transaction.query(`
          SELECT 
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
          ORDER BY s.display_order ASC, s.name ASC
        `, [category.id]) as any[];

        return {
          ...category,
          subcategories: subcategories
        };
      })
    );

    await transaction.commit();

    // HEADERS ANTI-CACHÉ
    return new NextResponse(JSON.stringify(categoriesWithSubcategories), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate, private',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
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
    const body = await request.json();
    const { name, slug, description, is_active = true } = body;

    console.log('📥 Recibida solicitud POST para categoría:', { name, slug, description, is_active });

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      );
    }

    await transaction.begin();

    // Verificar si ya existe una categoría con el mismo slug
    const existing = await transaction.query(
      'SELECT id FROM categories WHERE slug = ?',
      [slug]
    ) as any[];

    if (existing.length > 0) {
      await transaction.rollback();
      return NextResponse.json(
        { error: 'Ya existe una categoría con este slug' },
        { status: 409 }
      );
    }

    const result: any = await transaction.query(
      'INSERT INTO categories (name, slug, description, is_active) VALUES (?, ?, ?, ?)',
      [name, slug, description || '', is_active]
    );

    await transaction.commit();

    console.log(`✅ Categoría creada con ID: ${result.insertId}`);

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