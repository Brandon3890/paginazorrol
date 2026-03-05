import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const resolvedParams = await params;
    const couponId = parseInt(resolvedParams.id);

    if (isNaN(couponId)) {
      return NextResponse.json(
        { error: 'ID de cupón inválido' },
        { status: 400 }
      );
    }

    // Incrementar el contador de usos
    await query(
      'UPDATE coupons SET current_uses = current_uses + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [couponId]
    );

    console.log(`✅ Coupon ${couponId} used successfully`);

    return NextResponse.json({ 
      success: true,
      message: 'Cupón utilizado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error using coupon:', error);
    return NextResponse.json(
      { error: 'Error al usar el cupón' },
      { status: 500 }
    );
  }
}