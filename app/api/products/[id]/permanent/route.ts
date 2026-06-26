import { NextResponse } from 'next/server';
import { query, queryExecute } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const productId = parseInt(resolvedParams.id);

    if (isNaN(productId)) {
      return NextResponse.json(
        { error: 'ID de producto inválido' },
        { status: 400 }
      );
    }

    // Verificar si el producto existe
    const existingProduct: any = await query(
      'SELECT * FROM products WHERE id = ?',
      [productId]
    );

    if (existingProduct.length === 0) {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      );
    }

    // Verificar si hay órdenes relacionadas
    const orderItems: any = await query(
      'SELECT COUNT(*) as count FROM order_items WHERE product_id = ?',
      [productId]
    );

    const hasOrderItems = orderItems[0].count > 0;

    // Si tiene órdenes, solo desactivar (NO eliminar)
    if (hasOrderItems) {
      await queryExecute(
        'UPDATE products SET is_active = 0 WHERE id = ?',
        [productId]
      );
      
      return NextResponse.json({ 
        message: 'Producto desactivado (tiene pedidos asociados)',
        productId: productId,
        success: true,
        desactivated: true
      });
    }

    // ============================================
    // Obtener las imágenes para eliminarlas del sistema de archivos
    // ============================================
    const productImages: any = await query(
      'SELECT image_url FROM product_images WHERE product_id = ?',
      [productId]
    );

    const mainProduct: any = await query(
      'SELECT image FROM products WHERE id = ?',
      [productId]
    );

    // Eliminar archivos de imágenes
    const allImages = [
      ...(mainProduct[0]?.image ? [mainProduct[0].image] : []),
      ...productImages.map((img: any) => img.image_url)
    ];

    for (const imagePath of allImages) {
      if (imagePath) {
        try {
          // Extraer el nombre del archivo de la ruta
          const fileName = imagePath.split('/').pop();
          if (fileName) {
            const filePath = path.join(process.cwd(), 'public', 'uploads', 'products', fileName);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              console.log(`✅ Eliminado archivo: ${filePath}`);
            }
          }
        } catch (error) {
          console.warn(`⚠️ No se pudo eliminar la imagen: ${imagePath}`);
        }
      }
    }

    // ============================================
    // Eliminar registros relacionados (EN ORDEN CORRECTO)
    // ============================================
    console.log('🗑️ Eliminando registros relacionados...');
    
    // 1. Eliminar relaciones con cupones
    await queryExecute('DELETE FROM coupon_products WHERE product_id = ?', [productId]);
    
    // 2. Eliminar subcategorías
    await queryExecute('DELETE FROM product_subcategories WHERE product_id = ?', [productId]);
    
    // 3. Eliminar imágenes adicionales
    await queryExecute('DELETE FROM product_images WHERE product_id = ?', [productId]);
    
    // 4. Eliminar recomendaciones (como producto principal y como recomendado)
    await queryExecute('DELETE FROM product_recommendations WHERE product_id = ? OR recommended_product_id = ?', [productId, productId]);
    
    // 5. Eliminar favoritos de usuarios
    await queryExecute('DELETE FROM user_favorites WHERE product_id = ?', [productId]);
    
    // 6. Eliminar reservas de stock
    await queryExecute('DELETE FROM stock_reservations WHERE product_id = ?', [productId]);
    
    // 7. Eliminar notificaciones de precio
    await queryExecute('DELETE FROM price_drop_notifications WHERE product_id = ?', [productId]);

    // ============================================
    // Finalmente eliminar el producto
    // ============================================
    await queryExecute('DELETE FROM products WHERE id = ?', [productId]);
    
    console.log(`✅ Producto ${productId} eliminado permanentemente`);

    return NextResponse.json({ 
      message: 'Producto eliminado permanentemente',
      productId: productId,
      success: true
    });

  } catch (error) {
    console.error('❌ Error permanently deleting product:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    
    return NextResponse.json(
      { 
        error: 'Error al eliminar el producto',
        details: errorMessage,
        success: false
      },
      { status: 500 }
    );
  }
}