import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const productId = parseInt(id);

    if (isNaN(productId)) {
      return NextResponse.json(
        { error: 'ID de producto inválido' },
        { status: 400 }
      );
    }

    // Limpiar reservas expiradas
    await query('DELETE FROM stock_reservations WHERE expires_at < NOW()');

    // Obtener stock real y reservado
    const [product] = await query(
      `SELECT 
          p.id,
          p.name,
          p.stock,
          COALESCE(SUM(sr.quantity), 0) as total_reserved
       FROM products p
       LEFT JOIN stock_reservations sr ON p.id = sr.product_id 
          AND sr.expires_at > NOW()
       WHERE p.id = ?
       GROUP BY p.id`,
      [productId]
    ) as any[];

    if (!product) {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      );
    }

    const availableStock = product.stock - product.total_reserved;

    return NextResponse.json({
      id: product.id,
      name: product.name,
      stock_real: product.stock,
      reservado: product.total_reserved,
      disponible: availableStock
    });

  } catch (error) {
    console.error('Error obteniendo stock:', error);
    return NextResponse.json(
      { error: 'Error al obtener stock' },
      { status: 500 }
    );
  }
}