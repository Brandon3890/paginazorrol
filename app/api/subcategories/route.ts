import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const subcategories = await query(`
      SELECT s.*, c.name as category_name 
      FROM subcategories s
      JOIN categories c ON s.category_id = c.id
      WHERE s.is_active = TRUE
      ORDER BY c.name, s.name
    `);

    return NextResponse.json(subcategories);
  } catch (error) {
    console.error('Error fetching subcategories:', error);
    return NextResponse.json(
      { error: 'Error fetching subcategories' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { name, slug, category_id, is_active = true } = await request.json();

    const result: any = await query(
      'INSERT INTO subcategories (name, slug, category_id, is_active) VALUES (?, ?, ?, ?)',
      [name, slug, category_id, is_active]
    );

    return NextResponse.json({ 
      id: result.insertId,
      message: 'Subcategory created successfully' 
    });
  } catch (error) {
    console.error('Error creating subcategory:', error);
    return NextResponse.json(
      { error: 'Error creating subcategory' },
      { status: 500 }
    );
  }
}