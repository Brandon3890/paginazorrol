import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function PUT(
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

    // Reactivar el producto
    const result: any = await query(
      'UPDATE products SET is_active = 1 WHERE id = ?',
      [productId]
    );


    return NextResponse.json({ 
      message: 'Producto reactivado correctamente',
      productId: productId
    });
  } catch (error) {
    console.error(`❌ Error reactivating product:`, error);
    return NextResponse.json(
      { error: 'Error al reactivar el producto' },
      { status: 500 }
    );
  }
}