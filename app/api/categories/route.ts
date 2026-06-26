import { NextResponse } from 'next/server';
import { Transaction } from '@/lib/db-transaction';

export async function GET() {
  const transaction = new Transaction();
  
  try {
    await transaction.begin();
    
    const categories = await transaction.query(`
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
                '"display_order":', IFNULL(s.display_order, 0), ',',
                '"created_at":"', s.created_at, '",',
                '"updated_at":"', s.updated_at, '"',
                '}'
              )
              ORDER BY IFNULL(s.display_order, 0) ASC
            ),
            ']'
          )
        END as subcategories_json
      FROM categories c
      LEFT JOIN subcategories s ON c.id = s.category_id
      GROUP BY c.id
      ORDER BY c.is_active DESC, c.name
    `) as any[];

    await transaction.commit();

    const processedCategories = categories.map(category => {
      let subcategories = [];
      
      if (category.subcategories_json && category.subcategories_json !== '[]') {
        try {
          subcategories = JSON.parse(category.subcategories_json);
          subcategories.sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0));
        } catch (error) {
          console.error('Error parsing subcategories JSON:', error);
          subcategories = [];
        }
      }

      const { subcategories_json, ...categoryData } = category;
      
      return {
        ...categoryData,
        subcategories: Array.isArray(subcategories) ? subcategories : []
      };
    });

    // HEADERS ANTI-CACHÉ
    return new NextResponse(JSON.stringify(processedCategories), {
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