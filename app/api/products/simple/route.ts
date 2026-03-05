import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    
    // Consulta simple para debugging
    const products = await query(`
      SELECT 
        p.id,
        p.name,
        p.slug,
        p.description,
        p.price,
        p.original_price as originalPrice,
        p.image,
        p.category_id as categoryId,
        p.subcategory_id as subcategoryId,
        p.age_min as ageMin,
        p.age_display as age,
        p.players_min as playersMin,
        p.players_max as playersMax,
        p.players_display as players,
        p.duration_min as durationMin,
        p.duration_display as duration,
        p.stock,
        p.in_stock as inStock,
        p.is_on_sale as isOnSale,
        p.is_active as isActive,
        p.created_at as createdAt,
        p.updated_at as updatedAt,
        c.name as category,
        s.name as subcategory
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN subcategories s ON p.subcategory_id = s.id
      WHERE p.is_active = TRUE
      ORDER BY p.created_at DESC
    `) as any[];

    // Para cada producto, obtener imágenes adicionales y tags por separado
    const productsWithDetails = await Promise.all(
      products.map(async (product) => {
        // Obtener imágenes adicionales
        const additionalImages = await query(
          'SELECT image_url FROM product_images WHERE product_id = ? ORDER BY display_order',
          [product.id]
        ) as any[];

        // Obtener tags
        const tags = await query(`
          SELECT s.id, s.name, s.slug 
          FROM product_tags pt 
          JOIN subcategories s ON pt.subcategory_id = s.id 
          WHERE pt.product_id = ?
        `, [product.id]) as any[];

        return {
          ...product,
          additionalImages: additionalImages.map(img => img.image_url),
          tags: tags
        };
      })
    );

    return NextResponse.json(productsWithDetails);

  } catch (error) {
    console.error('Error in simple products API:', error);
    return NextResponse.json(
      { 
        error: 'Error fetching products',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}