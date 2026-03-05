import { NextResponse } from 'next/server';
import { query, queryExecute } from '@/lib/db';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // FIX: Await params for Next.js 13+
    const { id } = await params;
    const productId = parseInt(id);
    

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

    if (hasOrderItems) {
      
      return NextResponse.json(
        { 
          error: 'No se puede eliminar el producto permanentemente',
          details: `El producto tiene ${orderItems[0].count} pedidos asociados. En lugar de eliminarlo, se recomienda desactivarlo.`,
          hasOrders: true,
          orderCount: orderItems[0].count
        },
        { status: 409 } // Conflict
      );
    }


    // 1. Eliminar de coupon_products
    try {
      await queryExecute(
        'DELETE FROM coupon_products WHERE product_id = ?',
        [productId]
      );
      console.log(`✅ Removed coupon records`);
    } catch (error) {
      console.log(`ℹ️ No coupon records or already deleted`);
    }

    // 2. Eliminar de product_subcategories
    try {
      await queryExecute(
        'DELETE FROM product_subcategories WHERE product_id = ?',
        [productId]
      );
      console.log(`✅ Removed subcategories records`);
    } catch (error) {
      console.log(`ℹ️ No subcategories records or already deleted`);
    }

    // 3. Eliminar de product_images
    try {
      await queryExecute(
        'DELETE FROM product_images WHERE product_id = ?',
        [productId]
      );
      console.log(`✅ Removed product_images records`);
    } catch (error) {
      console.log(`ℹ️ No product_images records or already deleted`);
    }

    // 4. Finalmente eliminar el producto (solo si no tiene órdenes)
    const productResult = await queryExecute(
      'DELETE FROM products WHERE id = ?',
      [productId]
    );


    return NextResponse.json({ 
      message: 'Producto eliminado permanentemente',
      productId: productId,
      success: true
    });

  } catch (error) {
    console.error(`❌ Error permanently deleting product:`, error);
    
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