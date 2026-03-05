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
      GROUP BY c.id
      ORDER BY c.is_active DESC, c.name
    `) as any[];

    await transaction.commit();

    // Procesar los datos JSON
    const processedCategories = categories.map(category => {
      let subcategories = [];
      
      if (category.subcategories_json && category.subcategories_json !== '[]') {
        try {
          subcategories = JSON.parse(category.subcategories_json);
        } catch (error) {
          subcategories = [];
        }
      }

      const { subcategories_json, ...categoryData } = category;
      
      return {
        ...categoryData,
        subcategories: Array.isArray(subcategories) ? subcategories : []
      };
    });

    return NextResponse.json(processedCategories);
    
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

    // Validar campos requeridos
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