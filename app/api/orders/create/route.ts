// app/api/orders/create/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserIdFromRequest } from '@/lib/auth-utils'
import { orderNumberService } from '@/lib/order-number-service'

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request)
    
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const {
      items,
      customerInfo,
      shippingAddress,
      totals,
      notes,
      couponId,
      couponCode,
      shippingMethod
    } = body

    // Validar datos requeridos
    if (!items || !items.length || !customerInfo || !totals) {
      return NextResponse.json(
        { error: 'Datos de orden incompletos' },
        { status: 400 }
      )
    }

    // Generar número de orden único con reintentos
    let orderNumber: string;
    let orderId: number;
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      try {
        // Generar número de orden único
        orderNumber = orderNumberService.generateOrderNumber();
        
        console.log('📝 Intentando crear orden con número:', orderNumber);

        // 1. Crear la orden principal
        const orderResult = await query(
          `INSERT INTO orders (
            user_id, order_number, status, subtotal, discount, shipping, tax, total,
            coupon_id, coupon_code, payment_method, payment_status, notes,
            shipping_address_id
          ) VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, 'transbank', 'pending', ?, ?)`,
          [
            userId,
            orderNumber,
            Math.round(totals.subtotal),
            Math.round(totals.discount),
            Math.round(totals.shipping),
            Math.round(totals.tax),
            Math.round(totals.total),
            couponId || null,
            couponCode || null,
            notes || null,
            shippingAddress?.id || null
          ]
        ) as any;

        orderId = orderResult.insertId;

        // 2. Crear los items de la orden
        for (const item of items) {
          await query(
            `INSERT INTO order_items (
              order_id, product_id, product_name, product_price, quantity, subtotal
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            [
              orderId,
              item.id,
              item.name,
              item.price,
              item.quantity,
              Math.round(item.price * item.quantity)
            ]
          );
        }

        console.log('✅ Orden creada en MySQL con ID:', orderId);

        return NextResponse.json({
          success: true,
          orderId: orderId,
          orderNumber: orderNumber
        });

      } catch (error: any) {
        // Si es error de duplicado, reintentar
        if (error.code === 'ER_DUP_ENTRY' && error.sqlMessage?.includes('order_number')) {
          attempts++;
          console.warn(`⚠️ Número de orden duplicado, reintento ${attempts}/${maxAttempts}`);
          
          if (attempts >= maxAttempts) {
            throw new Error('No se pudo generar un número de orden único después de varios intentos');
          }
          
          // Esperar un poco antes del siguiente intento
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }
        
        // Si es otro error, lanzarlo
        throw error;
      }
    }

    throw new Error('No se pudo crear la orden');

  } catch (error: any) {
    console.error('❌ Error creando orden:', error);
    
    if (error.message.includes('número de orden único')) {
      return NextResponse.json(
        { error: 'Error generando número de orden único. Por favor intenta nuevamente.' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor al crear la orden' },
      { status: 500 }
    );
  }
}