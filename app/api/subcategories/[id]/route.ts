import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, slug, is_active } = body;

    // Validar que los parámetros no sean undefined
    if (!id || name === undefined || slug === undefined || is_active === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    await query(
      'UPDATE subcategories SET name = ?, slug = ?, is_active = ? WHERE id = ?',
      [name, slug, is_active, parseInt(id)]
    );

    return NextResponse.json({ message: 'Subcategory updated successfully' });
  } catch (error) {
    console.error('Error updating subcategory:', error);
    return NextResponse.json(
      { error: 'Error updating subcategory' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    
    // Validar que el id no sea undefined
    if (!id) {
      return NextResponse.json(
        { error: 'Missing subcategory ID' },
        { status: 400 }
      );
    }

    await query(
      'UPDATE subcategories SET is_active = FALSE WHERE id = ?',
      [parseInt(id)]
    );

    return NextResponse.json({ message: 'Subcategory deactivated successfully' });
  } catch (error) {
    console.error('Error deactivating subcategory:', error);
    return NextResponse.json(
      { error: 'Error deactivating subcategory' },
      { status: 500 }
    );
  }
}