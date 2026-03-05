import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const categories = await query(`
      SELECT 
        c.id as category_id,
        c.name as category_name,
        c.slug as category_slug,
        s.id as subcategory_id,
        s.name as subcategory_name,
        s.slug as subcategory_slug
      FROM categories c
      LEFT JOIN subcategories s ON c.id = s.category_id AND s.is_active = TRUE
      WHERE c.is_active = TRUE
      ORDER BY c.name, s.name
    `) as any[];

    // Procesar para agrupar subcategorías por categoría
    const categoriesMap = new Map();
    
    categories.forEach(row => {
      const categoryId = row.category_id;
      
      if (!categoriesMap.has(categoryId)) {
        categoriesMap.set(categoryId, {
          id: categoryId,
          name: row.category_name,
          slug: row.category_slug,
          subcategories: []
        });
      }
      
      if (row.subcategory_id) {
        categoriesMap.get(categoryId).subcategories.push({
          id: row.subcategory_id,
          name: row.subcategory_name,
          slug: row.subcategory_slug
        });
      }
    });

    const result = Array.from(categoriesMap.values());
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Error fetching categories with subcategories:', error);
    return NextResponse.json(
      { error: 'Error fetching categories' },
      { status: 500 }
    );
  }
}