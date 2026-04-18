import { NextResponse } from 'next/server';
import { Transaction } from '@/lib/db-transaction';

export async function GET() {
  const transaction = new Transaction();
  
  try {
    await transaction.begin();
    
    const subcategories = await transaction.query(`
      SELECT s.*, c.name as category_name 
      FROM subcategories s
      JOIN categories c ON s.category_id = c.id
      WHERE s.is_active = TRUE
      ORDER BY c.name, s.display_order ASC, s.name
    `);

    await transaction.commit();

    return NextResponse.json(subcategories);
  } catch (error) {
    await transaction.rollback();
    console.error('Error fetching subcategories:', error);
    return NextResponse.json(
      { error: 'Error fetching subcategories' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const transaction = new Transaction();
  
  try {
    const { name, slug, category_id, is_active = true } = await request.json();

    // Validar campos requeridos
    if (!name || !slug || !category_id) {
      return NextResponse.json(
        { error: 'Name, slug and category_id are required' },
        { status: 400 }
      );
    }

    await transaction.begin();

    // Obtener el máximo orden actual para esta categoría
    const maxOrderResult: any = await transaction.query(
      'SELECT MAX(display_order) as max_order FROM subcategories WHERE category_id = ?',
      [category_id]
    );
    
    const maxOrder = maxOrderResult[0]?.max_order ?? -1;
    const display_order = maxOrder + 1;

    // Insertar la nueva subcategoría con el orden calculado
    const result: any = await transaction.query(
      'INSERT INTO subcategories (name, slug, category_id, is_active, display_order) VALUES (?, ?, ?, ?, ?)',
      [name, slug, category_id, is_active, display_order]
    );

    await transaction.commit();

    return NextResponse.json({ 
      id: result.insertId,
      message: 'Subcategory created successfully' 
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating subcategory:', error);
    return NextResponse.json(
      { error: 'Error creating subcategory' },
      { status: 500 }
    );
  }
}